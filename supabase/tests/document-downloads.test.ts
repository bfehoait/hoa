import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
// Migration 092: Mandatory Documents downloads are recorded, admins are
// notified, and only admins/developers can read the download history.
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
const admin = "81000000-0000-4000-8000-000000000005";
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
    "202611230092_mandatory_document_downloads.sql",
  ])
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  await db.query("INSERT INTO auth.users VALUES($1)", [admin]);
  await db.query(
    "INSERT INTO members(id,user_id,name,unit,role) VALUES('admin',$1,'Synthetic admin','Office','admin')",
    [admin],
  );
  await db.query(
    "UPDATE members SET name='Synthetic homeowner',unit='1-01-005' WHERE user_id=$1",
    [resident],
  );
}, 30000);
beforeEach(async () => {
  await db.exec("TRUNCATE bfe_document_downloads,bfe_notifications");
});
afterAll(() => db.close());
const record = (user: string | null, document: string) =>
  as<string>(user, "bfe_record_document_download($1)", [document]);
type History = {
  rows: { document: string; name: string; unit: string | null }[];
  total: number;
};
it("records a mandatory document download and notifies admins", async () => {
  const id = await record(resident, "Annual Financial Statements (AFS)");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const rows = await db.query<{ user_id: string; document: string }>(
    "SELECT user_id,document FROM bfe_document_downloads",
  );
  expect(rows.rows).toEqual([
    { user_id: resident, document: "Annual Financial Statements (AFS)" },
  ]);
  const notes = await db.query<{
    recipient_id: string;
    body: string;
    path: string;
  }>("SELECT recipient_id,body,path FROM bfe_notifications");
  expect(notes.rows).toEqual([
    {
      recipient_id: admin,
      body: "Synthetic homeowner (1-01-005) downloaded Annual Financial Statements (AFS).",
      path: "/office/documents",
    },
  ]);
});
it("rejects unlisted documents and signed-out downloads", async () => {
  await expect(record(resident, "Secret ledger")).rejects.toThrow(
    /listed mandatory document/,
  );
  await expect(
    record(null, "Annual Financial Statements (AFS)"),
  ).rejects.toThrow();
  expect(
    (await db.query("SELECT 1 FROM bfe_document_downloads")).rows,
  ).toHaveLength(0);
});
it("shows the download history to admins only", async () => {
  await record(resident, "Master List of Qualified Voters");
  await expect(
    as(resident, "bfe_document_download_history(0)"),
  ).rejects.toThrow(/available to admins/);
  const history = await as<History>(admin, "bfe_document_download_history(0)");
  expect(history?.total).toBe(1);
  expect(history?.rows[0]).toMatchObject({
    document: "Master List of Qualified Voters",
    name: "Synthetic homeowner",
    unit: "1-01-005",
  });
  expect(
    (await as<History>(developer, "bfe_document_download_history(0)"))?.total,
  ).toBe(1);
});
