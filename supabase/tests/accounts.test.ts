import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";

const db = new PGlite();
const ids = {
  resident: "51000000-0000-4000-8000-000000000001",
  other: "51000000-0000-4000-8000-000000000002",
  admin: "51000000-0000-4000-8000-000000000003",
  developer: "51000000-0000-4000-8000-000000000004",
};
async function asUser<T>(id: string | null, action: () => Promise<T>) {
  await db.exec(`BEGIN;SET LOCAL ROLE ${id ? "authenticated" : "anon"};`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    const result = await action();
    await db.exec("COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
async function rpc<T>(id: string | null, sql: string, args: unknown[] = []) {
  return asUser(
    id,
    async () =>
      (await db.query<{ result: T }>(`SELECT ${sql} result`, args)).rows[0]
        .result,
  );
}
async function create() {
  return rpc<{ id: string; version: number }>(
    ids.resident,
    "public.bfe_create_request($1,'Synthetic repair','A synthetic household maintenance request.','Maintenance')",
    ["52000000-0000-4000-8000-000000000001"],
  );
}
async function notifications(id: string, page = 0, unread = false) {
  return rpc<{
    rows: { id: string; title: string; read_at: string | null }[];
    total: number;
    unread: number;
  }>(id, "public.bfe_my_notifications($1,$2)", [page, unread]);
}
async function grant(
  actor = ids.developer,
  target = ids.admin,
  module = "requests",
  action = "view",
) {
  return rpc<string>(
    actor,
    "public.bfe_provision_access($1,'maintenance',$2,$3,'association','allow','Synthetic approval',NULL)",
    [target, module, action],
  );
}
const expectedResident = {
  role: "homeowner",
  extra_roles: [],
  status: "Active",
};
async function roles(
  actor: string,
  target: string,
  primary: string,
  extra: string[],
  status: string,
  expected: unknown,
) {
  return rpc(
    actor,
    "public.bfe_update_member_access($1,$2,$3,$4,'Synthetic approval',$5)",
    [target, primary, extra, status, expected],
  );
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE public.members(id text PRIMARY KEY,user_id uuid,name text,email text,phone text,unit text,title text,role text,extra_roles text[] DEFAULT '{}',status text DEFAULT 'Active',last_seen timestamptz);
 CREATE TABLE public.portal_data(key text PRIMARY KEY,value jsonb);
 CREATE TABLE public.registrations(id text PRIMARY KEY,name text,email text,phone text,unit text,role text,status text,created_at timestamptz,review_note text,proof text);
 CREATE TABLE public.audit_log(id bigint PRIMARY KEY,at timestamptz,actor_role text,action text,source text,ref_no text);
 `);
  for (const [name, id] of Object.entries(ids)) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query(
      "INSERT INTO public.members(id,user_id,name,email,unit,role,extra_roles) VALUES($1,$2,$3,$4,'Synthetic unit',$5,$6)",
      [
        name,
        id,
        `Sample ${name}`,
        `${name}@example.invalid`,
        name === "resident"
          ? "homeowner"
          : name === "other"
            ? "renter"
            : "admin",
        name === "developer" ? ["developer"] : [],
      ],
    );
  }
  for (const name of [
    "202611050001_request_workflow.sql",
    "202611050002_module_monitoring.sql",
    "202611050003_access_permissions.sql",
    "202611050004_accounts_notifications_developer.sql",
  ])
    await db.exec(
      await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "DELETE FROM public.bfe_notifications;DELETE FROM public.bfe_account_audit;DELETE FROM public.bfe_profiles;DELETE FROM public.bfe_access_grants;DELETE FROM public.bfe_access_assignments;DELETE FROM public.bfe_request_audit;DELETE FROM public.bfe_request_messages;DELETE FROM public.bfe_requests;DELETE FROM public.members WHERE id='duplicate';UPDATE public.members SET status='Active';UPDATE public.members SET role=CASE id WHEN 'resident' THEN 'homeowner' WHEN 'other' THEN 'renter' ELSE 'admin' END,extra_roles=CASE WHEN id='developer' THEN ARRAY['developer']::text[] ELSE ARRAY[]::text[] END;",
  );
});
afterAll(async () => {
  await db.close();
});
describe("account services and explicit developer control", () => {
  it("guards developer accounts even when legacy admin table grants are broad", async () => {
    await db.exec(
      "GRANT INSERT,UPDATE,DELETE ON public.members TO authenticated;",
    );
    try {
      await expect(
        asUser(ids.admin, () =>
          db.query(
            "UPDATE public.members SET extra_roles=ARRAY['developer'] WHERE user_id=$1",
            [ids.admin],
          ),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(ids.admin, () =>
          db.query("DELETE FROM public.members WHERE user_id=$1", [
            ids.developer,
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(ids.admin, () =>
          db.query(
            "INSERT INTO public.members(id,user_id,name,role,extra_roles) VALUES('forged',$1,'Forged','admin',ARRAY['developer'])",
            [ids.admin],
          ),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(ids.developer, () =>
          db.query("DELETE FROM public.members WHERE user_id=$1", [
            ids.developer,
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        rpc(
          ids.admin,
          "public.bfe_can_for($1,'finance','manage','association')",
          [ids.developer],
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec(
        "REVOKE INSERT,UPDATE,DELETE ON public.members FROM authenticated;",
      );
    }
  });
  it("derives full developer control from active member data, never admin alone", async () => {
    expect(
      await rpc(
        ids.developer,
        "public.bfe_can('finance','manage','association')",
      ),
    ).toBe(true);
    expect(
      await rpc(ids.admin, "public.bfe_can('finance','manage','association')"),
    ).toBe(false);
    expect(
      await rpc(ids.developer, "public.bfe_can('unknown','anything','global')"),
    ).toBe(false);
    expect(
      await rpc<{ developer_control: boolean }>(
        ids.developer,
        "public.bfe_my_access()",
      ),
    ).toMatchObject({ developer_control: true });
    await db.query(
      "UPDATE public.members SET status='Suspended' WHERE user_id=$1",
      [ids.developer],
    );
    expect(
      await rpc(
        ids.developer,
        "public.bfe_can('requests','status','association')",
      ),
    ).toBe(false);
  });
  it("allows developers to operate requests and records their replies/status", async () => {
    const request = await create();
    await rpc(
      ids.developer,
      "public.bfe_reply_request($1,gen_random_uuid(),'Synthetic developer reply')",
      [request.id],
    );
    await rpc(
      ids.developer,
      "public.bfe_set_request_status($1,2,'In progress')",
      [request.id],
    );
    expect(
      (
        await db.query<{ author_kind: string }>(
          "SELECT author_kind FROM public.bfe_request_messages",
        )
      ).rows[0].author_kind,
    ).toBe("Office");
    expect((await notifications(ids.resident)).unread).toBe(3);
  });
  it("keeps own profile preferences separate from membership and login identity", async () => {
    await rpc(
      ids.resident,
      "public.bfe_save_profile('Sample nickname','+63 900 000 0000','An invented profile.')",
    );
    expect(await rpc(ids.resident, "public.bfe_get_profile()")).toMatchObject({
      display_name: "Sample nickname",
    });
    expect(await rpc(ids.other, "public.bfe_get_profile()")).toMatchObject({
      display_name: "",
      phone: "",
    });
    expect(
      (
        await asUser(ids.other, () =>
          db.query("SELECT * FROM public.bfe_profiles"),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ role: string; name: string }>(
          "SELECT role,name FROM public.members WHERE user_id=$1",
          [ids.resident],
        )
      ).rows[0],
    ).toEqual({ role: "homeowner", name: "Sample resident" });
    await expect(rpc(null, "public.bfe_get_profile()")).rejects.toThrow();
  });
  it("does not duplicate profile notifications/audit when an unchanged save is retried", async () => {
    for (let i = 0; i < 2; i++)
      await rpc(
        ids.resident,
        "public.bfe_save_profile('Sample nickname','','')",
      );
    expect((await notifications(ids.resident)).total).toBe(1);
    expect(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM public.bfe_account_audit",
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("rejects invalid preferences and forged direct updates", async () => {
    await expect(
      rpc(
        ids.resident,
        "public.bfe_save_profile('Sample','invalid-number','')",
      ),
    ).rejects.toThrow();
    await expect(
      asUser(ids.resident, () =>
        db.query(
          "INSERT INTO public.bfe_profiles(user_id,display_name) VALUES($1,'Forged')",
          [ids.other],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(ids.developer, () =>
        db.query("DELETE FROM public.bfe_account_audit"),
      ),
    ).rejects.toThrow();
  });
  it("creates notifications only for entitled recipients from server request events", async () => {
    await create();
    expect((await notifications(ids.resident)).unread).toBe(1);
    expect((await notifications(ids.developer)).unread).toBe(1);
    expect((await notifications(ids.other)).total).toBe(0);
    expect((await notifications(ids.admin)).total).toBe(0);
    await expect(
      asUser(ids.resident, () =>
        db.query(
          "INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES($1,'access','Forged','','/more/profile','forged')",
          [ids.other],
        ),
      ),
    ).rejects.toThrow();
  });
  it("marks only the recipient's rows and preserves read-state idempotency", async () => {
    await create();
    const resident = await notifications(ids.resident);
    const developer = await notifications(ids.developer);
    await rpc(ids.resident, "public.bfe_mark_notifications($1)", [
      [developer.rows[0].id],
    ]);
    expect((await notifications(ids.developer)).unread).toBe(1);
    await rpc(ids.resident, "public.bfe_mark_notifications($1)", [
      [resident.rows[0].id],
    ]);
    expect((await notifications(ids.resident)).unread).toBe(0);
    expect((await notifications(ids.resident, 0, true)).rows).toHaveLength(0);
    expect(
      (
        await asUser(ids.other, () =>
          db.query("SELECT * FROM public.bfe_notifications"),
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("paginates notifications without treating missing pages as new data", async () => {
    for (let i = 0; i < 23; i++)
      await db.query(
        "INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES($1,'account','Synthetic notice','','/more/profile',$2)",
        [ids.resident, `sample-${i}`],
      );
    expect((await notifications(ids.resident)).rows).toHaveLength(20);
    expect((await notifications(ids.resident, 1)).rows).toHaveLength(3);
    expect((await notifications(ids.resident)).unread).toBe(23);
    await rpc(ids.resident, "public.bfe_mark_notifications(NULL)");
    expect((await notifications(ids.resident)).unread).toBe(0);
    await expect(notifications(ids.resident, -1)).rejects.toThrow();
  });
  it("provisions explicit staff grants with audit and without granting developer authority", async () => {
    await expect(grant(ids.admin)).rejects.toThrow();
    await expect(grant(ids.resident)).rejects.toThrow();
    await grant();
    expect(
      await rpc(ids.admin, "public.bfe_can('requests','view','association')"),
    ).toBe(true);
    expect(
      await rpc(ids.admin, "public.bfe_can('requests','status','association')"),
    ).toBe(false);
    expect((await notifications(ids.admin)).unread).toBe(1);
    await grant();
    expect((await notifications(ids.admin)).unread).toBe(1);
    await expect(
      grant(ids.developer, ids.admin, "technical", "manage"),
    ).rejects.toThrow();
    const assignments = await rpc<{ id: string }[]>(
      ids.developer,
      "public.bfe_member_assignments($1)",
      [ids.admin],
    );
    await rpc(
      ids.developer,
      "public.bfe_revoke_assignment($1,'Synthetic revocation')",
      [assignments[0].id],
    );
    expect(
      await rpc(ids.admin, "public.bfe_can('requests','view','association')"),
    ).toBe(false);
    await expect(grant()).rejects.toThrow();
  });
  it("updates member roles/status only through developer review and rejects stale writes", async () => {
    await expect(
      roles(
        ids.resident,
        ids.resident,
        "admin",
        [],
        "Active",
        expectedResident,
      ),
    ).rejects.toThrow();
    await roles(
      ids.developer,
      ids.resident,
      "homeowner",
      ["security"],
      "Active",
      expectedResident,
    );
    expect(await rpc(ids.resident, "public.bfe_current_roles()")).toContain(
      "security",
    );
    await expect(
      roles(
        ids.developer,
        ids.resident,
        "admin",
        [],
        "Active",
        expectedResident,
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ details: { after: { extra_roles: string[] } } }>(
          "SELECT details FROM public.bfe_account_audit WHERE action='Member access updated'",
        )
      ).rows[0].details.after.extra_roles,
    ).toEqual(["security"]);
    expect(
      await rpc(
        ids.developer,
        "coalesce(current_setting('app.claiming',true),'')",
      ),
    ).toBe("");
  });
  it("prevents removal or suspension of the last active developer", async () => {
    const expected = {
      role: "admin",
      extra_roles: ["developer"],
      status: "Active",
    };
    await expect(
      roles(ids.developer, ids.developer, "admin", [], "Active", expected),
    ).rejects.toThrow();
    await expect(
      roles(
        ids.developer,
        ids.developer,
        "admin",
        ["developer"],
        "Suspended",
        expected,
      ),
    ).rejects.toThrow();
    await db.query(
      "UPDATE public.members SET extra_roles=ARRAY['developer'] WHERE user_id=$1",
      [ids.admin],
    );
    await roles(ids.developer, ids.developer, "admin", [], "Active", expected);
    expect(
      await rpc(
        ids.developer,
        "public.bfe_can('finance','manage','association')",
      ),
    ).toBe(false);
  });
  it("provides protected member lookup/directory without proof fields", async () => {
    expect(await rpc(ids.resident, "public.bfe_get_member()")).toMatchObject({
      name: "Sample resident",
      role: "homeowner",
    });
    await expect(
      rpc(ids.resident, "public.bfe_staff_directory('members',0,'','name','')"),
    ).rejects.toThrow();
    const data = await rpc<{ rows: Record<string, unknown>[] }>(
      ids.developer,
      "public.bfe_staff_directory('members',0,'Sample resident','name','')",
    );
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].name).toBe("Sample resident");
    expect(data.rows[0]).not.toHaveProperty("proof");
    await db.query(
      "INSERT INTO public.members(id,user_id,name,role) VALUES('duplicate',$1,'Duplicate','admin')",
      [ids.developer],
    );
    await expect(
      rpc(ids.developer, "public.bfe_get_member()"),
    ).rejects.toThrow();
    await expect(
      rpc(ids.developer, "public.bfe_access_members('',0)"),
    ).rejects.toThrow();
  });
});
