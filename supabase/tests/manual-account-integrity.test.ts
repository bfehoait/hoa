import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

// Synthetic local PostgreSQL only. Auth Admin's final-row metadata write is
// simulated; gateway, deployed legacy triggers and concurrent sessions are not.
const db = new PGlite();
const actor = "91000000-0000-4000-8000-000000000001";
const target = "91000000-0000-4000-8000-000000000002";
const request = "92000000-0000-4000-8000-000000000001";
const email = "synthetic-member@example.invalid";
const migration = (name: string) =>
  readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");

async function transaction(action: () => Promise<unknown>) {
  await db.exec("BEGIN");
  try {
    const result = await action();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
async function create(options: { actor?: string; id?: string } = {}) {
  return transaction(async () => {
    const id = options.id ?? target;
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      id,
      email,
    ]);
    await db.query(
      "UPDATE auth.users SET email_confirmed_at=now(),raw_app_meta_data=$2::jsonb WHERE id=$1",
      [
        id,
        JSON.stringify({
          bfe_manual_account: {
            actor_id: options.actor ?? actor,
            request_id: request,
            name: "Synthetic member",
            unit: "1-01-005",
            role: "homeowner",
            reason: "Synthetic local account verification",
          },
        }),
      ],
    );
  });
}
async function counts() {
  return (
    await db.query<{ auth: number; members: number; receipts: number }>(
      `SELECT
       (SELECT count(*)::integer FROM auth.users WHERE id=$1) AS auth,
       (SELECT count(*)::integer FROM public.members WHERE user_id=$1) AS members,
       (SELECT count(*)::integer FROM public.bfe_manual_account_receipts WHERE target_id=$1) AS receipts`,
      [target],
    )
  ).rows[0];
}
async function preflight() {
  return (
    await db.query<{ result: { created: boolean; member_linked?: boolean } }>(
      "SELECT public.bfe_manual_account_preflight($1,$2,$3) AS result",
      [actor, request, email],
    )
  ).rows[0].result;
}

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,
      raw_app_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE TABLE public.members(id text PRIMARY KEY,user_id uuid,name text,email text,
      unit text,role text,extra_roles text[] DEFAULT '{}',status text);
    CREATE TABLE public.bfe_access_managers(user_id uuid,active boolean);
    CREATE TABLE public.bfe_account_audit(id bigint GENERATED ALWAYS AS IDENTITY,
      actor_id uuid,target_id uuid,action text,details jsonb);
    -- Narrow synthetic policy: only the fixture developer is authorized.
    -- Full configurable permission semantics are covered by their own suite.
    CREATE FUNCTION public.bfe_can_for(uuid,text,text,text) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT false $$;
  `);
  const accounts = await migration(
    "202611050004_accounts_notifications_developer.sql",
  );
  await db.exec(
    accounts.slice(
      accounts.indexOf("CREATE FUNCTION public.bfe_roles_for"),
      accounts.indexOf("CREATE FUNCTION public.bfe_can_for"),
    ),
  );
  await db.exec(await migration("202611090025_manual_account_creation.sql"));
  await db.exec(
    await migration("202611140077_manual_account_connection_integrity.sql"),
  );
}, 30000);

beforeEach(async () => {
  await db.exec(`DELETE FROM auth.users; DELETE FROM public.members;
    DELETE FROM public.bfe_account_audit;
    SELECT set_config('request.jwt.claim.role','service_role',false);`);
  await db.query(
    "INSERT INTO auth.users(id,email) VALUES($1,'synthetic-staff@example.invalid')",
    [actor],
  );
  await db.query(
    "INSERT INTO public.members(id,user_id,name,email,role,extra_roles,status) VALUES('synthetic-staff',$1,'Synthetic staff','synthetic-staff@example.invalid','admin',ARRAY['developer'],'Active')",
    [actor],
  );
});
afterAll(() => db.close());

it("commits one Auth user, member and receipt and verifies repeat success", async () => {
  expect(await preflight()).toEqual({ created: false });
  await create();
  expect(await counts()).toEqual({ auth: 1, members: 1, receipts: 1 });
  expect(await preflight()).toMatchObject({
    created: true,
    member_linked: true,
  });
  expect(await preflight()).toMatchObject({
    created: true,
    member_linked: true,
  });
  expect(await counts()).toEqual({ auth: 1, members: 1, receipts: 1 });
});

it("rolls back creation for an unauthorized actor", async () => {
  await expect(create({ actor: target })).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 0, members: 0, receipts: 0 });
});

it("refuses to claim an existing disconnected member by matching email", async () => {
  await db.query(
    "INSERT INTO public.members(id,name,email,role,status) VALUES('synthetic-legacy','Synthetic legacy',$1,'homeowner','Active')",
    [email],
  );
  await expect(preflight()).rejects.toThrow();
  await expect(create()).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 0, members: 0, receipts: 0 });
});

it("rolls back a managed Auth insert if the normal linking trigger is disabled", async () => {
  await db.exec(
    "ALTER TABLE auth.users DISABLE TRIGGER bfe_manual_auth_account_link",
  );
  try {
    await expect(preflight()).rejects.toThrow();
    await expect(create()).rejects.toThrow();
    expect(await counts()).toEqual({ auth: 0, members: 0, receipts: 0 });
  } finally {
    await db.exec(
      "ALTER TABLE auth.users ENABLE TRIGGER bfe_manual_auth_account_link",
    );
  }
});

it("rolls back member disconnection without losing the original link", async () => {
  await create();
  await expect(
    transaction(() =>
      db.query("UPDATE public.members SET user_id=NULL WHERE user_id=$1", [
        target,
      ]),
    ),
  ).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 1, members: 1, receipts: 1 });
});

it("rolls back a duplicate member connection", async () => {
  await create();
  await expect(
    transaction(() =>
      db.query(
        "INSERT INTO public.members(id,user_id,name,email,role,status) VALUES('synthetic-duplicate',$1,'Synthetic duplicate','duplicate@example.invalid','homeowner','Active')",
        [target],
      ),
    ),
  ).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 1, members: 1, receipts: 1 });
});

it("refuses standalone member deletion while the managed login exists", async () => {
  await create();
  await expect(
    transaction(() =>
      db.query("DELETE FROM public.members WHERE user_id=$1", [target]),
    ),
  ).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 1, members: 1, receipts: 1 });
});

it("allows combined Auth/member deletion in its final transaction state", async () => {
  await create();
  await transaction(async () => {
    await db.query("DELETE FROM public.members WHERE user_id=$1", [target]);
    await db.query("DELETE FROM auth.users WHERE id=$1", [target]);
  });
  expect(await counts()).toEqual({ auth: 0, members: 0, receipts: 0 });
});

it("allows suspension but refuses to confirm the suspended account as successful", async () => {
  await create();
  await db.query(
    "UPDATE public.members SET status='Suspended' WHERE user_id=$1",
    [target],
  );
  await expect(preflight()).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 1, members: 1, receipts: 1 });
});

it("checks the current member even when an old creation receipt exists", async () => {
  await create();
  // Simulate historical corruption through owner-disabled guards, not a
  // supported application operation. Always restore the trigger afterward.
  await db.exec(
    "ALTER TABLE public.members DISABLE TRIGGER bfe_z_manual_connection_member",
  );
  try {
    await db.query("UPDATE public.members SET user_id=NULL WHERE user_id=$1", [
      target,
    ]);
  } finally {
    await db.exec(
      "ALTER TABLE public.members ENABLE TRIGGER bfe_z_manual_connection_member",
    );
  }
  await expect(preflight()).rejects.toThrow();
  expect(await counts()).toEqual({ auth: 1, members: 0, receipts: 1 });
});
