import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { sampleBaselineFields } from "../../packages/shared/src/baseline";
const db = new PGlite();
const resident = "81000000-0000-4000-8000-000000000001",
  other = "81000000-0000-4000-8000-000000000002",
  developer = "81000000-0000-4000-8000-000000000003",
  guard = "81000000-0000-4000-8000-000000000004";
const batch = "82000000-0000-4000-8000-000000000001",
  lot = "82000000-0000-4000-8000-000000000002";
async function as<T = unknown>(
  user: string | null,
  expression: string,
  args: unknown[] = [],
) {
  await db.exec(`BEGIN; SET LOCAL ROLE ${user ? "authenticated" : "anon"}`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    const r = await db.query<{ result: T }>(
      `SELECT ${expression} AS result`,
      args,
    );
    await db.exec("COMMIT");
    return r.rows[0]?.result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
async function grant(
  user: string,
  module: string,
  action: string,
  scope = "association",
  effect = "allow",
) {
  const a = await db.query<{ id: string }>(
    "INSERT INTO bfe_access_assignments(user_id,committee_id,approval_reference) VALUES($1,'maintenance','Synthetic test grant') ON CONFLICT(user_id,committee_id) DO UPDATE SET revoked_at=NULL RETURNING id",
    [user],
  );
  await db.query(
    "INSERT INTO bfe_access_grants(assignment_id,module,action,scope,effect,approval_reference) VALUES($1,$2,$3,$4,$5,'Synthetic test grant')",
    [a.rows[0].id, module, action, scope, effect],
  );
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE members(id text PRIMARY KEY,user_id uuid,name text,email text,phone text,unit text,title text,role text,extra_roles text[] DEFAULT '{}',status text DEFAULT 'Active',last_seen timestamptz);
 CREATE TABLE portal_data(key text PRIMARY KEY,value jsonb);CREATE TABLE registrations(id text PRIMARY KEY,name text,email text,phone text,unit text,role text,status text,created_at timestamptz,review_note text,proof text);
 CREATE TABLE audit_log(id bigint PRIMARY KEY,at timestamptz,actor_role text,action text,source text,ref_no text);`);
  await db.exec(
    "CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text UNIQUE);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated,anon;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;CREATE FUNCTION public.synthetic_upload(p_path text) RETURNS text LANGUAGE sql AS $$INSERT INTO storage.objects(bucket_id,name) VALUES('bfe-listing-covers',p_path) RETURNING name$$;",
  );
  for (const [i, id] of [resident, other, developer, guard].entries()) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query(
      "INSERT INTO members(id,user_id,name,role) VALUES($1,$2,'Synthetic member',$3)",
      [
        String(i),
        id,
        i === 2 ? "developer" : i === 3 ? "security" : "homeowner",
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
    "202611060007_feature_records.sql",
    "202611060008_facility_bookings.sql",
    "202611060009_visitor_passes.sql",
    "202611060010_workflow_history.sql",
    "202611060011_activity_participation.sql",
    "202611060012_member_inspection.sql",
    "202611060013_account_interface_preview.sql",
    "202611060014_configurable_access.sql",
    "202611060015_listing_media.sql",
    "202611070016_access_permission_summary.sql",
    "202611070017_conditional_feature_fields.sql",
    "202611070018_vehicle_and_permit_requests.sql",
    "202611070019_published_event_dates.sql",
    "202611070020_incidents_and_board_reports.sql",
    "202611070021_retire_duplicate_modules.sql",
    "202611070022_board_summary_access.sql",
  ])
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "DROP POLICY IF EXISTS synthetic_broad_storage_read ON storage.objects",
  );
  await db.exec("TRUNCATE bfe_tab_rules,bfe_access_managers,storage.objects");
  await db.exec(
    "TRUNCATE bfe_request_messages,bfe_request_audit,bfe_requests,bfe_notifications;",
  );
  await db.exec("TRUNCATE bfe_member_inspection_audit,bfe_member_inspections;");
  await db.exec(
    "UPDATE members SET extra_roles='{}';DELETE FROM members WHERE id='duplicate-synthetic';",
  );
  await db.exec(
    "TRUNCATE bfe_feature_audit,bfe_feature_records,bfe_booking_audit,bfe_bookings,bfe_facilities,bfe_visitor_audit,bfe_visitor_passes,bfe_lot_memberships,bfe_lots,bfe_import_batches CASCADE;DELETE FROM bfe_access_grants;DELETE FROM bfe_access_assignments;UPDATE members SET status='Active';",
  );
  await db.query(
    "INSERT INTO bfe_import_batches(id,checksum,source_name,lot_count,receipt_count,total_centavos) VALUES($1,repeat('8',64),'Synthetic fixture',1,0,0)",
    [batch],
  );
  await db.query(
    "INSERT INTO bfe_lots(id,physical_id,phase,block,lot,admin_unit,registry_status,review_priority,batch_id) VALUES($1,'1-01-001',1,1,1,'Synthetic unit','Synthetic','LOW',$2)",
    [lot, batch],
  );
  await db.query(
    "INSERT INTO bfe_lot_memberships(lot_id,user_id,relationship,state) VALUES($1,$2,'owner','approved')",
    [lot, resident],
  );
});
afterAll(() => db.close());

const migration = (file: string) =>
  readFile(new URL("../migrations/" + file, import.meta.url), "utf8");
beforeAll(async () => {
  await db.exec(await migration("202611090023_resident_service_access.sql"));
  await db.exec(
    await readFile(
      new URL("fixtures/resident-base-owner-policy.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(await migration("202611100045_resident_property_requests.sql"));
});
const dashboard = (actor: string, module: string) =>
  as<{ rows: unknown[]; can_create: boolean; can_review: boolean }>(
    actor,
    "bfe_feature_dashboard($1,'mine',0,'')",
    [module],
  );
const submit = (actor: string, module: string) =>
  as<string>(
    actor,
    "bfe_submit_feature(gen_random_uuid(),$1,'Synthetic property request','Synthetic request details for permission checks',$2,false)",
    [module, sampleBaselineFields(module)],
  );
it("lets homeowners and renters read and submit their own vehicle and permit requests", async () => {
  await db.query("UPDATE members SET role='renter' WHERE user_id=$1", [other]);
  for (const actor of [resident, other])
    for (const module of ["vehicles", "permits"]) {
      expect((await dashboard(actor, module))?.can_create).toBe(true);
      await submit(actor, module);
      expect((await dashboard(actor, module))?.rows).toHaveLength(1);
      expect((await dashboard(actor, module))?.can_review).toBe(false);
    }
});
it("keeps other households and Office review, approval and issuance authority protected", async () => {
  const id = await submit(resident, "vehicles");
  expect((await dashboard(other, "vehicles"))?.rows).toHaveLength(0);
  await expect(
    as(other, "bfe_workflow_history('feature',$1)", [id]),
  ).rejects.toThrow();
  await expect(
    as(
      resident,
      "bfe_review_feature($1,1,'In review','Synthetic unapproved decision')",
      [id],
    ),
  ).rejects.toThrow(/permission/);
  for (const action of ["view", "status", "approve", "manage", "publish"])
    expect(
      await as(resident, "bfe_can('property',$1,'association')", [action]),
    ).toBe(false);
});
it("preserves hidden and read-only tab restrictions", async () => {
  await db.query(
    "INSERT INTO bfe_tab_rules VALUES('user',$1,'property','own','hidden')",
    [resident],
  );
  await expect(dashboard(resident, "vehicles")).rejects.toThrow(/access/);
  await db.query("UPDATE bfe_tab_rules SET mode='view'");
  expect((await dashboard(resident, "permits"))?.can_create).toBe(false);
  await expect(submit(resident, "permits")).rejects.toThrow(/permission/);
});
it("preserves explicit action denials and rejects inactive accounts", async () => {
  await grant(resident, "property", "create", "own", "deny");
  expect((await dashboard(resident, "vehicles"))?.can_create).toBe(false);
  await expect(submit(resident, "vehicles")).rejects.toThrow(/permission/);
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    resident,
  ]);
  await expect(dashboard(resident, "permits")).rejects.toThrow(/Active/);
});
it("can rerun the equivalent policy but refuses to overwrite a customized base rule", async () => {
  const sql = await migration("202611100045_resident_property_requests.sql");
  await db.exec(sql);
  await db.exec(
    "CREATE OR REPLACE FUNCTION bfe_legacy_can_for(p_user_id uuid,p_module text,p_action text,p_scope text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$",
  );
  try {
    await expect(db.exec(sql)).rejects.toThrow(/permissions differ/);
  } finally {
    await db.exec("ROLLBACK");
    await db.exec(await migration("202611090023_resident_service_access.sql"));
    await db.exec(sql);
  }
});

it("patches only the missing Property clause in the owner-supplied function and preserves its metadata", async () => {
  await db.exec(
    await readFile(
      new URL("fixtures/resident-base-owner-policy.sql", import.meta.url),
      "utf8",
    ),
  );
  const query =
    "SELECT pg_get_functiondef('public.bfe_legacy_can_for(uuid,text,text,text)'::regprocedure) AS definition";
  const before = (await db.query<{ definition: string }>(query)).rows[0]
    .definition;
  await db.exec(await migration("202611100045_resident_property_requests.sql"));
  const after = (await db.query<{ definition: string }>(query)).rows[0]
    .definition;
  expect(after).toBe(
    before.replace(
      /p_module\s*=\s*'calendar'/g,
      "p_module IN ('calendar','property')",
    ),
  );
  await db.exec(await migration("202611100045_resident_property_requests.sql"));
  expect(
    (await db.query<{ definition: string }>(query)).rows[0].definition,
  ).toBe(after);
});
