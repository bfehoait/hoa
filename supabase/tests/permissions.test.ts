import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const ids = {
  resident: "31000000-0000-4000-8000-000000000001",
  other: "31000000-0000-4000-8000-000000000002",
  admin: "31000000-0000-4000-8000-000000000003",
  developer: "31000000-0000-4000-8000-000000000004",
  board: "31000000-0000-4000-8000-000000000005",
};
async function asUser<T>(id: string | null, action: () => Promise<T>) {
  await db.exec(`BEGIN; SET LOCAL ROLE ${id ? "authenticated" : "anon"};`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    const value = await action();
    await db.exec("COMMIT");
    return value;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
async function can(
  id: string,
  module: string,
  action: string,
  scope = "association",
) {
  return asUser(
    id,
    async () =>
      (
        await db.query<{ allowed: boolean }>(
          "SELECT public.bfe_can($1,$2,$3) allowed",
          [module, action, scope],
        )
      ).rows[0].allowed,
  );
}
async function grant(
  id: string,
  module: string,
  action: string,
  effect = "allow",
  scope = "association",
  committee = "maintenance",
) {
  const a = await db.query<{ id: string }>(
    "INSERT INTO public.bfe_access_assignments(user_id,committee_id,approval_reference) VALUES($1,$2,'Synthetic approval') ON CONFLICT(user_id,committee_id) DO UPDATE SET approval_reference=excluded.approval_reference RETURNING id",
    [id, committee],
  );
  await db.query(
    "INSERT INTO public.bfe_access_grants(assignment_id,module,action,scope,effect,approval_reference) VALUES($1,$2,$3,$4,$5,'Synthetic approval') ON CONFLICT(assignment_id,module,action,scope) DO UPDATE SET effect=excluded.effect",
    [a.rows[0].id, module, action, scope, effect],
  );
}
async function create() {
  return asUser(
    ids.resident,
    async () =>
      (
        await db.query<{ r: { id: string; version: number } }>(
          "SELECT public.bfe_create_request(gen_random_uuid(),'Sample repair','A synthetic maintenance issue.','Maintenance') r",
        )
      ).rows[0].r,
  );
}

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
    CREATE TABLE public.members(id text PRIMARY KEY,user_id uuid,role text,extra_roles text[] DEFAULT '{}',status text DEFAULT 'Active',unit text);
    CREATE TABLE public.portal_data(key text PRIMARY KEY,value jsonb);
  `);
  for (const [name, id] of Object.entries(ids)) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query(
      "INSERT INTO public.members(id,user_id,role,unit) VALUES($1,$2,$3,'Synthetic unit')",
      [
        name,
        id,
        name === "resident" ? "homeowner" : name === "other" ? "renter" : name,
      ],
    );
  }
  for (const name of [
    "202611050001_request_workflow.sql",
    "202611050002_module_monitoring.sql",
    "202611050003_access_permissions.sql",
  ])
    await db.exec(
      await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    );
}, 30_000);
beforeEach(async () => {
  await db.exec(
    "DELETE FROM public.bfe_access_grants;DELETE FROM public.bfe_access_assignments;DELETE FROM public.bfe_request_audit;DELETE FROM public.bfe_request_messages;DELETE FROM public.bfe_requests;DELETE FROM public.members WHERE id='duplicate';UPDATE public.members SET status='Active';",
  );
});
afterAll(async () => {
  await db.close();
});

describe("explicit committee access in PostgreSQL", () => {
  it("records provisioning and revocation in server-owned history", async () => {
    const before = (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM public.bfe_access_audit",
      )
    ).rows[0].n;
    await grant(ids.admin, "finance", "view");
    await db.exec("UPDATE public.bfe_access_assignments SET revoked_at=now()");
    const after = (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM public.bfe_access_audit",
      )
    ).rows[0].n;
    expect(after - before).toBe(3);
    await expect(
      asUser(ids.developer, () =>
        db.query("DELETE FROM public.bfe_access_audit"),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(ids.admin, () =>
        db.query(
          "INSERT INTO public.bfe_access_audit(database_session,source,operation) VALUES('fake','fake','fake')",
        ),
      ),
    ).rejects.toThrow();
  });
  it("loads workbook metadata without granting anyone access", async () => {
    expect(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM public.bfe_access_workbook",
        )
      ).rows[0].n,
    ).toBe(204);
    expect(await can(ids.admin, "finance", "view")).toBe(false);
    expect(await can(ids.board, "finance", "view")).toBe(false);
    expect(await can(ids.developer, "technical", "monitor")).toBe(true);
    expect(await can(ids.admin, "technical", "monitor")).toBe(false);
  });
  it("returns only own effective permissions and fails closed for anonymous callers", async () => {
    await grant(ids.admin, "finance", "summary");
    const own = await asUser(ids.admin, () =>
      db.query<{ r: { capabilities: unknown[]; committees: string[] } }>(
        "SELECT public.bfe_my_access() r",
      ),
    );
    expect(own.rows[0].r.committees).toEqual(["maintenance"]);
    expect(own.rows[0].r.capabilities).toContainEqual({
      module: "finance",
      action: "summary",
      scope: "association",
    });
    expect(await can(ids.other, "finance", "summary")).toBe(false);
    await expect(
      asUser(null, () => db.query("SELECT public.bfe_my_access()")),
    ).rejects.toThrow();
  });
  it("does not derive actions or scopes from read or summary", async () => {
    await grant(ids.admin, "requests", "view");
    expect(await can(ids.admin, "requests", "view")).toBe(true);
    expect(await can(ids.admin, "requests", "reply")).toBe(false);
    expect(await can(ids.admin, "requests", "view", "assigned")).toBe(false);
    await grant(ids.admin, "finance", "summary");
    expect(await can(ids.admin, "finance", "view")).toBe(false);
  });
  it("denies across overlapping committee grants", async () => {
    await grant(ids.admin, "finance", "view");
    await grant(ids.admin, "finance", "view", "deny", "association", "finance");
    expect(await can(ids.admin, "finance", "view")).toBe(false);
  });
  it("expires, revokes and delays assignments using server time", async () => {
    await grant(ids.admin, "finance", "view");
    await db.exec(
      "UPDATE public.bfe_access_assignments SET starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'",
    );
    expect(await can(ids.admin, "finance", "view")).toBe(false);
    await db.exec(
      "UPDATE public.bfe_access_assignments SET expires_at=NULL,starts_at=now()+interval '1 day'",
    );
    expect(await can(ids.admin, "finance", "view")).toBe(false);
    await db.exec(
      "UPDATE public.bfe_access_assignments SET starts_at=now()-interval '1 day',revoked_at=now()",
    );
    expect(await can(ids.admin, "finance", "view")).toBe(false);
  });
  it("rejects suspension and duplicate membership even with an approved grant", async () => {
    await grant(ids.admin, "finance", "view");
    await db.query(
      "UPDATE public.members SET status='Suspended' WHERE user_id=$1",
      [ids.admin],
    );
    expect(await can(ids.admin, "finance", "view")).toBe(false);
    await db.exec("UPDATE public.members SET status='Active'");
    await db.query(
      "INSERT INTO public.members(id,user_id,role) VALUES('duplicate',$1,'admin')",
      [ids.admin],
    );
    expect(await can(ids.admin, "finance", "view")).toBe(false);
  });
  it("refuses self-provisioning, table reads and fabricated technical grants", async () => {
    for (const id of [ids.resident, ids.admin, ids.developer]) {
      await expect(
        asUser(id, () =>
          db.query("SELECT * FROM public.bfe_access_assignments"),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(id, () =>
          db.query(
            "INSERT INTO public.bfe_access_assignments(user_id,committee_id,approval_reference) VALUES(auth.uid(),'finance','Forged grant')",
          ),
        ),
      ).rejects.toThrow();
    }
    await expect(grant(ids.admin, "technical", "manage")).rejects.toThrow();
  });
  it("preserves resident isolation and requires explicit office request read access", async () => {
    await create();
    for (const id of [ids.other, ids.admin, ids.board])
      expect(
        (await asUser(id, () => db.query("SELECT id FROM public.bfe_requests")))
          .rows,
      ).toHaveLength(0);
    await grant(ids.admin, "requests", "view");
    expect(
      (
        await asUser(ids.admin, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(1);
    await db.exec("UPDATE public.bfe_access_assignments SET revoked_at=now()");
    expect(
      (
        await asUser(ids.admin, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("requires separate reply/status permissions and retains server audit", async () => {
    const r = await create();
    await grant(ids.admin, "requests", "view");
    const reply = () =>
      asUser(ids.admin, () =>
        db.query(
          "SELECT public.bfe_reply_request($1,gen_random_uuid(),'Synthetic office reply')",
          [r.id],
        ),
      );
    const status = (version: number) =>
      asUser(ids.admin, () =>
        db.query("SELECT public.bfe_set_request_status($1,$2,'In progress')", [
          r.id,
          version,
        ]),
      );
    await expect(reply()).rejects.toThrow();
    await expect(status(r.version)).rejects.toThrow();
    await grant(ids.admin, "requests", "reply");
    await reply();
    await expect(status(r.version + 1)).rejects.toThrow();
    await grant(ids.admin, "requests", "status");
    await status(r.version + 1);
    expect(
      (
        await db.query<{ action: string }>(
          "SELECT action FROM public.bfe_request_audit ORDER BY id",
        )
      ).rows.map((x) => x.action),
    ).toEqual(["Created", "Replied", "Status changed"]);
  });
  it("developer monitoring does not grant operational writes", async () => {
    const r = await create();
    expect(
      (
        await asUser(ids.developer, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      asUser(ids.developer, () =>
        db.query("SELECT public.bfe_set_request_status($1,1,'Resolved')", [
          r.id,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("applies explicit own-scope refusals to resident submission", async () => {
    await grant(ids.resident, "requests", "create", "deny", "own");
    await expect(create()).rejects.toThrow();
    expect(await can(ids.resident, "finance", "view", "own")).toBe(true);
    expect(await can(ids.other, "finance", "view", "own")).toBe(false);
  });
});
