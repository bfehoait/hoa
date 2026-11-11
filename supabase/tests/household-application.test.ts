import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const db = new PGlite();
const staff = "93000000-0000-4000-8000-000000000001",
  resident = "93000000-0000-4000-8000-000000000002",
  lot = "94000000-0000-4000-8000-000000000001",
  request = "95000000-0000-4000-8000-000000000001";
async function call(expression: string, args: unknown[] = [], actor = staff) {
  await db.exec("BEGIN;SET LOCAL ROLE authenticated");
  try {
    await db.query("SELECT set_config('test.actor',$1,true)", [actor]);
    const result = await db.query<{ result: any }>(
      `SELECT ${expression} AS result`,
      args,
    );
    await db.exec("COMMIT");
    return result.rows[0].result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${staff}'),('${resident}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION bfe_can(text,text,text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT auth.uid()='${staff}'::uuid OR ($2='view' AND $3='own')$$;
    CREATE FUNCTION bfe_current_roles() RETURNS text[] LANGUAGE sql STABLE AS $$SELECT ARRAY['homeowner']$$;
    CREATE TABLE members(user_id uuid PRIMARY KEY,name text,unit text,role text,extra_roles text[],status text);
    INSERT INTO members VALUES('${resident}','Synthetic household member','PH9 B99 L999','homeowner','{}','Active'),('${staff}','Synthetic reviewer','n/a','admin','{}','Active');
    CREATE FUNCTION bfe_roles_for(uuid) RETURNS text[] LANGUAGE sql STABLE AS $$SELECT CASE WHEN EXISTS(SELECT 1 FROM public.members WHERE user_id=$1 AND status='Active') THEN ARRAY['homeowner'] ELSE ARRAY[]::text[] END$$;
    CREATE TABLE bfe_import_batches(id uuid PRIMARY KEY,checksum text,status text);
    INSERT INTO bfe_import_batches VALUES('${lot}',repeat('f',64),'active');
    CREATE TABLE bfe_lots(id uuid PRIMARY KEY,physical_id text,batch_id uuid,version integer,corrected_homeowner text,recorded_homeowner text);
    INSERT INTO bfe_lots VALUES('${lot}','9-99-999','${lot}',1,NULL,'Synthetic recorded homeowner');
    CREATE TABLE bfe_lot_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lot_id uuid,user_id uuid,relationship text,state text DEFAULT 'pending',starts_at timestamptz DEFAULT now(),expires_at timestamptz,reference text,approved_by uuid,updated_at timestamptz);
    CREATE TABLE bfe_registry_audit(lot_id uuid,actor_id uuid,action text,details jsonb);
    CREATE TABLE bfe_feature_records(id uuid PRIMARY KEY,owner_id uuid,module text,status text,fields jsonb,version integer,title text,detail text,created_at timestamptz DEFAULT now(),updated_at timestamptz);
    CREATE TABLE bfe_feature_audit(record_id uuid,actor_id uuid,action text,note text);
    CREATE TABLE bfe_notifications(recipient_id uuid,kind text,title text,body text,path text CHECK(path IN ('/services/requests','/office/requests','/more/profile','/developer/access','/more/notifications','/more/transport','/driver/dispatch')),event_key text,UNIQUE(recipient_id,event_key));
    CREATE FUNCTION bfe_feature_dashboard(text,text,integer,text) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN IF auth.uid()<>'${staff}'::uuid THEN RAISE EXCEPTION 'Review access denied'; END IF; RETURN '{}'::jsonb; END;$$;`);
  const source = await readFile(
    new URL("../migrations/202611060005_lot_register.sql", import.meta.url),
    "utf8",
  );
  await db.exec(
    source.slice(
      source.indexOf("CREATE FUNCTION public.bfe_review_lot_membership"),
      source.indexOf("CREATE FUNCTION public.bfe_correct_homeowner"),
    ),
  );
  for (const file of [
    "202611090037_reviewed_account_lot_link.sql",
    "202611100042_request_issuance.sql",
    "202611100044_household_relationship_application.sql",
  ])
    await db.exec(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611100047_fulfillment_notification_routes.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_request_issuances,bfe_household_applications,bfe_lot_memberships,bfe_feature_records,bfe_feature_audit,bfe_registry_audit,bfe_notifications CASCADE;UPDATE members SET status='Active'",
  );
  await db.query(
    "INSERT INTO bfe_feature_records(id,owner_id,module,status,fields,version,title,detail) VALUES($1,$2,'household-changes','Reviewed','{}',1,'Synthetic relationship request','Synthetic household change')",
    [request, resident],
  );
});
afterAll(() => db.close());
async function apply(
  version = 1,
  target = resident,
  actor = staff,
  expected?: unknown,
) {
  const match = await call("bfe_account_lot_match($1,'9-99-999')", [target]);
  return call(
    "bfe_apply_household_request($1,$2,$3,$4,$5,1,'household','Synthetic verified evidence')",
    [request, version, target, lot, expected ?? match.expected],
    actor,
  );
}
it("applies the real independently approved membership, with audit and notification, without owner corrections", async () => {
  await apply();
  await apply();
  const rows = await db.query<{ state: string; relationship: string }>(
    "SELECT state,relationship FROM bfe_lot_memberships",
  );
  expect(rows.rows).toEqual([{ state: "approved", relationship: "household" }]);
  expect(
    (await call("bfe_household_application($1)", [request], resident))
      .application.physical_id,
  ).toBe("9-99-999");
  expect(
    (await call("bfe_office_household_queue('household-changes')")).total,
  ).toBe(0);
  expect(
    (
      await db.query<{ corrected_homeowner: string | null }>(
        "SELECT corrected_homeowner FROM bfe_lots",
      )
    ).rows[0].corrected_homeowner,
  ).toBeNull();
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_notifications",
      )
    ).rows[0].n,
  ).toBe(1);
});
it("rejects missing authority, stale request/account snapshots and self-approval", async () => {
  await expect(apply(1, resident, resident)).rejects.toThrow(/permissions/);
  await expect(apply(2)).rejects.toThrow(/changed/);
  await expect(apply(1, resident, staff, {})).rejects.toThrow(
    /Account changed/,
  );
  await expect(apply(1, staff)).rejects.toThrow(/independent approver/);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_lot_memberships",
      )
    ).rows[0].n,
  ).toBe(0);
});
it("does not apply unreviewed or future-dated proposals and protects the completed outcome", async () => {
  await db.exec("UPDATE bfe_feature_records SET status='Submitted'");
  await expect(apply()).rejects.toThrow(/review first/);
  await db.exec(
    `UPDATE bfe_feature_records SET status='Reviewed',fields=jsonb_build_object('effective',(((now() AT TIME ZONE 'Asia/Manila')::date+1))::text)`,
  );
  await expect(apply()).rejects.toThrow(/effective date/);
  await db.exec("UPDATE bfe_feature_records SET fields='{}'");
  await apply();
  await expect(
    db.exec("UPDATE bfe_feature_records SET status='Withdrawn'"),
  ).rejects.toThrow(/already applied/);
});

it("repairs the earlier notification paths without changing their constrained allowlist or confirmation authority", async () => {
  for (const [file, name] of [
    ["202611100042_request_issuance.sql", "bfe_issue_request"],
    [
      "202611100044_household_relationship_application.sql",
      "bfe_apply_household_request",
    ],
  ]) {
    const source = await readFile(
      new URL("../migrations/" + file, import.meta.url),
      "utf8",
    );
    const start = source.indexOf("CREATE FUNCTION public." + name + "(");
    const end = source.indexOf("END;$$;", start) + 8;
    await db.exec(
      source
        .slice(start, end)
        .replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"),
    );
  }
  await expect(apply()).rejects.toThrow(/path_check/);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_household_applications",
      )
    ).rows[0].n,
  ).toBe(0);
  const repair = await readFile(
    new URL(
      "../migrations/202611100047_fulfillment_notification_routes.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(repair);
  await db.exec(repair);
  await apply();
  const issue = "95000000-0000-4000-8000-000000000002";
  await db.query(
    "INSERT INTO bfe_feature_records(id,owner_id,module,status,fields,version,title,detail) VALUES($1,$2,'permits','Reviewed','{}',1,'Synthetic permit','Synthetic permit evidence')",
    [issue, resident],
  );
  await call(
    "bfe_issue_request($1,1,'SYNTHETIC-REF','2026-11-10','2027-01-01','Synthetic actual issuance')",
    [issue],
  );
  const destinations = await db.query<{ path: string }>(
    "SELECT path FROM bfe_notifications",
  );
  expect(destinations.rows).toEqual([
    { path: "/more/notifications" },
    { path: "/more/notifications" },
  ]);
});
