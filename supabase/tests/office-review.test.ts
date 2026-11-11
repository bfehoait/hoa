import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  officeReviewSchema,
  officeReviewPath,
} from "../../packages/shared/src/office-review";
import { officeRequirement } from "../../packages/shared/src/permissions";
import { unavailableService } from "../../packages/shared/src/service-availability";

// Isolated aggregation contract. No network, imported members or production data.
const db = new PGlite();
const staff = "91000000-0000-4000-8000-000000000001";
async function grant(module: string, action = "view") {
  await db.query("INSERT INTO test_grants VALUES($1,$2,'association')", [
    module,
    action,
  ]);
}
async function read(name = "bfe_office_review_inbox()", authenticated = true) {
  await db.exec(
    `BEGIN; SET LOCAL ROLE ${authenticated ? "authenticated" : "anon"}`,
  );
  try {
    await db.query("SELECT set_config('test.uid',$1,true)", [
      authenticated ? staff : "",
    ]);
    const r = await db.query<{ result: unknown }>(
      `SELECT public.${name} AS result`,
    );
    await db.exec("COMMIT");
    return r.rows[0].result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE TABLE test_grants(module text,action text,scope text);
    CREATE TABLE test_roles(role text);
    CREATE FUNCTION public.bfe_current_roles() RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT coalesce(array_agg(role),'{}') FROM public.test_roles$$;
    CREATE FUNCTION public.bfe_can(m text,a text,s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.test_grants WHERE module=m AND action=a AND scope=s)$$;
    CREATE TABLE registrations(status text);
    CREATE TABLE bfe_import_batches(id uuid PRIMARY KEY,status text);
    CREATE TABLE bfe_lots(id uuid PRIMARY KEY,physical_id text,batch_id uuid);
    CREATE TABLE bfe_lot_memberships(lot_id uuid,state text);
    CREATE TABLE bfe_facilities(id uuid PRIMARY KEY,name text);
    CREATE TABLE bfe_bookings(status text,starts_at timestamptz DEFAULT now()+interval '1 day',id uuid DEFAULT gen_random_uuid(),facility_id uuid,created_at timestamptz DEFAULT now());
    CREATE TABLE bfe_visitor_passes(status text,valid_until timestamptz DEFAULT now()+interval '1 day',id uuid DEFAULT gen_random_uuid(),lot_id uuid,created_at timestamptz DEFAULT now());
    CREATE TABLE bfe_feature_definitions(code text PRIMARY KEY,capability text,publishable boolean);
    CREATE TABLE bfe_feature_records(id uuid DEFAULT gen_random_uuid(),module text,status text,title text DEFAULT 'Synthetic submission',detail text DEFAULT 'Synthetic details',public_title text DEFAULT 'Synthetic activity',created_at timestamptz DEFAULT now());
    CREATE TABLE bfe_activity_participation(activity_id uuid,status text,id uuid DEFAULT gen_random_uuid(),created_at timestamptz DEFAULT now());
    CREATE TABLE bfe_participation_audit(id integer,participation_id uuid,action text,note text,at timestamptz);
    CREATE TABLE bfe_requests(status text);
    CREATE TABLE bfe_shuttle_requests(status text,expires_at timestamptz);
    CREATE FUNCTION bfe_feature_dashboard(p_module text,p_view text,p_page integer,p_search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$BEGIN
     IF auth.uid() IS NULL OR NOT public.bfe_can((SELECT capability FROM public.bfe_feature_definitions WHERE code=p_module),'view','association') THEN RAISE EXCEPTION 'Review access required.';END IF;
     RETURN '{"rows":[],"total":0,"can_create":false,"can_review":true,"can_publish":true,"publishable":true}'::jsonb;END;$$;
    CREATE FUNCTION bfe_booking_dashboard(p_office boolean,p_page integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$BEGIN
     IF auth.uid() IS NULL OR NOT public.bfe_can('calendar','view','association') THEN RAISE EXCEPTION 'Booking access required.';END IF;
     RETURN '{"rows":[],"total":0,"can_approve":true,"can_manage":false,"facilities":[]}'::jsonb;END;$$;
    CREATE FUNCTION bfe_community_pass_dashboard(p_office boolean,p_page integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$BEGIN
     IF auth.uid() IS NULL OR NOT public.bfe_can('security','view','association') THEN RAISE EXCEPTION 'Pass access required.';END IF;
     RETURN '{"rows":[],"total":0,"can_approve":true,"can_gate":false,"lots":[]}'::jsonb;END;$$;
    CREATE FUNCTION bfe_participation_dashboard(p_module text,p_office boolean,p_page integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$BEGIN
     IF auth.uid() IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR NOT public.bfe_can(CASE WHEN p_module='carpools' THEN 'transport' ELSE 'livelihood' END,'view','association') THEN RAISE EXCEPTION 'Participation access required.';END IF;
     RETURN '{"rows":[],"total":0,"activities":[],"can_approve":true}'::jsonb;END;$$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611100038_office_review_inbox.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeAll(async () => {
  await db.exec(
    "CREATE TABLE bfe_request_issuances(record_id uuid);CREATE TABLE bfe_household_applications(record_id uuid)",
  );
  const latest = await readFile(
    new URL(
      "../migrations/202611100044_household_relationship_application.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    latest.slice(
      latest.indexOf(
        "CREATE OR REPLACE FUNCTION public.bfe_office_review_inbox",
      ),
      latest.indexOf("NOTIFY pgrst"),
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_facilities,bfe_participation_audit,bfe_request_issuances,bfe_household_applications",
  );
  await db.exec(`TRUNCATE test_grants,test_roles,registrations,bfe_import_batches,bfe_lots,bfe_lot_memberships,bfe_bookings,bfe_visitor_passes,bfe_feature_definitions,bfe_feature_records,bfe_activity_participation,bfe_requests,bfe_shuttle_requests;
    INSERT INTO test_roles VALUES('admin');
    INSERT INTO test_grants VALUES('overview','summary','association');
    INSERT INTO bfe_feature_definitions VALUES('buy-sell','livelihood',true),('vehicles','property',false),('publishing','community',true),('workshops','livelihood',true);`);
});
afterAll(() => db.close());

it("denies anonymous, resident-only and missing overview access", async () => {
  await expect(read(undefined, false)).rejects.toThrow();
  await db.exec("UPDATE test_roles SET role='homeowner'");
  await expect(read()).rejects.toThrow(/Office overview/);
  await db.exec("UPDATE test_roles SET role='admin'; DELETE FROM test_grants");
  await expect(read()).rejects.toThrow(/Office overview/);
});
it("counts all pending source records across pages, hides closed and unauthorized queues", async () => {
  await grant("livelihood");
  await grant("livelihood", "status");
  await grant("requests");
  await db.exec(`INSERT INTO bfe_feature_records(module,status) SELECT 'buy-sell','Submitted' FROM generate_series(1,25);
    INSERT INTO bfe_feature_records(module,status) VALUES('buy-sell','In review'),('buy-sell','Published'),('buy-sell','Rejected'),('vehicles','Submitted'),('publishing','Submitted');
    INSERT INTO bfe_requests VALUES('Open'),('In progress'),('Resolved');`);
  const result = officeReviewSchema.parse(await read());
  expect(result.queues.find((q) => q.module === "buy-sell")).toMatchObject({
    pending: 25,
    in_review: 1,
    can_decide: true,
  });
  expect(result.queues.find((q) => q.kind === "requests")).toMatchObject({
    pending: 1,
    in_review: 1,
    can_decide: false,
  });
  expect(
    result.queues.some(
      (q) => q.module === "vehicles" || q.module === "publishing",
    ),
  ).toBe(false);
  await db.exec("DELETE FROM test_grants WHERE module='livelihood'");
  expect(
    officeReviewSchema
      .parse(await read())
      .queues.some((q) => q.module === "buy-sell"),
  ).toBe(false);
});
it("keeps bookings, passes, registration and participation in their original stores", async () => {
  for (const m of ["calendar", "security", "registrations", "livelihood"]) {
    await grant(m);
    await grant(m, "approve");
  }
  await db.exec(`INSERT INTO bfe_bookings(status) VALUES('Pending'),('Approved'); INSERT INTO bfe_visitor_passes(status) VALUES('Pending'),('Cancelled');
    INSERT INTO registrations VALUES('Pending'),('Approved');
    INSERT INTO bfe_feature_records(id,module,status) VALUES('${staff}','workshops','Published');
    INSERT INTO bfe_activity_participation(activity_id,status) VALUES('${staff}','Pending'),('${staff}','Confirmed');`);
  const result = officeReviewSchema.parse(await read());
  for (const kind of ["bookings", "passes", "registrations", "participation"])
    expect(result.queues.find((q) => q.kind === kind)).toMatchObject({
      pending: 1,
      can_decide: true,
    });
  await db.exec("UPDATE bfe_bookings SET status='Approved'");
  expect(
    officeReviewSchema
      .parse(await read())
      .queues.find((q) => q.kind === "bookings")?.pending,
  ).toBe(0);
});
it("discovers pending lot links with pagination and excludes inactive import batches", async () => {
  await grant("property");
  await db.exec(`INSERT INTO bfe_import_batches VALUES('${staff}','active');
    INSERT INTO bfe_lots SELECT gen_random_uuid(),'SYNTHETIC-'||n,'${staff}' FROM generate_series(1,21)n;
    INSERT INTO bfe_lot_memberships SELECT id,'pending' FROM bfe_lots;`);
  const first = (await read("bfe_pending_lot_links(0)")) as {
    total: number;
    rows: unknown[];
  };
  expect(first.total).toBe(21);
  expect(first.rows).toHaveLength(20);
  expect(
    ((await read("bfe_pending_lot_links(1)")) as { rows: unknown[] }).rows,
  ).toHaveLength(1);
  await db.exec("UPDATE bfe_import_batches SET status='inactive'");
  expect(
    ((await read("bfe_pending_lot_links(0)")) as { total: number }).total,
  ).toBe(0);
  await db.exec("DELETE FROM test_grants WHERE module='property'");
  await expect(read("bfe_pending_lot_links(0)")).rejects.toThrow(
    /Property review/,
  );
});
it("maps each queue to a live Office route with its own capability", () => {
  for (const [kind, module] of [
    ["feature", "buy-sell"],
    ["feature", "vehicles"],
    ["feature", "permits"],
    ["issuance", "vehicles"],
    ["household", "household-changes"],
    ["participation", "workshops"],
    ["participation", "carpools"],
    ["lots", ""],
    ["registrations", ""],
    ["bookings", ""],
    ["passes", ""],
    ["shuttle", ""],
  ] as const) {
    const path = officeReviewPath({ kind, module });
    expect(unavailableService(path.split("?")[0])).toBeNull();
    expect(officeRequirement(path)).toBeTruthy();
  }
  expect(officeRequirement("/office/review/buy-sell")?.module).toBe(
    "livelihood",
  );
  expect(officeRequirement("/office/permits")?.module).toBe("property");
  expect(officeRequirement("/office/review/unknown")).toBeUndefined();
  expect(officeRequirement("/office/review/toString")).toBeUndefined();
});

it("paginates pending feature submissions before completed history and rechecks view authority", async () => {
  await grant("livelihood");
  await db.exec(`INSERT INTO bfe_feature_records(module,status) SELECT 'buy-sell','Submitted' FROM generate_series(1,25);
    INSERT INTO bfe_feature_records(module,status) SELECT 'buy-sell','Published' FROM generate_series(1,40);`);
  const first = (await read("bfe_office_feature_queue('buy-sell',0,'')")) as {
    rows: unknown[];
    total: number;
  };
  expect(first.total).toBe(25);
  expect(first.rows).toHaveLength(20);
  expect(
    (
      (await read("bfe_office_feature_queue('buy-sell',1,'')")) as {
        rows: unknown[];
      }
    ).rows,
  ).toHaveLength(5);
  await db.exec("DELETE FROM test_grants WHERE module='livelihood'");
  await expect(
    read("bfe_office_feature_queue('buy-sell',0,'')"),
  ).rejects.toThrow(/Review access/);
});
it("shows only current pending bookings/passes, excluding approved and expired records", async () => {
  await grant("calendar");
  await grant("security");
  await db.exec(`INSERT INTO bfe_facilities VALUES('${staff}','Synthetic facility');
    INSERT INTO bfe_bookings(status,facility_id) VALUES('Pending','${staff}'),('Approved','${staff}');
    INSERT INTO bfe_bookings(status,facility_id,starts_at) VALUES('Pending','${staff}',now()-interval '1 day');
    INSERT INTO bfe_lots VALUES('${staff}','SYNTHETIC','${staff}');
    INSERT INTO bfe_visitor_passes(status,lot_id) VALUES('Pending','${staff}'),('Approved','${staff}');
    INSERT INTO bfe_visitor_passes(status,lot_id,valid_until) VALUES('Pending','${staff}',now()-interval '1 day');`);
  for (const kind of ["booking", "visitor"]) {
    const page = (await read(`bfe_office_operation_queue('${kind}',0)`)) as {
      rows: { status: string }[];
      total: number;
    };
    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].status).toBe("Pending");
  }
  await db.exec("DELETE FROM test_grants WHERE module='calendar'");
  await expect(read("bfe_office_operation_queue('booking',0)")).rejects.toThrow(
    /Booking access/,
  );
});
it("keeps pending participation visible independently of confirmed applications", async () => {
  await grant("livelihood");
  await db.exec(`INSERT INTO bfe_feature_records(id,module,status) VALUES('${staff}','workshops','Published');
    INSERT INTO bfe_activity_participation(activity_id,status) SELECT '${staff}','Confirmed' FROM generate_series(1,30);
    INSERT INTO bfe_activity_participation(activity_id,status) VALUES('${staff}','Pending');`);
  const page = (await read(
    "bfe_office_participation_queue('workshops',0)",
  )) as { rows: { status: string; history: unknown[] }[]; total: number };
  expect(page.total).toBe(1);
  expect(page.rows[0]).toMatchObject({ status: "Pending", history: [] });
  await db.exec("DELETE FROM test_grants WHERE module='livelihood'");
  await expect(
    read("bfe_office_participation_queue('workshops',0)"),
  ).rejects.toThrow(/Participation access/);
});

it("keeps reviewed listings and unfulfilled private requests in their correct queues", async () => {
  for (const module of ["property", "livelihood", "people"])
    await grant(module);
  await grant("property", "manage");
  await grant("property", "status");
  await db.exec(`INSERT INTO bfe_feature_definitions VALUES('household-changes','property',false);
    INSERT INTO bfe_feature_records(module,status) VALUES('buy-sell','Reviewed'),('vehicles','Reviewed'),('household-changes','Reviewed');`);
  const result = officeReviewSchema.parse(await read());
  expect(
    result.queues.find((q) => q.kind === "feature" && q.module === "buy-sell")
      ?.pending,
  ).toBe(1);
  expect(
    result.queues.find((q) => q.kind === "issuance" && q.module === "vehicles")
      ?.pending,
  ).toBe(1);
  expect(result.queues.find((q) => q.kind === "household")?.pending).toBe(1);
  await db.exec(
    "INSERT INTO bfe_request_issuances SELECT id FROM bfe_feature_records WHERE module='vehicles';INSERT INTO bfe_household_applications SELECT id FROM bfe_feature_records WHERE module='household-changes'",
  );
  const finished = officeReviewSchema.parse(await read());
  expect(
    finished.queues.filter((q) => ["issuance", "household"].includes(q.kind)),
  ).toEqual([]);
});
