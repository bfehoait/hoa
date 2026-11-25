import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
// Migration 096: a homeowner's carpool is published on submission and other
// homeowners are notified.
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
  // Column added by 073 (publication audiences), which this harness skips.
  await db.exec("ALTER TABLE bfe_feature_records ADD COLUMN audiences text[]");
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611250096_carpool_auto_publish.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
const renter = "81000000-0000-4000-8000-000000000031",
  admin = "81000000-0000-4000-8000-000000000032",
  suspended = "81000000-0000-4000-8000-000000000033";
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
async function submit(
  module: string,
  payload: Record<string, string>,
  consent = true,
  user = resident,
) {
  return (await as<string>(
    user,
    "bfe_submit_feature($1,$2,$3,$4,$5::jsonb,$6)",
    [
      crypto.randomUUID(),
      module,
      "Sample weekday ride to town",
      "Synthetic carpool offer for automated tests.",
      JSON.stringify(payload),
      consent,
    ],
  ))!;
}
const record = async (id: string) =>
  (
    await db.query<{
      status: string;
      audience: string;
      audiences: string[];
      public_title: string;
      expires_at: Date;
    }>(
      "SELECT status,audience,audiences,public_title,expires_at FROM bfe_feature_records WHERE id=$1",
      [id],
    )
  ).rows[0];
const notified = async (id: string) =>
  (
    await db.query<{ recipient_id: string; title: string; path: string }>(
      "SELECT recipient_id,title,path FROM bfe_notifications WHERE event_key=$1",
      ["carpool:" + id],
    )
  ).rows;
beforeAll(async () => {
  // Residents can offer and see carpools (transport, own records), as live.
  await db.query(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('role','homeowner','transport','own','edit'),('role','renter','transport','own','edit') ON CONFLICT DO NOTHING",
  );
  for (const [id, role, status] of [
    [renter, "renter", "Active"],
    [admin, "admin", "Active"],
    [suspended, "homeowner", "Suspended"],
  ]) {
    await db.query("INSERT INTO auth.users VALUES($1) ON CONFLICT DO NOTHING", [
      id,
    ]);
    await db.query(
      "INSERT INTO members(id,user_id,name,role,status) VALUES($1,$2,'Synthetic member',$3,$4) ON CONFLICT DO NOTHING",
      [id, id, role, status],
    );
  }
});
it("publishes a homeowner's carpool on submission and notifies other homeowners", async () => {
  const id = await submit("carpools", fields(day(2)));
  const r = await record(id);
  expect(r.status).toBe("Published");
  expect(r.audience).toBe("homeowner");
  expect(r.audiences).toEqual(["homeowner"]);
  expect(r.public_title).toBe("Sample weekday ride to town");
  expect(r.expires_at.getTime()).toBeGreaterThan(Date.now() + 86400000);
  const rows = await notified(id);
  expect(rows.map((n) => n.recipient_id)).toEqual([other]);
  expect(rows[0]).toMatchObject({
    title: "New carpool available",
    path: "/directory/transport",
  });
  const seen = await as<{ rows: { id: string; title: string }[] }>(
    other,
    "bfe_feature_dashboard('carpools','published',0,'')",
  );
  expect(seen!.rows.map((x) => x.id)).toContain(id);
  const audit = await db.query<{ action: string }>(
    "SELECT action FROM bfe_feature_audit WHERE record_id=$1 ORDER BY id",
    [id],
  );
  expect(audit.rows.map((a) => a.action)).toEqual(["Published", "Submitted"]);
});
it("words the notification for a ride request", async () => {
  const id = await submit("carpools", fields(day(3), "Looking for a ride"));
  expect((await notified(id))[0].title).toBe("Someone is looking for a ride");
});
it("leaves carpools without consent or with a past or far date for the office", async () => {
  for (const id of [
    await submit("carpools", fields(day(2)), false),
    await submit("carpools", fields(day(-2))),
    await submit("carpools", fields(day(400))),
  ]) {
    expect((await record(id)).status).toBe("Submitted");
    expect(await notified(id)).toEqual([]);
  }
});
it("does not change other listing types", async () => {
  const before = await db.query(
    "SELECT count(*)::int AS n FROM bfe_notifications",
  );
  const id = await as<string>(
    resident,
    "bfe_submit_feature($1,'events','Sample street fair','Synthetic event for automated tests.',$2::jsonb,true)",
    [
      crypto.randomUUID(),
      JSON.stringify({
        date: day(5),
        start: "09:00",
        end: "12:00",
        venue: "Sample hall",
      }),
    ],
  ).catch(() => null);
  if (id) expect((await record(id)).status).toBe("Submitted");
  const after = await db.query(
    "SELECT count(*)::int AS n FROM bfe_notifications",
  );
  expect(after.rows[0]).toEqual(before.rows[0]);
});

// Migration 097: one-time publication of carpools still pending from before 096.
it("publishes older pending carpools with consent and a future date", async () => {
  const older = async (
    date: string,
    consent: boolean,
    status = "Submitted",
  ) => {
    // Inserted without consent so the 096 trigger leaves it pending, as before 096.
    const id = (
      await db.query<{ id: string }>(
        "INSERT INTO bfe_feature_records(module,owner_id,client_id,title,detail,fields) VALUES('carpools',$1,gen_random_uuid(),'Sample older ride','Synthetic carpool posted before 096.',$2::jsonb) RETURNING id",
        [guard, JSON.stringify(fields(date))],
      )
    ).rows[0].id;
    await db.query(
      "UPDATE bfe_feature_records SET publication_consent=$2,status=$3 WHERE id=$1",
      [id, consent, status],
    );
    return id;
  };
  const ready = await older(day(3), true);
  const inReview = await older(day(4), true, "In review");
  const noConsent = await older(day(3), false);
  const past = await older(day(-3), true);
  const rejected = await older(day(3), true, "Rejected");
  const before = await db.query(
    "SELECT count(*)::int AS n FROM bfe_notifications",
  );
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611250097_publish_pending_carpools.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const id of [ready, inReview]) {
    const r = await record(id);
    expect(r.status).toBe("Published");
    expect(r.audience).toBe("homeowner");
    expect(r.expires_at.getTime()).toBeGreaterThan(Date.now());
  }
  expect((await record(noConsent)).status).toBe("Submitted");
  expect((await record(past)).status).toBe("Submitted");
  expect((await record(rejected)).status).toBe("Rejected");
  const seen = await as<{ rows: { id: string }[] }>(
    other,
    "bfe_feature_dashboard('carpools','published',0,'')",
  );
  expect(seen!.rows.map((x) => x.id)).toEqual(
    expect.arrayContaining([ready, inReview]),
  );
  const after = await db.query(
    "SELECT count(*)::int AS n FROM bfe_notifications",
  );
  expect(after.rows[0]).toEqual(before.rows[0]);
});
