import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
// Migrations 094/095: Finance, Grievance and Maintenance committees get their area by
// default, and Grievance/Maintenance members only handle their Help desk
// categories (visibility, replies, status, handling and notifications).
const db = new PGlite();
const resident = "81000000-0000-4000-8000-000000000001",
  other = "81000000-0000-4000-8000-000000000002",
  developer = "81000000-0000-4000-8000-000000000003",
  guard = "81000000-0000-4000-8000-000000000004";
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
    "202611100048_helpdesk_business_forms.sql",
    "202611100049_business_submission_questions.sql",
    "202611190086_document_inspection_categories.sql",
    "202611190087_buy_sell_categories.sql",
    "202611200088_job_listing_rules.sql",
    "202611200089_garage_sale_form.sql",
    "202611210090_visitor_pass_multi_day.sql",
    "202611230092_mandatory_document_downloads.sql",
    "202611240093_document_download_requests.sql",
    "202611240094_committee_area_access.sql",
    "202611240095_office_area_roles.sql",
  ])
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
}, 30000);
afterAll(() => db.close());
const grievance = "81000000-0000-4000-8000-000000000011",
  maintenance = "81000000-0000-4000-8000-000000000012",
  finance = "81000000-0000-4000-8000-000000000013",
  fullAdmin = "81000000-0000-4000-8000-000000000014";
async function addAdmin(id: string, name: string) {
  await db.query("INSERT INTO auth.users VALUES($1) ON CONFLICT DO NOTHING", [
    id,
  ]);
  await db.query(
    "INSERT INTO members(id,user_id,name,role) VALUES($1,$2,$3,'admin') ON CONFLICT DO NOTHING",
    [name, id, name],
  );
}
async function join(user: string, committee: string) {
  await db.query(
    "INSERT INTO bfe_access_assignments(user_id,committee_id,approval_reference) VALUES($1,$2,'Synthetic committee test') ON CONFLICT(user_id,committee_id) DO UPDATE SET revoked_at=NULL",
    [user, committee],
  );
}
async function newRequest(category: string) {
  const r = await as<{ id: string; version: number }>(
    resident,
    "bfe_create_request($1,$2,'A synthetic request for committee tests.',$3)",
    [crypto.randomUUID(), `Synthetic ${category}`, category],
  );
  return r!;
}
const visible = async (user: string) =>
  (
    await (async () => {
      await db.exec("BEGIN; SET LOCAL ROLE authenticated");
      try {
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
          user,
        ]);
        const r = await db.query<{ category: string }>(
          "SELECT category FROM bfe_requests ORDER BY category",
        );
        await db.exec("COMMIT");
        return r.rows;
      } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
      }
    })()
  ).map((r) => r.category);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_request_messages,bfe_request_audit,bfe_requests,bfe_notifications CASCADE",
  );
  await db.exec(
    "DELETE FROM bfe_access_grants; DELETE FROM bfe_access_assignments; DELETE FROM bfe_tab_rules WHERE subject_kind<>'committee' AND NOT (subject_kind='role' AND subject_id IN ('finance','grievance','maintenance'));",
  );
  await addAdmin(grievance, "grievance-admin");
  await addAdmin(maintenance, "maintenance-admin");
  await addAdmin(finance, "finance-admin");
  await addAdmin(fullAdmin, "full-admin");
  await join(grievance, "grievance");
  await join(maintenance, "maintenance");
  await join(finance, "finance");
  await db.query(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('user',$1,'requests','association','edit')",
    [fullAdmin],
  );
  await grant(resident, "requests", "create", "own");
  await grant(resident, "requests", "view", "own");
});
it("gives each committee its area by default", async () => {
  const can = (user: string, module: string, action: string) =>
    as<boolean>(user, "bfe_can($1,$2,'association')", [module, action]);
  expect(await can(finance, "finance", "view")).toBe(true);
  expect(await can(finance, "requests", "view")).toBe(false);
  expect(await can(grievance, "requests", "reply")).toBe(true);
  expect(await can(grievance, "requests", "status")).toBe(true);
  expect(await can(grievance, "finance", "view")).toBe(false);
  expect(await can(maintenance, "requests", "view")).toBe(true);
});
it("limits Help desk visibility to each committee's categories", async () => {
  await newRequest("Maintenance");
  await newRequest("Complaint");
  await newRequest("Concern");
  await newRequest("Document");
  expect(await visible(grievance)).toEqual(["Complaint", "Concern"]);
  expect(await visible(maintenance)).toEqual(["Maintenance"]);
  expect(await visible(finance)).toEqual([]);
  expect(await visible(fullAdmin)).toEqual([
    "Complaint",
    "Concern",
    "Document",
    "Maintenance",
  ]);
});
it("refuses status, replies and handling outside the committee's categories", async () => {
  const leak = await newRequest("Maintenance");
  const complaint = await newRequest("Complaint");
  await expect(
    as(grievance, "bfe_set_request_status($1,1,'In progress')", [leak.id]),
  ).rejects.toThrow(/outside your committee/);
  await as(grievance, "bfe_set_request_status($1,1,'In progress')", [
    complaint.id,
  ]);
  await expect(
    as(grievance, "bfe_reply_request($1,$2,'Synthetic reply')", [
      leak.id,
      crypto.randomUUID(),
    ]),
  ).rejects.toThrow(/cannot reply/);
  await as(maintenance, "bfe_reply_request($1,$2,'Synthetic reply')", [
    leak.id,
    crypto.randomUUID(),
  ]);
  await expect(
    as(
      grievance,
      "bfe_save_request_handling($1,$2,0,'Normal',NULL,'','Synthetic ref')",
      [leak.id, 2],
    ),
  ).rejects.toThrow(/outside your committee/);
});
it("notifies only committee members who can open the request", async () => {
  await newRequest("Maintenance");
  const recipients = (
    await db.query<{ recipient_id: string }>(
      "SELECT recipient_id FROM bfe_notifications WHERE path='/office/requests'",
    )
  ).rows.map((r) => r.recipient_id);
  expect(recipients).toContain(maintenance);
  expect(recipients).toContain(fullAdmin);
  expect(recipients).not.toContain(grievance);
  expect(recipients).not.toContain(finance);
});
it("does not widen a Grievance member through an all-admins rule, but ordinary admins still see everything", async () => {
  await db.query(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('role','admin','requests','association','edit')",
  );
  await newRequest("Maintenance");
  await newRequest("Complaint");
  expect(await visible(grievance)).toEqual(["Complaint"]);
  expect(await visible(finance)).toEqual(["Complaint", "Maintenance"]);
});

