import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { visitorDashboardSchema } from "../../packages/shared/src/operations";
// Owner rule (21 November 2026, migration 091): visitor and small delivery
// passes are approved automatically; gate passes need admin approval and only
// then appear for security staff who cannot approve.
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
    "202611100049_business_submission_questions.sql",
    "202611190086_document_inspection_categories.sql",
    "202611190087_buy_sell_categories.sql",
    "202611200088_job_listing_rules.sql",
    "202611200089_garage_sale_form.sql",
    "202611210090_visitor_pass_multi_day.sql",
    "202611090027_resident_passes_amenities.sql",
    "202611210091_pass_approval_rules.sql",
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
async function pass(kind: "visitor" | "small_delivery" | "gate") {
  const from = new Date(Date.now() - 1000).toISOString(),
    until = new Date(Date.now() + 3 * 24 * 3600000).toISOString();
  return as<string>(
    resident,
    "bfe_create_community_pass($1,$2,'Synthetic visitor','Synthetic visit purpose','',$3,$4,$5,'commute','inbound',1,$6)",
    [
      crypto.randomUUID(),
      lot,
      from,
      until,
      kind,
      kind === "gate" ? "Synthetic boxes" : "",
    ],
  );
}
const statusOf = async (id: string) =>
  (
    await db.query<{ status: string }>(
      "SELECT status FROM bfe_visitor_passes WHERE id=$1",
      [id],
    )
  ).rows[0].status;
const securityView = async (user: string) =>
  visitorDashboardSchema
    .parse(await as(user, "bfe_community_pass_dashboard(true,0)"))
    .rows.map((r) => r.id);
it("approves visitor and small delivery passes automatically and keeps gate passes pending", async () => {
  await grant(resident, "security", "create", "own");
  await grant(resident, "security", "view", "own");
  const visitorId = await pass("visitor");
  const deliveryId = await pass("small_delivery");
  const gateId = await pass("gate");
  expect(await statusOf(visitorId)).toBe("Approved");
  expect(await statusOf(deliveryId)).toBe("Approved");
  expect(await statusOf(gateId)).toBe("Pending");
  const audit = await db.query<{ note: string }>(
    "SELECT note FROM bfe_visitor_audit WHERE pass_id=$1 AND action='Approved'",
    [visitorId],
  );
  expect(audit.rows[0]?.note).toMatch(/Approved automatically/);
});
it("shows a gate pass to security only after an admin approves it", async () => {
  await grant(resident, "security", "create", "own");
  await grant(resident, "security", "view", "own");
  await grant(guard, "security", "view");
  await grant(guard, "security", "status");
  await grant(developer, "security", "view");
  await grant(developer, "security", "approve");
  const visitorId = await pass("visitor");
  const gateId = await pass("gate");
  const guardBefore = await securityView(guard);
  expect(guardBefore).toContain(visitorId);
  expect(guardBefore).not.toContain(gateId);
  expect(await securityView(developer)).toContain(gateId);
  await as(
    developer,
    "bfe_update_visitor_pass($1,1,'Approved','Synthetic approval')",
    [gateId],
  );
  expect(await statusOf(gateId)).toBe("Approved");
  expect(await securityView(guard)).toContain(gateId);
});
