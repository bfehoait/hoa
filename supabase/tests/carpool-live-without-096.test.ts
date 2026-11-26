import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
// Migration 099 on the live shape found on 26 November 2026: 073 and 098 are
// applied but 096 and 097 never ran, so the carpool triggers are missing and
// carpools wait for office review. 099 must create the triggers and publish
// carpools already waiting.
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
  for (const file of [
    "202611130073_publication_audiences.sql",
    "202611250098_carpool_renters.sql",
  ])
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
}, 30000);
afterAll(() => db.close());
const renter = "81000000-0000-4000-8000-000000000031",
  admin = "81000000-0000-4000-8000-000000000032",
  adminOwner = "81000000-0000-4000-8000-000000000034";
const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const fields = (date: string, kind = "Offering a ride") => ({
  pickup: "Sample gate",
  destination: "Sample town centre",
  date,
  time: "07:30",
  seats: "3",
  contact: "carpool@example.invalid",
  kind,
});
const submit = async (
  payload: Record<string, string>,
  consent = true,
  user = resident,
) =>
  (await as<string>(
    user,
    "bfe_submit_feature($1,'carpools',$2,$3,$4::jsonb,$5)",
    [
      crypto.randomUUID(),
      "Sample weekday ride to town",
      "Synthetic carpool offer for automated tests.",
      JSON.stringify(payload),
      consent,
    ],
  ))!;
const notices = async (id: string) =>
  (
    await db.query<{
      recipient_id: string;
      title: string;
      body: string;
      path: string;
      event_key: string;
    }>(
      "SELECT recipient_id,title,body,path,event_key FROM bfe_notifications WHERE event_key IN ($1,$2) ORDER BY event_key,recipient_id",
      ["carpool:" + id, "carpool-admin:" + id],
    )
  ).rows;
beforeAll(async () => {
  await db.query(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('role','homeowner','transport','own','edit'),('role','renter','transport','own','edit') ON CONFLICT DO NOTHING",
  );
  for (const [id, role, extra] of [
    [renter, "renter", []],
    [admin, "admin", []],
    // An admin who is also a homeowner.
    [adminOwner, "homeowner", ["admin"]],
  ] as const) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query(
      "INSERT INTO members(id,user_id,name,unit,role,extra_roles) VALUES($1,$2,'Synthetic member','Sample unit',$3,$4)",
      [id, id, role, extra],
    );
  }
});
const record = async (id: string) =>
  (
    await db.query<{
      status: string;
      audiences: string[] | null;
      expires_at: Date | null;
    }>(
      "SELECT status,audiences,expires_at FROM bfe_feature_records WHERE id=$1",
      [id],
    )
  ).rows[0];
const run099 = async () =>
  db.exec(
    await readFile(
      new URL(
        "../migrations/202611260099_carpool_admin_notice.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
it("publishes waiting carpools, creates the triggers and notifies new posts", async () => {
  // Live symptom: without the 096 triggers a carpool waits for office review.
  const waiting = await submit(fields(day(3)));
  expect((await record(waiting)).status).toBe("Submitted");
  expect(await notices(waiting)).toEqual([]);
  const noConsent = await submit(fields(day(3)), false);
  const past = await submit(fields(day(2)));
  await db.query(
    "UPDATE bfe_feature_records SET fields=jsonb_set(fields,'{date}',to_jsonb($2::text)) WHERE id=$1",
    [past, day(-2)],
  );
  const before = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM bfe_notifications",
  );

  await run099();

  const published = await record(waiting);
  expect(published.status).toBe("Published");
  expect(published.audiences).toEqual(["homeowner", "renter"]);
  expect(published.expires_at!.getTime()).toBeGreaterThan(Date.now());
  expect((await record(noConsent)).status).toBe("Submitted");
  expect((await record(past)).status).toBe("Submitted");
  // Older carpools are published quietly.
  expect(
    (await db.query("SELECT count(*)::int AS n FROM bfe_notifications"))
      .rows[0],
  ).toEqual(before.rows[0]);
  const audit = await db.query<{ note: string }>(
    "SELECT note FROM bfe_feature_audit WHERE record_id=$1 AND action='Published'",
    [waiting],
  );
  expect(audit.rows).toEqual([
    {
      note: "Published to residents by the carpool no-approval update (owner request)",
    },
  ]);
  const seen = await as<{ rows: { id: string }[] }>(
    renter,
    "bfe_feature_dashboard('carpools','published',0,'')",
  );
  expect(seen!.rows.map((x) => x.id)).toContain(waiting);

  // Both triggers now exist, so a new carpool posts and notifies straight away.
  const triggers = await db.query<{ tgname: string }>(
    "SELECT tgname FROM pg_trigger WHERE tgrelid='public.bfe_feature_records'::regclass AND tgname LIKE 'bfe_carpool%' ORDER BY tgname",
  );
  expect(triggers.rows.map((t) => t.tgname)).toEqual([
    "bfe_carpool_auto_publish",
    "bfe_carpool_notify_homeowners",
  ]);
  const fresh = await submit(fields(day(4)), true, other);
  expect((await record(fresh)).status).toBe("Published");
  const rows = await notices(fresh);
  expect(
    rows
      .filter((n) => n.event_key.startsWith("carpool-admin:"))
      .map((n) => n.recipient_id)
      .sort(),
  ).toEqual([admin, adminOwner].sort());
  expect(
    rows
      .filter((n) => n.event_key.startsWith("carpool:"))
      .map((n) => n.recipient_id)
      .sort(),
  ).toEqual([resident, renter].sort());
});
it("can be run again without changing anything", async () => {
  const snapshot = async () =>
    (
      await db.query(
        "SELECT (SELECT count(*)::int FROM bfe_feature_audit) AS audit,(SELECT count(*)::int FROM bfe_notifications) AS notices,(SELECT count(*)::int FROM bfe_feature_records WHERE status='Published') AS published",
      )
    ).rows[0];
  const before = await snapshot();
  await run099();
  expect(await snapshot()).toEqual(before);
});
