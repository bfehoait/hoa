import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
// Migrations 092-093: community documents are view-only; downloading needs a
// request that an admin approves. Downloads and requests notify, and only
// admins/developers can read the history and the request queue.
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
    "202611240093_document_download_requests.sql",
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
  await db.exec(
    "TRUNCATE bfe_document_downloads,bfe_document_download_requests,bfe_notifications",
  );
});
afterAll(() => db.close());
const AFS = "Annual Financial Statements (AFS)";
const MINUTES =
  "Minutes Book: Complete minutes of all General Assembly meetings and Board of Directors / Executive Officer meetings";
const record = (user: string | null, document: string) =>
  as<string>(user, "bfe_record_document_download($1)", [document]);
const request = (user: string, document: string) =>
  as<{ id: string; status: string; expires_at: string | null }>(
    user,
    "bfe_request_document_download($1)",
    [document],
  );
const decide = (user: string, id: string, decision: string, note = "") =>
  as(user, "bfe_decide_document_download($1,$2,$3)", [id, decision, note]);
type Access = { document: string; status: string; expires_at: string | null }[];
type History = {
  rows: { document: string; name: string; unit: string | null }[];
  total: number;
};
const notes = async () =>
  (
    await db.query<{
      recipient_id: string;
      title: string;
      body: string;
      path: string;
    }>(
      "SELECT recipient_id,title,body,path FROM bfe_notifications ORDER BY created_at,title",
    )
  ).rows;
it("blocks downloads until an admin approves a request", async () => {
  await expect(record(resident, AFS)).rejects.toThrow(
    /Request this document from the HOA office/,
  );
  const first = await request(resident, AFS);
  expect(first?.status).toBe("Pending");
  // Asking again returns the same pending request instead of a duplicate.
  expect((await request(resident, AFS))?.id).toBe(first?.id);
  expect(await notes()).toEqual([
    {
      recipient_id: admin,
      title: "Download request",
      body: "Synthetic homeowner (1-01-005) asked to download Annual Financial Statements (AFS). Review it on the office documents page.",
      path: "/office/documents",
    },
  ]);
  await expect(record(resident, AFS)).rejects.toThrow(/Request this document/);
  await expect(decide(resident, first!.id, "Approved")).rejects.toThrow(
    /Only admins/,
  );
  await decide(admin, first!.id, "Approved");
  const access = await as<Access>(resident, "bfe_my_document_access()");
  expect(access?.[0]).toMatchObject({ document: AFS, status: "Approved" });
  const decision = (await notes()).find((n) => n.recipient_id === resident);
  expect(decision?.title).toBe("Download request approved");
  expect(decision?.path).toBe("/more/documents");
  expect(decision?.body).toMatch(
    /^You can download Annual Financial Statements \(AFS\) until /,
  );
  await record(resident, AFS);
  const downloaded = (await notes()).filter(
    (n) => n.title === "Document downloaded",
  );
  expect(downloaded).toEqual([
    {
      recipient_id: admin,
      title: "Document downloaded",
      body: "Synthetic homeowner (1-01-005) downloaded Annual Financial Statements (AFS).",
      path: "/office/documents",
    },
  ]);
  await expect(decide(admin, first!.id, "Declined")).rejects.toThrow(
    /already decided/,
  );
});
it("handles declined and expired approvals for Right to Inspect records", async () => {
  const declined = await request(resident, MINUTES);
  await decide(
    admin,
    declined!.id,
    "Declined",
    "Please inspect it at the office.",
  );
  expect(
    (await as<Access>(resident, "bfe_my_document_access()"))?.[0]?.status,
  ).toBe("Declined");
  const declineNote = (await notes()).find((n) => n.recipient_id === resident);
  expect(declineNote?.body).toMatch(
    /declined .* Note: Please inspect it at the office\.$/,
  );
  await expect(record(resident, MINUTES)).rejects.toThrow(
    /Request this document/,
  );
  const again = await request(resident, MINUTES);
  expect(again?.id).not.toBe(declined?.id);
  await decide(admin, again!.id, "Approved");
  await db.query(
    "UPDATE bfe_document_download_requests SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [again!.id],
  );
  expect(
    (await as<Access>(resident, "bfe_my_document_access()"))?.[0]?.status,
  ).toBe("Expired");
  await expect(record(resident, MINUTES)).rejects.toThrow(
    /Request this document/,
  );
});
it("rejects unlisted documents and signed-out calls", async () => {
  await expect(request(resident, "Secret ledger")).rejects.toThrow(
    /listed community document/,
  );
  await expect(record(null, AFS)).rejects.toThrow();
  expect(
    (await db.query("SELECT 1 FROM bfe_document_downloads")).rows,
  ).toHaveLength(0);
});
it("lets admins see the request queue and download history, not homeowners", async () => {
  const r = await request(resident, AFS);
  await expect(
    as(resident, "bfe_document_download_requests_queue(0)"),
  ).rejects.toThrow(/available to admins/);
  const queue = await as<{
    rows: { id: string; status: string; name: string }[];
    pending: number;
  }>(admin, "bfe_document_download_requests_queue(0)");
  expect(queue?.pending).toBe(1);
  expect(queue?.rows[0]).toMatchObject({
    id: r?.id,
    status: "Pending",
    name: "Synthetic homeowner",
  });
  await decide(admin, r!.id, "Approved");
  await record(resident, AFS);
  await expect(
    as(resident, "bfe_document_download_history(0)"),
  ).rejects.toThrow(/available to admins/);
  const history = await as<History>(admin, "bfe_document_download_history(0)");
  expect(history?.rows[0]).toMatchObject({
    document: AFS,
    name: "Synthetic homeowner",
    unit: "1-01-005",
  });
  expect(
    (await as<History>(developer, "bfe_document_download_history(0)"))?.total,
  ).toBe(1);
});
it("renames Member's Right to Inspect to Right to Inspect", async () => {
  const fields = (
    await db.query<{ fields: { key: string; options?: string[] }[] }>(
      "SELECT fields FROM bfe_feature_definitions WHERE code='board-records'",
    )
  ).rows[0].fields;
  expect(fields.find((f) => f.key === "category")?.options).toEqual([
    "Mandatory Documents",
    "Right to Inspect",
  ]);
});
