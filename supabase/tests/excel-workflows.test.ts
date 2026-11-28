import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { sampleBaselineFields } from "../../packages/shared/src/baseline";
import { visitorDashboardSchema } from "../../packages/shared/src/operations";
// Isolated synthetic database. Excel supersedes historical migration 091.
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
    "202611100042_request_issuance.sql",
    "202611100048_helpdesk_business_forms.sql",
    "202611130073_publication_audiences.sql",
    "202611230092_mandatory_document_downloads.sql",
    "202611240093_document_download_requests.sql",
    "202611240094_committee_area_access.sql",
    "202611240095_office_area_roles.sql",
    "202611250096_carpool_auto_publish.sql",
    "202611250098_carpool_renters.sql",
    "202611260099_excel_pass_workflows.sql",
    "202611100054_accounting_business_forms.sql",
    "202611100057_office_booking_creation.sql",
    "202611110069_amenity_account_charges.sql",
    "202611150082_booking_price_estimates.sql",
    "202611150083_booking_approval_charge.sql",
    "202611150084_booking_fee_notification_path.sql",
    "202611150085_amenity_package_rate_clarification.sql",
    "202611260100_excel_amenity_booking.sql",
    "202611260101_excel_carpool_permits.sql",
    "202611260102_excel_booking_payments.sql",
    "202611260103_excel_helpdesk_routes.sql",
    "202611260104_excel_property_clearances.sql",
    "202611270105_workspace_access_editor.sql",
  ].sort((a, b) => Number(a.slice(8, 12)) - Number(b.slice(8, 12)))) {
    const sql = await readFile(
      new URL("../migrations/" + file, import.meta.url),
      "utf8",
    );
    // Preview dispatcher migrations are outside this isolated booking fixture.
    // Install the historical accounting definitions, then test new migrations in full.
    try {
      await db.exec(
        file.includes("069_") ? sql.split("DO $preview$")[0] + "COMMIT;" : sql,
      );
    } catch (e) {
      throw new Error(file + ": " + String(e), { cause: e });
    }
  }
}, 30000);
beforeEach(async () => {
  await db.exec(
    "DROP POLICY IF EXISTS synthetic_broad_storage_read ON storage.objects",
  );
  await db.exec(
    "TRUNCATE bfe_tab_rules,bfe_action_rules,bfe_access_managers,storage.objects",
  );
  await db.exec(
    "TRUNCATE bfe_request_messages,bfe_request_audit,bfe_requests,bfe_notifications CASCADE;",
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

it("keeps resident visitor and delivery passes pending for Security", async () => {
  await grant(resident, "security", "create", "own");
  expect(await statusOf(await pass("visitor"))).toBe("Pending");
  expect(await statusOf(await pass("small_delivery"))).toBe("Pending");
});
it("requires actual Security permission and ID checks; does not grant it to developers", async () => {
  await grant(resident, "security", "create", "own");
  const id = await pass("visitor");
  await grant(guard, "security", "view");
  await grant(guard, "security", "status");
  expect(await securityView(guard)).toContain(id);
  await expect(
    as(
      developer,
      "bfe_decide_checked_pass($1,1,'Approved','Checked',true,true)",
      [id],
    ),
  ).rejects.toThrow();
  await expect(
    as(guard, "bfe_decide_checked_pass($1,1,'Approved','Checked',false,true)", [
      id,
    ]),
  ).rejects.toThrow(/ID/);
  await as(
    guard,
    "bfe_decide_checked_pass($1,1,'Approved','Checked',true,true)",
    [id],
  );
  expect(await statusOf(id)).toBe("Approved");
});
it("keeps gate passes pending after Office approval until Security checks", async () => {
  await grant(resident, "security", "create", "own");
  const id = await pass("gate");
  await grant(developer, "security", "view");
  await grant(developer, "security", "approve");
  await as(
    developer,
    "bfe_decide_checked_pass($1,1,'Approved','Office checked',false,false)",
    [id],
  );
  expect(await statusOf(id)).toBe("Pending");
  await grant(guard, "security", "view");
  await grant(guard, "security", "status");
  await as(
    guard,
    "bfe_decide_checked_pass($1,2,'Approved','Guard checked',true,true)",
    [id],
  );
  expect(await statusOf(id)).toBe("Approved");
});

const pool = "83000000-0000-4000-8000-000000000001";
const nextTuesday = new Date(Date.now() + 14 * 86400000);
while (nextTuesday.getUTCDay() !== 2)
  nextTuesday.setUTCDate(nextTuesday.getUTCDate() + 1);
const bookingDay = nextTuesday.toISOString().slice(0, 10);
async function setupPool() {
  await grant(resident, "calendar", "create", "own");
  await grant(resident, "calendar", "view", "own");
  await grant(developer, "calendar", "view");
  await grant(developer, "calendar", "approve");
  await grant(developer, "finance", "approve");
  await db.query(
    "INSERT INTO bfe_facilities(id,name,opens,closes,slot_minutes,max_minutes,capacity,renters,active,policy_reference) VALUES($1,'Swimming pool','07:00','21:00',30,240,40,true,true,'Synthetic test policy')",
    [pool],
  );
  await db.exec(
    "TRUNCATE bfe_booking_payment_settings; INSERT INTO bfe_booking_payment_settings(instructions,reservation_basis,policy_reference) VALUES('Synthetic instructions only','rental_and_bond','Synthetic policy, never production defaults')",
  );
}
async function booking(start = "09:00", end = "11:00") {
  return (await as<string>(
    resident,
    "bfe_create_excel_booking($1,$2,$3,$4,'Synthetic pool reservation',2,'pool-exclusive',2,0,null,'')",
    [
      crypto.randomUUID(),
      pool,
      bookingDay + "T" + start + ":00+08:00",
      bookingDay + "T" + end + ":00+08:00",
    ],
  ))!;
}
it("creates pencil requests with stable references, whole-session pricing and no charge", async () => {
  await setupPool();
  const id = await booking();
  const read = await as<{ checkout: { reference: string } }>(
    resident,
    "bfe_booking_checkout_read($1)",
    [id],
  );
  expect(read?.checkout.reference).toMatch(/^SP-\d{8}-\d{3,}$/);
  const price = await db.query<{ estimate: { rental_centavos: number } }>(
    "SELECT estimate FROM bfe_booking_prices WHERE booking_id=$1",
    [id],
  );
  expect(price.rows[0].estimate.rental_centavos).toBe(500000);
  expect(
    (await db.query("SELECT * FROM bfe_amenity_charges")).rows,
  ).toHaveLength(0);
  await expect(
    as(other, "bfe_booking_checkout_read($1)", [id]),
  ).rejects.toThrow(/unavailable/);
});
it("verifies payment atomically once and blocks another exclusive booking for that session", async () => {
  await setupPool();
  const first = await booking(),
    second = await booking("12:00", "14:00");
  const sql =
    "bfe_approve_excel_booking($1,1,500000,250000,150000,$2,'Synthetic payment matched')";
  const payment = await as(developer, sql, [first, "SYNTHETIC-RECEIPT-01"]);
  expect(await as(developer, sql, [first, "SYNTHETIC-RECEIPT-01"])).toBe(
    payment,
  );
  expect(
    (await db.query("SELECT * FROM bfe_amenity_payments")).rows,
  ).toHaveLength(1);
  const amount = await db.query<{ amount: string }>(
    "SELECT (c.amount_centavos-bfe_amenity_paid(c.entry_id))::text amount FROM bfe_amenity_charges c WHERE booking_id=$1",
    [first],
  );
  expect(amount.rows[0].amount).toBe("600000");
  await expect(
    as(developer, sql, [second, "SYNTHETIC-RECEIPT-02"]),
  ).rejects.toThrow(/confirmed/);
  expect(
    (await db.query("SELECT * FROM bfe_amenity_payments")).rows,
  ).toHaveLength(1);
});
it("rejects short court requests and payment confirmation after a pencil hold expires", async () => {
  await setupPool();
  const id = await booking();
  await db.exec(
    "UPDATE bfe_booking_checkout SET hold_until=now()-interval '1 second'",
  );
  await expect(
    as(
      developer,
      "bfe_approve_excel_booking($1,1,500000,250000,150000,'SYNTHETIC-EXPIRED','Synthetic payment matched')",
      [id],
    ),
  ).rejects.toThrow(/ended/);
  await db.exec("UPDATE bfe_facilities SET name='Basketball court'");
  await expect(
    as(resident, "bfe_quote_booking($1,$2,$3,'court-sports',0,0)", [
      pool,
      bookingDay + "T09:00:00+08:00",
      bookingDay + "T09:30:00+08:00",
    ]),
  ).rejects.toThrow(/minimum/);
});

it("routes concerns to Board, complaints to Grievance and maintenance to Maintenance", async () => {
  await db.query("UPDATE members SET role='board' WHERE user_id=$1", [other]);
  await db.query(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('role','board','requests','association','edit') ON CONFLICT DO NOTHING",
  );
  await grant(resident, "requests", "create", "own");
  await grant(resident, "requests", "view", "own");
  const create = async (category: string) =>
    (await as<{ id: string }>(
      resident,
      "bfe_create_request($1,'Synthetic help request','Synthetic routing description',$2)",
      [crypto.randomUUID(), category],
    ))!.id;
  const concern = await create("Concern"),
    complaint = await create("Complaint");
  await expect(
    as(other, "bfe_reply_request($1,$2,'Synthetic board response')", [
      concern,
      crypto.randomUUID(),
    ]),
  ).resolves.toBeDefined();
  await expect(
    as(other, "bfe_reply_request($1,$2,'Synthetic board response')", [
      complaint,
      crypto.randomUUID(),
    ]),
  ).rejects.toThrow(/cannot reply/);
  const notification = await db.query(
    "SELECT * FROM bfe_notifications WHERE recipient_id=$1 AND title='New resident request' AND path='/board/requests'",
    [other],
  );
  expect(notification.rows.length).toBeGreaterThan(0);
  await db.query("UPDATE members SET role='homeowner' WHERE user_id=$1", [
    other,
  ]);
});
it("requires Security approval before issuing a move clearance and exposes only issued permits", async () => {
  const id = crypto.randomUUID();
  await db.query(
    "INSERT INTO bfe_feature_records(id,module,owner_id,client_id,title,detail,fields,status) VALUES($1,'permits',$2,$3,'Synthetic move','Synthetic request detail','{\"permit\":\"Move-in clearance\",\"unit\":\"1-01-001\"}','Submitted')",
    [id, resident, crypto.randomUUID()],
  );
  await db.query(
    "UPDATE bfe_feature_records SET status='Reviewed' WHERE id=$1",
    [id],
  );
  await grant(developer, "property", "view");
  await grant(developer, "property", "status");
  await expect(
    as(
      developer,
      "bfe_issue_request($1,1,'SYNTHETIC-MOVE',current_date,current_date+1,'Synthetic issuance')",
      [id],
    ),
  ).rejects.toThrow(/Security must approve/);
  await grant(guard, "security", "view");
  await grant(guard, "security", "status");
  await as(
    guard,
    "bfe_decide_move_clearance($1,1,'Approved','Synthetic check complete')",
    [id],
  );
  await as(
    developer,
    "bfe_issue_request($1,1,'SYNTHETIC-MOVE',current_date,current_date+1,'Synthetic issuance')",
    [id],
  );
  await grant(resident, "property", "view", "own");
  expect(await as(resident, "bfe_issued_permit($1)", [id])).toMatchObject({
    reference: "SYNTHETIC-MOVE",
  });
  await expect(as(other, "bfe_issued_permit($1)", [id])).rejects.toThrow(
    /unavailable/,
  );
});

it("keeps proofs private and requires 20% of the total before accepting one", async () => {
  await setupPool();
  const id = await booking();
  const path = `${resident}/${id}/${crypto.randomUUID()}.pdf`;
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('bfe-booking-proofs',$1)",
    [path],
  );
  await expect(
    as(other, "bfe_submit_booking_proof($1,$2,150000)", [id, path]),
  ).rejects.toThrow(/not available/);
  await expect(
    as(resident, "bfe_submit_booking_proof($1,$2,100)", [id, path]),
  ).rejects.toThrow(/20%/);
  await as(resident, "bfe_submit_booking_proof($1,$2,150000)", [id, path]);
  await as(resident, "bfe_submit_booking_proof($1,$2,150000)", [id, path]);
  const b = await db.query<{ version: number }>(
    "SELECT version FROM bfe_bookings WHERE id=$1",
    [id],
  );
  expect(b.rows[0].version).toBe(2);
  expect(
    (await db.query("SELECT * FROM bfe_amenity_payments")).rows,
  ).toHaveLength(0);
  await db.exec("TRUNCATE bfe_booking_payment_settings");
  await expect(
    as(resident, "bfe_submit_booking_proof($1,$2,150000)", [id, path]),
  ).resolves.toBeDefined();
});
it("filters carpool offers and requests before pagination without exposing private fields", async () => {
  await grant(resident, "transport", "view", "approved");
  for (const kind of ["Offering a ride", "Looking for a ride"])
    await db.query(
      "INSERT INTO bfe_feature_records(module,owner_id,client_id,title,detail,fields,status,public_title,public_body,audience,audiences,expires_at) VALUES('carpools',$1,$2,'Synthetic ride','Synthetic ride details',$3,'Published','Synthetic ride','Synthetic ride details','homeowner',ARRAY['homeowner','renter'],now()+interval '1 day')",
      [
        resident,
        crypto.randomUUID(),
        { kind, contact: "private-synthetic-marker" },
      ],
    );
  const result = await as<{
    total: number;
    rows: { fields: { kind: string } }[];
  }>(
    resident,
    "bfe_excel_carpool_dashboard('carpools','published',0,'','Offering a ride')",
  );
  expect(result?.total).toBe(1);
  expect(result?.rows[0].fields.kind).toBe("Offering a ride");
  expect(JSON.stringify(result)).not.toContain("private-synthetic-marker");
});

it("lets a Livelihood committee handler answer Support without gaining admin access", async () => {
  await db.query(
    "INSERT INTO bfe_access_assignments(user_id,committee_id,approval_reference) VALUES($1,'livelihood','Synthetic committee assignment')",
    [other],
  );
  await db.exec(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('committee','livelihood','requests','association','edit') ON CONFLICT DO NOTHING",
  );
  await grant(resident, "requests", "create", "own");
  const create = async (category: string) =>
    (await as<{ id: string }>(
      resident,
      "bfe_create_request($1,'Synthetic help request','Synthetic routing description',$2)",
      [crypto.randomUUID(), category],
    ))!.id;
  const support = await create("Support"),
    complaint = await create("Complaint");
  await expect(
    as(other, "bfe_reply_request($1,$2,'Synthetic team response')", [
      support,
      crypto.randomUUID(),
    ]),
  ).resolves.toBeDefined();
  await expect(
    as(other, "bfe_reply_request($1,$2,'Synthetic team response')", [
      complaint,
      crypto.randomUUID(),
    ]),
  ).rejects.toThrow(/cannot reply/);
  expect(await as(other, "bfe_can('accounts','manage','association')")).toBe(
    false,
  );
  expect(
    await as(other, "bfe_request_business_context($1)", [support]),
  ).toMatchObject({ can_handle: true });
  const version = (
    await db.query<{ version: number }>(
      "SELECT version FROM bfe_requests WHERE id=$1",
      [support],
    )
  ).rows[0].version;
  await expect(
    as(
      other,
      "bfe_save_request_handling($1,$2,0,'Normal',NULL,'','Synthetic team handling')",
      [support, version],
    ),
  ).resolves.toMatchObject({ priority: "Normal" });
  expect(
    (
      await db.query(
        "SELECT * FROM bfe_notifications WHERE recipient_id=$1 AND path='/services/team-requests'",
        [other],
      )
    ).rows.length,
  ).toBeGreaterThan(0);
});

it("sends one follow-up per unanswered request after three days", async () => {
  await db.query("UPDATE members SET role='board' WHERE user_id=$1", [other]);
  await db.exec(
    "INSERT INTO bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES('role','board','requests','association','edit') ON CONFLICT DO NOTHING",
  );
  await grant(resident, "requests", "create", "own");
  const r = await as<{ id: string }>(
    resident,
    "bfe_create_request($1,'Synthetic delayed concern','Synthetic routing description','Concern')",
    [crypto.randomUUID()],
  );
  await db.query(
    "UPDATE bfe_requests SET created_at=now()-interval '4 days' WHERE id=$1",
    [r!.id],
  );
  await db.exec(
    "SELECT bfe_send_helpdesk_followups();SELECT bfe_send_helpdesk_followups()",
  );
  expect(
    (
      await db.query(
        "SELECT * FROM bfe_notifications WHERE recipient_id=$1 AND event_key LIKE 'request-followup:%'",
        [other],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(as(resident, "bfe_send_helpdesk_followups()")).rejects.toThrow(
    /permission denied/,
  );
  await db.query("UPDATE members SET role='homeowner' WHERE user_id=$1", [
    other,
  ]);
});

it("keeps booking references unique after the counter reaches four digits", async () => {
  await setupPool();
  await db.exec("SELECT setval('bfe_booking_reference_seq',1000,false)");
  const id = await booking();
  const reference = await db.query<{ reference: string }>(
    "SELECT reference FROM bfe_booking_checkout WHERE booking_id=$1",
    [id],
  );
  expect(reference.rows[0].reference).toMatch(/-1000$/);
});

async function accessSnapshot(kind: string, subject: string) {
  return (await as<{ snapshot: { rules: unknown[]; actions: unknown[] } }>(
    developer,
    "bfe_access_editor($1,$2)",
    [kind, subject],
  ))!.snapshot;
}
it("saves explicit role approval defaults and individual blocks without changing roles", async () => {
  await db.query("UPDATE members SET role='admin' WHERE user_id=$1", [other]);
  const initial = await accessSnapshot("role", "admin");
  const next = {
    rules: [{ module: "calendar", scope: "association", mode: "edit" }],
    actions: [
      {
        module: "calendar",
        scope: "association",
        action: "approve",
        effect: "allow",
      },
    ],
  };
  await as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
    "role",
    "admin",
    initial,
    next,
    "Synthetic approval assignment",
  ]);
  expect(await as(other, "bfe_can('calendar','approve','association')")).toBe(
    true,
  );
  const own = await accessSnapshot("user", other);
  await as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
    "user",
    other,
    own,
    {
      rules: [],
      actions: [
        {
          module: "calendar",
          scope: "association",
          action: "approve",
          effect: "deny",
        },
      ],
    },
    "Synthetic individual restriction",
  ]);
  expect(await as(other, "bfe_can('calendar','approve','association')")).toBe(
    false,
  );
  expect(await as(other, "bfe_can('calendar','view','association')")).toBe(
    true,
  );
  expect(
    (
      await db.query<{ role: string }>(
        "SELECT role FROM members WHERE user_id=$1",
        [other],
      )
    ).rows[0].role,
  ).toBe("admin");
});
it("keeps legacy denies, view-only restrictions and stale-write checks effective", async () => {
  const initial = await accessSnapshot("user", other);
  const next = {
    rules: [{ module: "calendar", scope: "association", mode: "edit" }],
    actions: [
      {
        module: "calendar",
        scope: "association",
        action: "approve",
        effect: "allow",
      },
    ],
  };
  await as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
    "user",
    other,
    initial,
    next,
    "Synthetic booking assignment",
  ]);
  await expect(
    as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
      "user",
      other,
      initial,
      next,
      "Synthetic stale attempt",
    ]),
  ).rejects.toThrow(/Access changed/);
  await grant(other, "calendar", "approve", "association", "deny");
  expect(await as(other, "bfe_can('calendar','approve','association')")).toBe(
    false,
  );
  await db.exec("DELETE FROM bfe_access_grants");
  const saved = await accessSnapshot("user", other);
  await as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
    "user",
    other,
    saved,
    {
      ...next,
      rules: [{ module: "calendar", scope: "association", mode: "view" }],
    },
    "Synthetic read only",
  ]);
  expect(await as(other, "bfe_can('calendar','approve','association')")).toBe(
    false,
  );
  expect(await as(other, "bfe_can('calendar','view','association')")).toBe(
    true,
  );
});
it("rejects resident access management and delegated manager escalation atomically", async () => {
  await expect(
    as(resident, "bfe_access_editor('user',$1)", [resident]),
  ).rejects.toThrow(/Access manager/);
  await db.query("UPDATE members SET role='admin' WHERE user_id=$1", [other]);
  await db.query("INSERT INTO bfe_access_managers(user_id) VALUES($1)", [
    other,
  ]);
  const initial = await accessSnapshot("user", resident);
  const next = {
    rules: [{ module: "calendar", scope: "association", mode: "edit" }],
    actions: [
      {
        module: "finance",
        scope: "association",
        action: "approve",
        effect: "allow",
      },
    ],
  };
  await expect(
    as(other, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
      "user",
      resident,
      initial,
      next,
      "Synthetic escalation attempt",
    ]),
  ).rejects.toThrow(/beyond your own|do not hold/);
  expect(await accessSnapshot("user", resident)).toEqual(initial);
});
it("restores inherited action permissions and preserves developer recovery", async () => {
  const initial = await accessSnapshot("user", other);
  await as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
    "user",
    other,
    initial,
    {
      rules: [{ module: "calendar", scope: "association", mode: "edit" }],
      actions: [
        {
          module: "calendar",
          scope: "association",
          action: "approve",
          effect: "allow",
        },
      ],
    },
    "Synthetic assignment",
  ]);
  const saved = await accessSnapshot("user", other);
  await as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
    "user",
    other,
    saved,
    { rules: [], actions: [] },
    "Synthetic restore defaults",
  ]);
  expect(await as(other, "bfe_can('calendar','approve','association')")).toBe(
    false,
  );
  const protectedSnapshot = await accessSnapshot("user", developer);
  await expect(
    as(developer, "bfe_save_access_editor($1,$2,$3,$4,$5)", [
      "user",
      developer,
      protectedSnapshot,
      { rules: [], actions: [] },
      "Synthetic recovery change",
    ]),
  ).rejects.toThrow(/recovery/);
});