// Migration 095: Finance, Grievance and Maintenance as member roles.
const financeRole = "81000000-0000-4000-8000-000000000021",
  grievanceRole = "81000000-0000-4000-8000-000000000022",
  maintenanceRole = "81000000-0000-4000-8000-000000000023";
async function addRole(id: string, name: string, role: string) {
  await db.query("INSERT INTO auth.users VALUES($1) ON CONFLICT DO NOTHING", [
    id,
  ]);
  await db.query(
    "INSERT INTO members(id,user_id,name,role) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,extra_roles='{}'",
    [name, id, name, role],
  );
}
async function addRoleMembers() {
  await addRole(financeRole, "finance-role", "finance");
  await addRole(grievanceRole, "grievance-role", "grievance");
  await addRole(maintenanceRole, "maintenance-role", "maintenance");
}
it("treats the office area roles as office staff limited to their area", async () => {
  await addRoleMembers();
  const roles = await as<string[]>(grievanceRole, "bfe_current_roles()");
  expect([...roles!].sort()).toEqual(["admin", "grievance"]);
  const can = (user: string, module: string, action: string) =>
    as<boolean>(user, "bfe_can($1,$2,'association')", [module, action]);
  expect(await can(financeRole, "finance", "view")).toBe(true);
  expect(await can(financeRole, "requests", "view")).toBe(false);
  expect(await can(grievanceRole, "requests", "status")).toBe(true);
  expect(await can(grievanceRole, "finance", "view")).toBe(false);
  expect(await can(maintenanceRole, "requests", "reply")).toBe(true);
});
it("limits the Grievance and Maintenance roles to their Help desk categories", async () => {
  await addRoleMembers();
  const maint = await newRequest("Maintenance");
  await newRequest("Complaint");
  await newRequest("Document");
  expect(await visible(grievanceRole)).toEqual(["Complaint"]);
  expect(await visible(maintenanceRole)).toEqual(["Maintenance"]);
  expect(await visible(financeRole)).toEqual([]);
  await expect(
    as(grievanceRole, "bfe_set_request_status($1,1,'In progress')", [maint.id]),
  ).rejects.toThrow(/outside your committee/);
  await as(maintenanceRole, "bfe_set_request_status($1,1,'In progress')", [
    maint.id,
  ]);
  const recipients = (
    await db.query<{ recipient_id: string }>(
      "SELECT recipient_id FROM bfe_notifications WHERE path='/office/requests' AND event_key IN (SELECT 'request-audit:'||id FROM bfe_request_audit WHERE request_id=$1 AND action='Created')",
      [maint.id],
    )
  ).rows.map((r) => r.recipient_id);
  expect(recipients).toContain(maintenanceRole);
  expect(recipients).not.toContain(grievanceRole);
  expect(recipients).not.toContain(financeRole);
});
it("does not widen the roles through rules written for all office admins", async () => {
  await addRoleMembers();
  await db.query(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('role','admin','requests','association','edit'),('role','admin','finance','association','edit')",
  );
  await newRequest("Maintenance");
  await newRequest("Complaint");
  expect(await visible(grievanceRole)).toEqual(["Complaint"]);
  expect(await visible(financeRole)).toEqual([]);
  expect(
    await as<boolean>(grievanceRole, "bfe_can('finance','view','association')"),
  ).toBe(false);
  // A recorded office admin keeps the all-admins rule.
  expect(await visible(finance)).toEqual(["Complaint", "Maintenance"]);
});
it("keeps document download approvals with recorded office admins", async () => {
  await addRoleMembers();
  await expect(
    as(grievanceRole, "bfe_document_download_requests_queue(0)"),
  ).rejects.toThrow(/available to admins/);
  await expect(
    as(financeRole, "bfe_document_download_history(0)"),
  ).rejects.toThrow(/available to admins/);
  expect(
    await as(fullAdmin, "bfe_document_download_requests_queue(0)"),
  ).toBeTruthy();
});
it("lets an access manager assign and filter the new roles", async () => {
  await addRoleMembers();
  await db.query("UPDATE members SET role='admin' WHERE user_id=$1", [
    grievanceRole,
  ]);
  const expected = JSON.stringify({
    role: "admin",
    extra_roles: [],
    status: "Active",
  });
  await as(
    developer,
    "bfe_update_member_access($1,'grievance',ARRAY['homeowner','maintenance'],'Active','Synthetic role change',$2::jsonb)",
    [grievanceRole, expected],
  );
  const saved = await db.query<{ role: string; extra_roles: string[] }>(
    "SELECT role,extra_roles FROM members WHERE user_id=$1",
    [grievanceRole],
  );
  expect(saved.rows[0]).toEqual({
    role: "grievance",
    extra_roles: ["homeowner", "maintenance"],
  });
  await expect(
    as(
      developer,
      "bfe_update_member_access($1,'treasurer','{}','Active','Synthetic role change',$2::jsonb)",
      [
        grievanceRole,
        JSON.stringify({
          role: "grievance",
          extra_roles: ["homeowner", "maintenance"],
          status: "Active",
        }),
      ],
    ),
  ).rejects.toThrow(/Check the role/);
  const filtered = await as<{ rows: { user_id: string }[] }>(
    developer,
    "bfe_filtered_access_members('', 'finance', 0)",
  );
  expect(filtered!.rows.map((r) => r.user_id)).toEqual([financeRole]);
});
