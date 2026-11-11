import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import {
  memberWorkspaceSchema,
  type MemberWorkspace,
} from "../../packages/shared/src/member-management";
import { accountLotMatchSchema } from "../../packages/shared/src/registry";
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

beforeAll(async () => {
  for (const file of [
    "202611090023_resident_service_access.sql",
    "202611090037_reviewed_account_lot_link.sql",
    "202611100046_office_member_management.sql",
  ])
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
});
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_member_detail_changes,bfe_profiles; UPDATE members SET name='Synthetic member',phone=NULL,unit=NULL,title=NULL",
  );
});
const workspace = async (id = "0", actor = developer, page = 0) =>
  memberWorkspaceSchema.parse(
    await as(actor, "bfe_office_member_workspace($1,$2)", [id, page]),
  );
const update = async (
  expected: MemberWorkspace["expected"],
  actor = developer,
  name = "Synthetic corrected member",
) =>
  memberWorkspaceSchema.parse(
    await as(
      actor,
      "bfe_update_member_details('0',$1,$2,'+00 123 456','SYNTHETIC UNIT','Synthetic position','Synthetic verified correction')",
      [expected, name],
    ),
  );
it("corrects recorded details with before/after history and safe retries without changing account access or profile preferences", async () => {
  await as(
    resident,
    "bfe_save_profile('Synthetic preferred name','+00 555','Synthetic biography')",
  );
  const before = await workspace();
  const after = await update(before.expected);
  expect(after.member.name).toBe("Synthetic corrected member");
  expect(after.member.phone).toBe("+00 123 456");
  expect(after.member.email).toBe(before.member.email);
  expect(after.member.user_id).toBe(before.member.user_id);
  expect(after.member.role).toBe(before.member.role);
  expect(after.profile?.display_name).toBe("Synthetic preferred name");
  expect(after.profile?.phone).toBe("+00 555");
  expect(after.history_total).toBe(1);
  expect(after.history[0].before_values.name).toBe(before.member.name);
  expect(after.history[0].after_values.unit).toBe("SYNTHETIC UNIT");
  expect((await update(before.expected)).history_total).toBe(1);
});
it("requires staff view/manage authority, keeps history permission-scoped and protects developer details", async () => {
  await expect(workspace("0", resident)).rejects.toThrow(
    /Office member access/,
  );
  const before = await workspace();
  await expect(update(before.expected, resident)).rejects.toThrow(/permission/);
  await db.query("UPDATE members SET role='admin' WHERE user_id=$1", [guard]);
  await grant(guard, "people", "view");
  const readOnly = await workspace("0", guard);
  expect(readOnly.can_edit).toBe(false);
  expect(readOnly.can_history).toBe(false);
  expect(readOnly.properties).toEqual([]);
  await expect(update(before.expected, guard)).rejects.toThrow(/permission/);
  await grant(guard, "people", "manage");
  expect((await workspace("2", guard)).can_edit).toBe(false);
  const developerRecord = await workspace("2");
  await expect(
    as(
      guard,
      "bfe_update_member_details('2',$1,'Synthetic protected rename','','','','Synthetic unauthorized correction')",
      [developerRecord.expected],
    ),
  ).rejects.toThrow(/protected/);
});
it("rejects stale snapshots and invalid phone data without partial writes", async () => {
  const before = await workspace();
  await update(before.expected);
  await expect(
    update(before.expected, developer, "Synthetic stale edit"),
  ).rejects.toThrow(/Member changed/);
  const latest = await workspace();
  await expect(
    as(
      developer,
      "bfe_update_member_details('0',$1,'Synthetic invalid phone','<invalid>','','','Synthetic attempted correction')",
      [latest.expected],
    ),
  ).rejects.toThrow(/Check/);
  expect((await workspace()).history_total).toBe(1);
});
it("shows verified relationships and link history after the existing independent Office linking service confirms them", async () => {
  const match = accountLotMatchSchema.parse(
    await as(developer, "bfe_account_lot_match($1,'1-01-001')", [other]),
  );
  const before = await workspace("1");
  await as(developer, "bfe_office_link_member_property('1',$1,$2,$3,$4,$5)", [
    before.expected,
    lot,
    match.candidate!.version,
    "household",
    "Synthetic reviewed relationship",
  ]);
  const result = await workspace("1");
  expect(result.properties).toHaveLength(1);
  expect(result.properties[0].state).toBe("approved");
  expect(
    result.link_history.some((h) => h.action === "Membership approved"),
  ).toBe(true);
  expect((await workspace("2")).can_link).toBe(false);
});
it("supports unlinked member records and pages correction history without exposing raw private tables", async () => {
  await db.exec(
    "INSERT INTO members(id,name,role,unit,phone,title,status) VALUES('unlinked-synthetic','Synthetic unlinked member','homeowner','','','','Active')",
  );
  const unlinked = await workspace("unlinked-synthetic");
  expect(unlinked.auth_state).toBe("unlinked");
  expect(unlinked.can_link).toBe(false);
  await db.query(
    'INSERT INTO bfe_member_detail_changes(member_id,actor_id,before_values,after_values,reason) SELECT \'0\',$1,\'{"name":"Synthetic before","phone":"","unit":"","title":""}\'::jsonb,\'{"name":"Synthetic after","phone":"","unit":"","title":""}\'::jsonb,\'Synthetic correction \'||n FROM generate_series(1,25)n',
    [developer],
  );
  expect((await workspace()).history).toHaveLength(20);
  expect((await workspace("0", developer, 1)).history).toHaveLength(5);
  await expect(
    as(resident, "(SELECT count(*) FROM bfe_member_detail_changes)"),
  ).rejects.toThrow(/permission denied/);
});

it("preserves configured view-only access even when a staff management grant exists", async () => {
  await db.query("UPDATE members SET role='admin' WHERE user_id=$1", [guard]);
  await grant(guard, "people", "view");
  await grant(guard, "people", "manage");
  await db.query(
    "INSERT INTO bfe_tab_rules VALUES('user',$1,'people','association','view')",
    [guard],
  );
  const before = await workspace("0", guard);
  expect(before.can_edit).toBe(false);
  await expect(update(before.expected, guard)).rejects.toThrow(/permission/);
});

it("binds Office linking to the selected member snapshot and keeps independent approval", async () => {
  const before = await workspace("1");
  await db.query(
    "UPDATE members SET phone='Synthetic changed' WHERE user_id=$1",
    [other],
  );
  await expect(
    as(
      developer,
      "bfe_office_link_member_property('1',$1,$2,1,'household','Synthetic verified relationship')",
      [before.expected, lot],
    ),
  ).rejects.toThrow(/Member changed/);
  const own = await workspace("2");
  await expect(
    as(
      developer,
      "bfe_office_link_member_property('2',$1,$2,1,'household','Synthetic self relationship')",
      [own.expected, lot],
    ),
  ).rejects.toThrow(/independent approver/);
});
