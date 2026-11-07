import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { shuttleDashboardSchema } from "../../packages/shared/src/shuttle";
const db = new PGlite();
const users = {
  resident: "79000000-0000-4000-8000-000000000001",
  other: "79000000-0000-4000-8000-000000000002",
  driver: "79000000-0000-4000-8000-000000000003",
  second: "79000000-0000-4000-8000-000000000004",
  developer: "79000000-0000-4000-8000-000000000005",
};
async function actor<T>(id: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`BEGIN;SET LOCAL ROLE ${id ? "authenticated" : "anon"}`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    const result = await db.query<{ result: T }>(`SELECT ${sql} result`, args);
    await db.exec("COMMIT");
    return result.rows[0]?.result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
async function create(id = users.resident, client = crypto.randomUUID()) {
  return actor<string>(
    id,
    "public.bfe_create_shuttle_request($1,'Synthetic pickup','Synthetic destination',2)",
    [client],
  );
}
async function update(id: string, status: string, user = users.driver) {
  const r = (
    await db.query<{ version: number }>(
      "SELECT version FROM bfe_shuttle_requests WHERE id=$1",
      [id],
    )
  ).rows[0];
  return actor(user, "public.bfe_update_shuttle_request($1,$2,$3)", [
    id,
    r.version,
    status,
  ]);
}
async function dashboard(id: string, history = false, page = 0) {
  return shuttleDashboardSchema.parse(
    await actor(id, "public.bfe_shuttle_dashboard($1,$2)", [history, page]),
  );
}
async function configure(code = "Shuttle 1", driver = users.driver) {
  await actor(
    users.developer,
    "public.bfe_configure_shuttle($1,$2,'Synthetic driver','',true,'Synthetic authorization',4)",
    [code, driver],
  );
  return actor(driver, "public.bfe_shuttle_presence(true)");
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE public.members(id text PRIMARY KEY,user_id uuid,name text,email text,phone text,unit text,title text,role text,extra_roles text[] DEFAULT '{}',status text DEFAULT 'Active',last_seen timestamptz);
 CREATE TABLE public.portal_data(key text PRIMARY KEY,value jsonb);
 CREATE TABLE public.registrations(id text PRIMARY KEY,name text,email text,phone text,unit text,role text,status text,created_at timestamptz,review_note text,proof text);
 CREATE TABLE public.audit_log(id bigint PRIMARY KEY,at timestamptz,actor_role text,action text,source text,ref_no text);`);
  for (const [name, id] of Object.entries(users)) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query(
      "INSERT INTO members(id,user_id,name,role) VALUES($1,$2,$3,$4)",
      [
        name,
        id,
        `Synthetic ${name}`,
        name === "developer"
          ? "developer"
          : ["driver", "second"].includes(name)
            ? "driver"
            : "homeowner",
      ],
    );
  }
  for (const file of [
    "202611050001_request_workflow.sql",
    "202611050002_module_monitoring.sql",
    "202611050003_access_permissions.sql",
    "202611050004_accounts_notifications_developer.sql",
    "202611060005_lot_register.sql",
    "202611060006_customer_workflows.sql",
  ]) {
    await db.exec(
      await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  }
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_shuttle_audit,bfe_shuttle_requests,bfe_shuttles,bfe_notifications;DELETE FROM bfe_request_audit;DELETE FROM bfe_requests;DELETE FROM bfe_access_grants;DELETE FROM bfe_access_assignments;UPDATE members SET status='Active';",
  );
  await configure();
});
afterAll(() => db.close());
it("keeps residents' request details private while sharing roster and queue count", async () => {
  await create();
  const other = await dashboard(users.other);
  expect(other.rows).toEqual([]);
  expect(other.waiting_count).toBe(1);
  expect(other.shuttles[0]).toMatchObject({
    code: "Shuttle 1",
    driver_name: "Synthetic driver",
    driver_id: null,
  });
  expect((await dashboard(users.driver)).rows).toHaveLength(1);
  expect((await dashboard(users.resident)).rows).toHaveLength(1);
  await expect(dashboard(users.other, true)).rejects.toThrow("history access");
  await expect(
    actor(null, "public.bfe_shuttle_dashboard(false,0)"),
  ).rejects.toThrow();
});
it("refuses resident, unrostered driver and developer status spoofing", async () => {
  const id = await create();
  await expect(update(id, "Accepted", users.other)).rejects.toThrow(
    "driver required",
  );
  await expect(update(id, "Accepted", users.second)).rejects.toThrow(
    "driver required",
  );
  await expect(update(id, "Accepted", users.developer)).rejects.toThrow(
    "driver required",
  );
  await expect(update(id, "Picked up")).rejects.toThrow("not permitted");
  await db.exec("SET ROLE authenticated");
  await expect(
    db.exec("UPDATE bfe_shuttle_requests SET status='Picked up'"),
  ).rejects.toThrow();
  await db.exec("RESET ROLE");
});
it("enforces sequential driver actions and independently records arrival versus pickup", async () => {
  const id = await create();
  await update(id, "Accepted");
  await update(id, "On the way");
  await update(id, "Arrived");
  expect((await dashboard(users.resident)).rows[0].status).toBe("Arrived");
  await expect(update(id, "Passenger absent")).rejects.toThrow("not permitted");
  await update(id, "Picked up");
  expect((await dashboard(users.resident)).rows).toHaveLength(0);
  expect((await dashboard(users.driver, true)).rows[0].status).toBe(
    "Picked up",
  );
  expect((await dashboard(users.resident)).latest_outcome?.status).toBe(
    "Picked up",
  );
  expect(
    (
      await db.query("SELECT * FROM bfe_shuttle_audit WHERE request_id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(5);
});
it("expires exactly at the server deadline without a browser or cron, and rejects late acceptance", async () => {
  const id = await create();
  await db.query(
    "UPDATE bfe_shuttle_requests SET created_at=now()-interval '1 hour',expires_at=now() WHERE id=$1",
    [id],
  );
  expect((await dashboard(users.resident)).rows).toEqual([]);
  expect((await dashboard(users.developer, true)).rows[0].status).toBe(
    "Lapsed / Unserved",
  );
  await expect(update(id, "Accepted")).rejects.toThrow("lapsed");
  expect(
    (await db.query<{ n: number }>("SELECT bfe_expire_shuttle_requests() n"))
      .rows[0].n,
  ).toBe(1);
  expect(
    (await db.query<{ n: number }>("SELECT bfe_expire_shuttle_requests() n"))
      .rows[0].n,
  ).toBe(0);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_notifications WHERE title='Shuttle: Lapsed / Unserved'",
      )
    ).rows[0].n,
  ).toBe(1);
});
it("does not reset expiry when a driver accepts and cannot bypass expiry by reporting arrival", async () => {
  const id = await create();
  const initial = (
    await db.query("SELECT expires_at FROM bfe_shuttle_requests WHERE id=$1", [
      id,
    ])
  ).rows[0];
  await update(id, "Accepted");
  expect(
    (
      await db.query(
        "SELECT expires_at FROM bfe_shuttle_requests WHERE id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual(initial);
  await update(id, "On the way");
  await db.query(
    "UPDATE bfe_shuttle_requests SET created_at=now()-interval '61 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
    [id],
  );
  await expect(update(id, "Arrived")).rejects.toThrow("lapsed");
});
it("serializes acceptance, protects version changes, and prevents concurrent assignments", async () => {
  await configure("Shuttle 2", users.second);
  const first = await create();
  const second = await create(users.other);
  await update(first, "Accepted");
  await expect(update(first, "Accepted", users.second)).rejects.toThrow(
    "already assigned",
  );
  await expect(update(second, "Accepted")).rejects.toThrow(
    "current assignment",
  );
  await expect(
    actor(
      users.driver,
      "public.bfe_update_shuttle_request($1,1,'On the way')",
      [first],
    ),
  ).rejects.toThrow("changed");
  await expect(configure()).rejects.toThrow("active assignments");
});
it("deduplicates retries, refuses altered payloads and limits residents to one active request", async () => {
  const client = crypto.randomUUID();
  const id = await create(users.resident, client);
  expect(await create(users.resident, client)).toBe(id);
  await expect(
    actor(
      users.resident,
      "public.bfe_create_shuttle_request($1,'Different pickup','Synthetic destination',2)",
      [client],
    ),
  ).rejects.toThrow("already used");
  await expect(create()).rejects.toThrow("already have an active");
  await expect(update(id, "Cancelled", users.other)).rejects.toThrow();
  await update(id, "Cancelled", users.resident);
  expect(await create()).toBeTruthy();
});
it("removes prior-day requests from resident Today while retaining unresolved driver assignments", async () => {
  const id = await create();
  await update(id, "Accepted");
  await update(id, "On the way");
  await update(id, "Arrived");
  await db.query(
    "UPDATE bfe_shuttle_requests SET created_at=now()-interval '2 days',expires_at=now()-interval '47 hours',arrived_at=now()-interval '10 minutes' WHERE id=$1",
    [id],
  );
  expect((await dashboard(users.resident)).rows).toEqual([]);
  expect((await dashboard(users.driver)).rows[0]).toMatchObject({
    prior_day: true,
    status: "Arrived",
  });
  await update(id, "Passenger absent");
  expect((await dashboard(users.driver, true)).rows[0].status).toBe(
    "Passenger absent",
  );
});
it("fails closed when drivers are suspended or no authorized roster exists", async () => {
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    users.driver,
  ]);
  await expect(create()).rejects.toThrow("No authorized shuttle");
  expect((await dashboard(users.resident)).shuttles).toEqual([]);
  await expect(dashboard(users.driver)).rejects.toThrow("Active membership");
});
it("requires developer authority for roster configuration and exposes eligible accounts only to managers", async () => {
  await expect(
    actor(
      users.resident,
      "public.bfe_configure_shuttle('Shuttle 1',$1,'Synthetic driver','',true,'Synthetic approval',4)",
      [users.driver],
    ),
  ).rejects.toThrow("Developer");
  expect((await dashboard(users.resident)).eligible_drivers).toEqual([]);
  expect((await dashboard(users.developer)).eligible_drivers).toHaveLength(2);
});
it("adds private Helpdesk ideas without granting other residents access", async () => {
  const input = [
    crypto.randomUUID(),
    "Synthetic idea",
    "A synthetic system improvement for testing.",
    "Idea",
  ];
  const request = await actor<Record<string, unknown>>(
    users.resident,
    "public.bfe_create_request($1,$2,$3,$4)",
    input,
  );
  expect(request.category).toBe("Idea");
  expect(
    await actor(users.other, "public.bfe_request_access($1)", [request.id]),
  ).toBe(false);
});
it("keeps the serving driver's name in history after a roster change and filters outcomes server-side", async () => {
  const id = await create();
  await update(id, "Accepted");
  await update(id, "On the way");
  await update(id, "Arrived");
  await update(id, "Picked up");
  await actor(
    users.developer,
    "public.bfe_configure_shuttle('Shuttle 1',$1,'Synthetic replacement','',true,'Synthetic roster revision',4)",
    [users.driver],
  );
  await actor(users.driver, "public.bfe_shuttle_presence(true)");
  expect((await dashboard(users.driver, true)).rows[0].driver_name).toBe(
    "Synthetic driver",
  );
  const filtered = shuttleDashboardSchema.parse(
    await actor(
      users.developer,
      "public.bfe_shuttle_dashboard(true,0,'Lapsed / Unserved')",
    ),
  );
  expect(filtered.total).toBe(0);
  expect(filtered.rows).toEqual([]);
  const next = await create(users.other);
  await db.query(
    "UPDATE bfe_shuttle_requests SET created_at=now()-interval '61 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
    [next],
  );
  const expired = shuttleDashboardSchema.parse(
    await actor(
      users.developer,
      "public.bfe_shuttle_dashboard(true,0,'Lapsed / Unserved')",
    ),
  );
  expect(expired.total).toBe(1);
  expect(expired.rows[0].id).toBe(next);
});
it("requires explicit transport viewing authority for history rather than a summary grant", async () => {
  await actor(
    users.developer,
    "public.bfe_provision_access($1,'data_governance','transport','summary','association','allow','Synthetic summary approval',NULL)",
    [users.other],
  );
  await expect(dashboard(users.other, true)).rejects.toThrow("history access");
  await actor(
    users.developer,
    "public.bfe_provision_access($1,'data_governance','transport','view','association','allow','Synthetic review approval',NULL)",
    [users.other],
  );
  expect((await dashboard(users.other, true)).reviewer).toBe(true);
});
it("enforces approved vehicle capacity at submission and acceptance", async () => {
  await expect(
    actor(
      users.resident,
      "public.bfe_create_shuttle_request($1,'Synthetic pickup','Synthetic destination',5)",
      [crypto.randomUUID()],
    ),
  ).rejects.toThrow("accommodate");
  await actor(
    users.developer,
    "public.bfe_configure_shuttle('Shuttle 2',$1,'Synthetic large shuttle','',true,'Synthetic capacity verification',10)",
    [users.second],
  );
  await actor(users.second, "public.bfe_shuttle_presence(true)");
  const id = await actor<string>(
    users.resident,
    "public.bfe_create_shuttle_request($1,'Synthetic pickup','Synthetic destination',5)",
    [crypto.randomUUID()],
  );
  await expect(update(id, "Accepted")).rejects.toThrow("capacity");
  await update(id, "Accepted", users.second);
  expect((await dashboard(users.resident)).rows[0].shuttle_code).toBe(
    "Shuttle 2",
  );
});
it("requires driver duty and recent presence, without allowing residents to impersonate availability", async () => {
  await actor(
    users.developer,
    "public.bfe_configure_shuttle('Shuttle 2',$1,'Synthetic off-duty driver','',true,'Synthetic roster approval',4)",
    [users.second],
  );
  await expect(
    actor(users.resident, "public.bfe_shuttle_presence(true)"),
  ).rejects.toThrow("driver required");
  await actor(users.driver, "public.bfe_shuttle_presence(false)");
  await expect(create()).rejects.toThrow("No authorized shuttle");
  await actor(users.driver, "public.bfe_shuttle_presence(true)");
  await db.query(
    "UPDATE bfe_shuttles SET last_seen=now()-interval '3 minutes' WHERE driver_id=$1",
    [users.driver],
  );
  expect((await dashboard(users.resident)).shuttles[0].available).toBe(false);
  await expect(create()).rejects.toThrow("No authorized shuttle");
  await actor(users.driver, "public.bfe_shuttle_presence(NULL)");
  const id = await create();
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_notifications WHERE recipient_id=$1",
        [users.second],
      )
    ).rows[0].n,
  ).toBe(0);
  await update(id, "Accepted");
  await expect(
    actor(users.driver, "public.bfe_shuttle_presence(false)"),
  ).rejects.toThrow("current assignment");
});
it("keeps the vehicle busy after pickup until its driver explicitly confirms readiness", async () => {
  const id = await create();
  await update(id, "Accepted");
  await expect(
    actor(users.driver, "public.bfe_shuttle_ready()"),
  ).rejects.toThrow("current assignment");
  await update(id, "On the way");
  await update(id, "Arrived");
  await update(id, "Picked up");
  expect((await dashboard(users.resident)).shuttles[0]).toMatchObject({
    ready: false,
    busy: true,
  });
  const next = await create(users.other);
  await expect(update(next, "Accepted")).rejects.toThrow("readiness");
  await expect(
    actor(users.other, "public.bfe_shuttle_ready()"),
  ).rejects.toThrow("driver required");
  await actor(users.driver, "public.bfe_shuttle_ready()");
  await update(next, "Accepted");
  expect((await dashboard(users.other)).rows[0].status).toBe("Accepted");
});
