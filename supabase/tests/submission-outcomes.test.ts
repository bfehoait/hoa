import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
const db = new PGlite();
const owner = "91000000-0000-4000-8000-000000000001";
const staff = "91000000-0000-4000-8000-000000000002";
const record = "92000000-0000-4000-8000-000000000001";
async function call(expression: string, args: unknown[] = [], actor = staff) {
  await db.exec("BEGIN; SET LOCAL ROLE authenticated");
  try {
    await db.query("SELECT set_config('test.actor',$1,true)", [actor]);
    const r = await db.query<{ result: any }>(
      `SELECT ${expression} AS result`,
      args,
    );
    await db.exec("COMMIT");
    return r.rows[0]?.result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES('${owner}'),('${staff}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION bfe_current_roles() RETURNS text[] LANGUAGE sql STABLE AS $$SELECT ARRAY['homeowner']$$;
    CREATE FUNCTION bfe_can(text,text,text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT auth.uid()='${staff}'::uuid OR ($2 IN ('view','create') AND $3 IN ('own','approved'))$$;
    CREATE TABLE bfe_feature_definitions(code text PRIMARY KEY,capability text,publishable boolean,resident_create boolean);
    INSERT INTO bfe_feature_definitions SELECT code,'livelihood',true,code<>'booth-events' FROM unnest(ARRAY['businesses','buy-sell','jobs','garage-sales','booth-events','workshops'])code;
    INSERT INTO bfe_feature_definitions VALUES('vehicles','property',false,true),('permits','property',false,true),('board-records','documents',true,false);
    CREATE TABLE bfe_feature_records(id uuid PRIMARY KEY,owner_id uuid,module text,title text,detail text,fields jsonb DEFAULT '{}',status text,publication_consent boolean DEFAULT true,public_title text,public_body text,audience text,expires_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),version integer DEFAULT 1);
    CREATE TABLE bfe_facilities(id uuid PRIMARY KEY,name text);
    CREATE TABLE bfe_bookings(id uuid DEFAULT gen_random_uuid(),facility_id uuid,owner_id uuid,starts_at timestamptz,ends_at timestamptz,status text);
    CREATE FUNCTION bfe_feature_dashboard(text,text,integer,text) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN IF auth.uid()<>'${staff}'::uuid THEN RAISE EXCEPTION 'Review access denied'; END IF; RETURN '{"can_review":true}'::jsonb; END;$$;
    CREATE TABLE bfe_listing_assets(record_id uuid,cover_path text);
    CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE TABLE bfe_feature_audit(record_id uuid,actor_id uuid,action text,note text);
    CREATE TABLE bfe_notifications(recipient_id uuid,kind text,title text,body text,path text,event_key text,UNIQUE(recipient_id,event_key));`);
  for (const file of [
    "202611100041_livelihood_approval_publication.sql",
    "202611100042_request_issuance.sql",
    "202611100043_resident_calendar_month.sql",
  ]) {
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  }
  // CREATE OR REPLACE preserves the grants of the installed review RPC.
  await db.exec(
    "GRANT EXECUTE ON FUNCTION bfe_review_feature(uuid,integer,text,text,text,text,text,timestamptz) TO authenticated",
  );
});
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_feature_records,bfe_request_issuances,bfe_listing_assets,storage.objects,bfe_feature_audit,bfe_notifications,bfe_bookings,bfe_facilities CASCADE",
  );
  await db.query(
    "INSERT INTO bfe_feature_records(id,owner_id,module,title,detail,status) VALUES($1,$2,'workshops','Synthetic workshop','Synthetic public workshop description','Submitted')",
    [record, owner],
  );
});
afterAll(() => db.close());
const publish = (version = 1, actor = staff) =>
  call(
    "bfe_review_feature($1,$2,'Published','Synthetic checked information','Synthetic workshop','Synthetic public workshop description','members',now()+interval '1 day')",
    [record, version],
    actor,
  );
it("publishes a submitted activity and exposes it in the six-category resident feed", async () => {
  expect((await call("bfe_marketplace_feed()", [], owner)).total).toBe(0);
  await publish();
  const feed = await call("bfe_marketplace_feed()", [], owner);
  expect(feed.rows[0].module).toBe("workshops");
  expect(feed.postable_modules).toContain("workshops");
  expect(feed.postable_modules).not.toContain("booth-events");
});
it("recovers an explicitly reviewed listing but rejects misleading generic approval", async () => {
  await db.exec("UPDATE bfe_feature_records SET status='In review'");
  await expect(
    call("bfe_review_feature($1,1,'Reviewed','Synthetic checking complete')", [
      record,
    ]),
  ).rejects.toThrow(/Approve and publish/);
  await db.exec("UPDATE bfe_feature_records SET status='Reviewed'");
  expect((await call("bfe_office_feature_queue('workshops')")).total).toBe(1);
  await publish();
  expect((await call("bfe_marketplace_feed()", [], owner)).total).toBe(1);
});
it("rejects unauthorized, stale, non-consented and incomplete-image publication", async () => {
  await expect(publish(1, owner)).rejects.toThrow(/permission/);
  await expect(publish(2)).rejects.toThrow(/changed/);
  await db.exec("UPDATE bfe_feature_records SET publication_consent=false");
  await expect(publish()).rejects.toThrow(/consent/);
  await db.exec("UPDATE bfe_feature_records SET publication_consent=true");
  await db.query(
    "INSERT INTO bfe_listing_assets VALUES($1,'synthetic/uncompleted.webp')",
    [record],
  );
  await expect(publish()).rejects.toThrow(/cover/);
});
const issue = (
  actor = staff,
  version = 1,
  until: string | null = "2027-01-01",
) =>
  call(
    "bfe_issue_request($1,$2,'SYNTHETIC-REF','2026-11-10',$3,'Synthetic office issuance')",
    [record, version, until],
    actor,
  );
it("requires approval, then records immutable private issuance with safe retries", async () => {
  await db.exec("UPDATE bfe_feature_records SET module='permits'");
  await expect(issue()).rejects.toThrow(/Approve/);
  await db.exec("UPDATE bfe_feature_records SET status='Reviewed'");
  await expect(issue(owner)).rejects.toThrow(/permission/);
  await expect(issue(staff, 2)).rejects.toThrow(/changed/);
  expect((await call("bfe_office_issuance_queue('permits')")).total).toBe(1);
  await issue();
  await issue();
  expect((await call("bfe_office_issuance_queue('permits')")).total).toBe(0);
  const result = await call("bfe_request_issuance($1)", [record], owner);
  expect(result.issuance.reference).toBe("SYNTHETIC-REF");
  expect(result.can_issue).toBe(false);
  const counts = await db.query<{ n: number }>(
    "SELECT count(*)::int n FROM bfe_request_issuances",
  );
  expect(counts.rows[0].n).toBe(1);
  await expect(
    call(
      "bfe_issue_request($1,2,'DIFFERENT-REF','2026-11-10','2027-01-01','Synthetic different action')",
      [record],
    ),
  ).rejects.toThrow(/already recorded/);
});
it("checks validity and supports recording actual vehicle removal separately", async () => {
  await db.exec(
    "UPDATE bfe_feature_records SET module='vehicles',status='Reviewed'",
  );
  await expect(issue(staff, 1, null)).rejects.toThrow(/validity/);
  await db.exec(
    `UPDATE bfe_feature_records SET fields='{"request":"Remove a vehicle"}'`,
  );
  await expect(issue()).rejects.toThrow(/validity/);
  await issue(staff, 1, null);
  expect(
    (await call("bfe_request_issuance($1)", [record], owner)).issuance.outcome,
  ).toBe("vehicle_removed");
});

it("does not disclose another account's issuance or permit direct table access", async () => {
  await db.exec(
    "UPDATE bfe_feature_records SET module='permits',status='Reviewed'",
  );
  await issue();
  const outsider = "91000000-0000-4000-8000-000000000003";
  await expect(
    call("bfe_request_issuance($1)", [record], outsider),
  ).rejects.toThrow(/unavailable/);
  await expect(
    call("(SELECT count(*) FROM bfe_request_issuances)", [], owner),
  ).rejects.toThrow(/permission denied/);
  await expect(
    call(
      "bfe_review_feature($1,2,'Withdrawn','Synthetic withdrawal')",
      [record],
      owner,
    ),
  ).rejects.toThrow(/already recorded/);
});
it("shows all own bookings in the selected month, including day boundaries, without exposing neighbours", async () => {
  await db.exec(`INSERT INTO bfe_facilities VALUES('${record}','Synthetic facility');
    INSERT INTO bfe_bookings(facility_id,owner_id,starts_at,ends_at,status)
    SELECT '${record}','${owner}','2026-11-10 08:00+08'::timestamptz,'2026-11-10 09:00+08'::timestamptz,'Approved' FROM generate_series(1,25);
    INSERT INTO bfe_bookings(facility_id,owner_id,starts_at,ends_at,status) VALUES
    ('${record}','${staff}','2026-11-10 08:00+08','2026-11-10 09:00+08','Approved'),
    ('${record}','${owner}','2026-10-31 23:00+08','2026-11-01 01:00+08','Pending'),
    ('${record}','${owner}','2026-11-01 02:00+08','2026-11-01 03:00+08','Rejected');`);
  const entries = await call(
    "bfe_resident_calendar_month('2026-11-01')",
    [],
    owner,
  );
  expect(entries).toHaveLength(26);
  expect(
    entries.filter((e: { day: string }) => e.day === "2026-11-01"),
  ).toHaveLength(1);
  expect(
    await call("bfe_resident_calendar_month('2026-12-01')", [], owner),
  ).toEqual([]);
});

it("lets authorized publishers finish reviewed curated documents without calling review an issued document", async () => {
  await db.exec(
    "UPDATE bfe_feature_records SET module='board-records',status='Reviewed'",
  );
  await publish();
  const r = await db.query<{ status: string; public_title: string }>(
    "SELECT status,public_title FROM bfe_feature_records",
  );
  expect(r.rows[0].status).toBe("Published");
  expect(r.rows[0].public_title).toBe("Synthetic workshop");
  expect((await call("bfe_marketplace_feed()", [], owner)).total).toBe(0);
});
