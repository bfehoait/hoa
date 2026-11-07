import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Real embedded PostgreSQL with invented identities; never a live connection.
const db = new PGlite();
const ids = {
  resident: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  admin: "10000000-0000-4000-8000-000000000003",
  developer: "10000000-0000-4000-8000-000000000004",
  guard: "10000000-0000-4000-8000-000000000005",
};
const clientId = "20000000-0000-4000-8000-000000000001";
type RequestRow = {
  id: string;
  owner_id: string;
  status: string;
  version: number;
};
async function asUser<T>(id: string | null, action: () => Promise<T>) {
  await db.exec(`BEGIN; SET LOCAL ROLE ${id ? "authenticated" : "anon"};`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
      id ?? "",
    ]);
    const result = await action();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
async function create(id = ids.resident) {
  return asUser(
    id,
    async () =>
      (
        await db.query<{ record: RequestRow }>(
          "SELECT public.bfe_create_request($1,'Sample maintenance','An invented maintenance request.','Maintenance') AS record",
          [clientId],
        )
      ).rows[0].record,
  );
}
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
    CREATE TABLE public.members(id text PRIMARY KEY, user_id uuid, role text,
      extra_roles text[] DEFAULT '{}', status text DEFAULT 'Active', unit text,
      name text, email text, phone text, last_seen timestamptz);
    CREATE TABLE public.portal_data(key text PRIMARY KEY, value jsonb);
    CREATE TABLE public.registrations(id text PRIMARY KEY, name text, email text,phone text,
      unit text,role text,status text,created_at timestamptz,review_note text,proof text);
    CREATE TABLE public.audit_log(id bigint PRIMARY KEY, at timestamptz,actor_role text,
      action text,source text,ref_no text);
  `);
  for (const [name, id] of Object.entries(ids)) {
    await db.query("INSERT INTO auth.users VALUES ($1)", [id]);
    await db.query(
      "INSERT INTO public.members(id,user_id,role,unit) VALUES($1,$2,$3,'Sample unit')",
      [
        name,
        id,
        name === "resident"
          ? "homeowner"
          : name === "other"
            ? "renter"
            : name === "guard"
              ? "security"
              : name,
      ],
    );
  }
  const migration = await readFile(
    new URL("../migrations/202611050001_request_workflow.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611050002_module_monitoring.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30_000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE public.bfe_request_audit,public.bfe_request_messages,public.bfe_requests,public.portal_data,public.registrations,public.audit_log; UPDATE public.members SET status='Active',extra_roles='{}'; DELETE FROM public.members WHERE id='duplicate';",
  );
});
afterAll(async () => {
  await db.close();
});

describe("request database refusal and transaction tests", () => {
  it("isolates residents and refuses anonymous reads", async () => {
    const record = await create();
    expect(record.owner_id).toBe(ids.resident);
    expect(
      (
        await asUser(ids.resident, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await asUser(ids.other, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(null, () => db.query("SELECT id FROM public.bfe_requests")),
    ).rejects.toThrow(/permission denied/);
  });
  it("requires server operations even for an administrator", async () => {
    await create();
    await expect(
      asUser(ids.admin, () =>
        db.exec("UPDATE public.bfe_requests SET status='Resolved'"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(ids.admin, () =>
        db.exec(
          "INSERT INTO public.bfe_request_audit(request_id,actor_id,action) SELECT id,owner_id,'Created' FROM public.bfe_requests",
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("deduplicates submission retries and rejects conflicting reuse", async () => {
    const first = await create();
    expect((await create()).id).toBe(first.id);
    expect(
      (await db.query("SELECT id FROM public.bfe_request_audit")).rows,
    ).toHaveLength(1);
    await expect(
      asUser(ids.resident, () =>
        db.query(
          "SELECT public.bfe_create_request($1,'Changed title','An invented maintenance request.','Maintenance')",
          [clientId],
        ),
      ),
    ).rejects.toThrow(/different details/);
  });
  it("shares a thread with the office while keeping another resident out", async () => {
    const request = await create();
    await asUser(ids.admin, () =>
      db.query(
        "SELECT public.bfe_reply_request($1,$2,'Office received this request.')",
        [request.id, clientId],
      ),
    );
    await asUser(ids.admin, () =>
      db.query(
        "SELECT public.bfe_reply_request($1,$2,'Office received this request.')",
        [request.id, clientId],
      ),
    );
    expect(
      (
        await asUser(ids.resident, () =>
          db.query("SELECT author_kind,body FROM public.bfe_request_messages"),
        )
      ).rows,
    ).toEqual([
      { author_kind: "Office", body: "Office received this request." },
    ]);
    expect(
      (
        await asUser(ids.other, () =>
          db.query("SELECT id FROM public.bfe_request_messages"),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(ids.other, () =>
        db.query(
          "SELECT public.bfe_reply_request($1,$2,'Unauthorized reply')",
          [request.id, clientId],
        ),
      ),
    ).rejects.toThrow(/cannot reply/);
  });
  it("keeps status changes office-owned and rejects stale versions", async () => {
    const request = await create();
    await expect(
      asUser(ids.resident, () =>
        db.query("SELECT public.bfe_set_request_status($1,1,'Resolved')", [
          request.id,
        ]),
      ),
    ).rejects.toThrow(/Office access/);
    await asUser(ids.admin, () =>
      db.query("SELECT public.bfe_set_request_status($1,1,'In progress')", [
        request.id,
      ]),
    );
    await expect(
      asUser(ids.admin, () =>
        db.query("SELECT public.bfe_set_request_status($1,1,'Resolved')", [
          request.id,
        ]),
      ),
    ).rejects.toThrow(/changed/);
    expect(
      (
        await db.query<{ status: string }>(
          "SELECT status FROM public.bfe_requests",
        )
      ).rows[0].status,
    ).toBe("In progress");
    expect(
      (
        await db.query(
          "SELECT id FROM public.bfe_request_audit WHERE action='Status changed'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("allows developer monitoring without granting operational writes", async () => {
    const request = await create();
    expect(
      (
        await asUser(ids.developer, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await asUser(ids.developer, () =>
          db.query("SELECT id FROM public.bfe_request_audit"),
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      asUser(ids.developer, () =>
        db.query("SELECT public.bfe_set_request_status($1,1,'Resolved')", [
          request.id,
        ]),
      ),
    ).rejects.toThrow(/Office access/);
    await expect(
      asUser(ids.developer, () =>
        db.query("SELECT public.bfe_reply_request($1,$2,'Developer reply')", [
          request.id,
          clientId,
        ]),
      ),
    ).rejects.toThrow(/cannot reply/);
  });
  it("blocks revoked and duplicate memberships at the database", async () => {
    const request = await create();
    await db.query(
      "UPDATE public.members SET status='Suspended' WHERE user_id=$1",
      [ids.resident],
    );
    expect(
      (
        await asUser(ids.resident, () =>
          db.query("SELECT id FROM public.bfe_requests"),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(ids.resident, () =>
        db.query(
          "SELECT public.bfe_reply_request($1,$2,'Reply after revocation')",
          [request.id, clientId],
        ),
      ),
    ).rejects.toThrow(/cannot reply/);
    await db.query(
      "INSERT INTO public.members(id,user_id,role) VALUES('duplicate',$1,'homeowner')",
      [ids.other],
    );
    await expect(create(ids.other)).rejects.toThrow(/active resident/);
  });
  it("rejects invalid input and leaves no partial request or audit event", async () => {
    await expect(
      asUser(ids.resident, () =>
        db.query("SELECT public.bfe_create_request($1,$2,$3,'Maintenance')", [
          clientId,
          "\n\n\n",
          "\n".repeat(12),
        ]),
      ),
    ).rejects.toThrow(/Check the request/);
    await expect(
      asUser(ids.resident, () =>
        db.query(
          "SELECT public.bfe_create_request($1,'No','short','Invalid')",
          [clientId],
        ),
      ),
    ).rejects.toThrow(/Check the request/);
    expect(
      (await db.query("SELECT id FROM public.bfe_requests")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("SELECT id FROM public.bfe_request_audit")).rows,
    ).toHaveLength(0);
  });
  it("recognizes explicitly assigned extra admin roles without trusting client metadata", async () => {
    const request = await create();
    await expect(
      asUser(ids.guard, () =>
        db.query("SELECT public.bfe_set_request_status($1,1,'Resolved')", [
          request.id,
        ]),
      ),
    ).rejects.toThrow(/Office access/);
    await db.query(
      "UPDATE public.members SET extra_roles=ARRAY['admin'] WHERE user_id=$1",
      [ids.guard],
    );
    await asUser(ids.guard, () =>
      db.query("SELECT public.bfe_set_request_status($1,1,'Resolved')", [
        request.id,
      ]),
    );
    expect(
      (
        await db.query<{ status: string }>(
          "SELECT status FROM public.bfe_requests",
        )
      ).rows[0].status,
    ).toBe("Resolved");
  });
  it("limits new submissions and refuses whitespace-only replies", async () => {
    const request = await create();
    await expect(
      asUser(ids.resident, () =>
        db.query("SELECT public.bfe_reply_request($1,$2,$3)", [
          request.id,
          clientId,
          "\n\n",
        ]),
      ),
    ).rejects.toThrow(/Enter a reply/);
    for (let index = 2; index <= 5; index++)
      await asUser(ids.resident, () =>
        db.query(
          "SELECT public.bfe_create_request($1,'Sample request','Synthetic request details.','Support')",
          [`20000000-0000-4000-8000-${String(index).padStart(12, "0")}`],
        ),
      );
    await expect(
      asUser(ids.resident, () =>
        db.query(
          "SELECT public.bfe_create_request($1,'Sample request','Synthetic request details.','Support')",
          ["20000000-0000-4000-8000-000000000006"],
        ),
      ),
    ).rejects.toThrow(/wait before submitting/);
    expect(
      (await db.query("SELECT id FROM public.bfe_requests")).rows,
    ).toHaveLength(5);
    expect(
      (await db.query("SELECT id FROM public.bfe_request_messages")).rows,
    ).toHaveLength(0);
  });
});

describe("developer module monitoring", () => {
  async function monitor(section: string, page = 0) {
    return asUser(
      ids.developer,
      async () =>
        (
          await db.query<{
            result: {
              source: string;
              present: boolean;
              total: number | null;
              rows: Array<{
                fields: Record<string, unknown>;
                reference: string;
              }>;
            };
          }>("SELECT public.bfe_monitor_module($1,$2) AS result", [
            section,
            page,
          ])
        ).rows[0].result,
    );
  }
  it("requires developer, independently of admin, and honors revocation", async () => {
    await expect(
      asUser(ids.admin, () =>
        db.query("SELECT public.bfe_monitor_module('members',0)"),
      ),
    ).rejects.toThrow(/developer assignment/);
    await expect(
      asUser(null, () =>
        db.query("SELECT public.bfe_monitor_module('members',0)"),
      ),
    ).rejects.toThrow(/permission denied/);
    expect((await monitor("members")).total).toBe(5);
    await db.query(
      "UPDATE public.members SET status='Suspended' WHERE user_id=$1",
      [ids.developer],
    );
    await expect(monitor("members")).rejects.toThrow(/developer assignment/);
  });
  it("paginates recorded source data and excludes secrets, proof and nested content", async () => {
    const rows: Array<Record<string, unknown>> = Array.from(
      { length: 25 },
      (_, i) => ({
        id: `sample-${i}`,
        title: `Sample request ${i}`,
        unit: "Sample A",
        status: "Open",
        body: "Invented details",
        password: "forbidden-sample-value",
        proof: "forbidden-proof",
        nested: { secret: "not-returned" },
      }),
    );
    rows[1] = {
      ...rows[1],
      title: { secret: "forbidden-title" },
      unit: { secret: "forbidden-unit" },
      status: { secret: "forbidden-status" },
      at: { secret: "forbidden-date" },
    };
    await db.query("INSERT INTO public.portal_data VALUES('requests',$1)", [
      JSON.stringify(rows),
    ]);
    const first = await monitor("requests");
    const second = await monitor("requests", 1);
    expect(first.total).toBe(25);
    expect(first.rows).toHaveLength(20);
    expect(second.rows).toHaveLength(5);
    expect(second.rows[0].reference).toBe("sample-20");
    expect(first.rows[0].fields.body).toBe("Invented details");
    expect(JSON.stringify(first)).not.toContain("forbidden");
    expect(first.rows[0].fields).not.toHaveProperty("nested");
    expect(
      (
        await db.query<{ value: unknown }>(
          "SELECT value FROM public.portal_data WHERE key='requests'",
        )
      ).rows[0].value,
    ).toEqual(rows);
  });
  it("keeps election ballots and eligibility out of developer responses", async () => {
    await db.query("INSERT INTO public.portal_data VALUES('election',$1)", [
      JSON.stringify({
        id: "sample-election",
        title: "Sample election",
        status: "Draft",
        ballots: [{ voter: "private-test-voter" }],
        votes: 123,
        eligible: ["private-test-voter"],
      }),
    ]);
    const result = await monitor("election");
    expect(result.rows[0].fields).toEqual({
      id: "sample-election",
      title: "Sample election",
      status: "Draft",
    });
    expect(JSON.stringify(result)).not.toContain("private-test-voter");
  });
  it("distinguishes absent and empty sections and refuses arbitrary sources or pages", async () => {
    expect(await monitor("hotlines")).toMatchObject({
      present: false,
      total: null,
      rows: [],
    });
    await db.query("INSERT INTO public.portal_data VALUES('hotlines','[]')");
    expect(await monitor("hotlines")).toMatchObject({
      present: true,
      total: 0,
      rows: [],
    });
    await expect(monitor("settings")).rejects.toThrow(
      /Unsupported monitoring section/,
    );
    await expect(monitor("auth.users")).rejects.toThrow(
      /Unsupported monitoring section/,
    );
    await expect(monitor("hotlines", -1)).rejects.toThrow(
      /Unsupported monitoring page/,
    );
  });
  it("reads new request history without introducing operational developer authority", async () => {
    await create();
    expect((await monitor("bfe_requests")).rows).toHaveLength(1);
    expect((await monitor("bfe_request_audit")).rows[0].fields.action).toBe(
      "Created",
    );
    await db.query(
      "INSERT INTO public.registrations(id,name,status,proof) VALUES('sample-registration','Sample applicant','Pending','forbidden-proof')",
    );
    expect(JSON.stringify(await monitor("registrations"))).not.toContain(
      "forbidden-proof",
    );
  });
});