it("validates the renamed permit choices and their conditional required fields", async () => {
  for (const permit of ["Construction Permit", "Renovation Permit"]) {
    const fields: Record<string, unknown> = {
      ...sampleBaselineFields("permits"),
      permit,
    };
    await expect(
      db.query("SELECT bfe_validate_feature_fields('permits',$1)", [fields]),
    ).resolves.toBeDefined();
    const missing = { ...fields };
    delete missing.contractor;
    await expect(
      db.query("SELECT bfe_validate_feature_fields('permits',$1)", [missing]),
    ).rejects.toThrow(/Check field/);
  }
});

it("refuses an existing public proof bucket instead of silently exposing uploads", async () => {
  const migration = await readFile(
    new URL(
      "../migrations/202611260102_excel_booking_payments.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const guard = migration.match(
    /DO \$proof_bucket\$[\s\S]*?END;\$proof_bucket\$;/,
  )?.[0];
  if (!guard) throw new Error("Proof bucket privacy guard missing");
  await db.query(
    "UPDATE storage.buckets SET public=true WHERE id='bfe-booking-proofs'",
  );
  try {
    await expect(db.exec(guard)).rejects.toThrow(/must be private/);
  } finally {
    await db.query(
      "UPDATE storage.buckets SET public=false WHERE id='bfe-booking-proofs'",
    );
  }
  await expect(db.exec(guard)).resolves.toBeDefined();
});

it("rejects proof and verified payments above the total without recording a charge", async () => {
  await setupPool();
  const id = await booking();
  const path = `${resident}/${id}/${crypto.randomUUID()}.pdf`;
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('bfe-booking-proofs',$1)",
    [path],
  );
  await expect(
    as(resident, "bfe_submit_booking_proof($1,$2,750001)", [id, path]),
  ).rejects.toThrow(/amount/);
  await expect(
    as(
      developer,
      "bfe_approve_excel_booking($1,1,500000,250000,750001,'SYNTHETIC-OVERPAY','Synthetic payment matched')",
      [id],
    ),
  ).rejects.toThrow(/cannot exceed/);
  expect(
    (await db.query("SELECT * FROM bfe_amenity_charges")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM bfe_bookings WHERE id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("Pending");
});

it("requires payment verification for new bookings made through the legacy RPC too", async () => {
  await setupPool();
  const id = await as<string>(
    resident,
    "bfe_create_booking($1,$2,$3,$4,'Synthetic legacy request',2)",
    [
      crypto.randomUUID(),
      pool,
      bookingDay + "T09:00:00+08:00",
      bookingDay + "T11:00:00+08:00",
    ],
  );
  const checkout = await as<{ checkout: { reference: string } }>(
    resident,
    "bfe_booking_checkout_read($1)",
    [id],
  );
  expect(checkout?.checkout.reference).toMatch(/^SP-/);
  await expect(
    as(
      developer,
      "bfe_approve_booking_with_fee($1,1,500000,0,250000,'Synthetic legacy approval')",
      [id],
    ),
  ).rejects.toThrow(/Verify the booking payment/);
  expect(
    (await db.query("SELECT * FROM bfe_amenity_charges")).rows,
  ).toHaveLength(0);
});

it("runs the read-only rollout inventory against the installed synthetic migration chain", async () => {
  const sql = await readFile(
    new URL("../../scripts/verify-excel-rollout.sql", import.meta.url),
    "utf8",
  );
  const results = await db.exec(sql);
  expect(results[0].rows).toHaveLength(7);
  expect(results[0].rows.every((row) => row.present === true)).toBe(true);
  expect(results[1].rows).toHaveLength(7);
  expect(results[1].rows.every((row) => row.installed_marker === true)).toBe(
    true,
  );
  expect(results[2].rows[0].publicly_readable).toBe(false);
});

it("keeps homeowner business listings pending and rejects self-publication", async () => {
  const id = await as<string>(
    resident,
    "bfe_submit_feature($1,'businesses','Synthetic neighborhood service','Synthetic business for review',$2,true)",
    [crypto.randomUUID(), sampleBaselineFields("businesses")],
  );
  expect(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM bfe_feature_records WHERE id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("Submitted");
  await expect(
    as(
      resident,
      "bfe_review_feature($1,1,'Published','Synthetic self publication')",
      [id],
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM bfe_feature_records WHERE id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("Submitted");
});
