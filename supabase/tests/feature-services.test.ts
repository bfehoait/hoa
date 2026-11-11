import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import {
  baselineModules,
  fieldVisible,
  sampleBaselineFields,
} from "../../packages/shared/src/baseline";
import { featureDashboardSchema } from "../../packages/shared/src/feature-records";
import { memberInspectionSchema } from "../../packages/shared/src/member-inspection";
import {
  bookingDashboardSchema,
  visitorDashboardSchema,
} from "../../packages/shared/src/operations";
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
    // Keep the synthetic schema aligned with the current shared form
    // contract. These optional questions are part of the live definitions.
    "202611100049_business_submission_questions.sql",
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
type PermissionSummary = {
  rules: Record<string, string>;
  effective: Record<
    string,
    { read: boolean; create: boolean; reply: boolean; status: boolean }
  > | null;
};
const summary = (id: string, scope = "own", caller = developer) =>
  as<PermissionSummary>(caller, "bfe_tab_access('user',$1,$2)", [id, scope]);
it("reports actual inherited and individual permissions without changing rules", async () => {
  await as(
    developer,
    "bfe_save_tab_access('role','homeowner','own',$1,'{}','Synthetic defaults')",
    [{ requests: "view" }],
  );
  const inherited = await summary(resident);
  expect(inherited?.rules).toEqual({});
  expect(inherited?.effective?.requests).toEqual({
    read: true,
    create: false,
    reply: false,
    status: false,
  });
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,'{}','Synthetic override')",
    [resident, { requests: "edit" }],
  );
  expect((await summary(resident))?.effective?.requests).toEqual({
    read: true,
    create: true,
    reply: true,
    status: true,
  });
  expect(
    (await summary(resident, "association"))?.effective?.requests.read,
  ).toBe(false);
  const rows = await db.query(
    "SELECT subject_kind,subject_id,module,mode FROM bfe_tab_rules ORDER BY subject_kind",
  );
  expect(rows.rows).toHaveLength(2);
});
it("permission summaries preserve explicit denials and partial editing rights", async () => {
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,'{}','Synthetic edit rule')",
    [resident, { requests: "edit" }],
  );
  await grant(resident, "requests", "reply", "own", "deny");
  expect((await summary(resident))?.effective?.requests).toEqual({
    read: true,
    create: true,
    reply: false,
    status: true,
  });
  await db.query(
    "UPDATE bfe_access_assignments SET starts_at=now()-interval '2 days',expires_at=now()-interval '1 second' WHERE user_id=$1",
    [resident],
  );
  expect((await summary(resident))?.effective?.requests.reply).toBe(true);
});
it("inactive accounts report no permissions and group rules are not member summaries", async () => {
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    resident,
  ]);
  const result = await summary(resident);
  expect(
    Object.values(result?.effective ?? {}).every(
      (p) => !p.read && !p.create && !p.reply && !p.status,
    ),
  ).toBe(true);
  expect(Object.keys(result?.effective ?? {})).toHaveLength(19);
  const group = await as<PermissionSummary>(
    developer,
    "bfe_tab_access('role','homeowner','own')",
  );
  expect(group?.effective).toBeNull();
});
it("permission summaries are manager-only and do not expose helper execution", async () => {
  await expect(summary(resident, "own", other)).rejects.toThrow(/manager/i);
  await expect(
    as(null, "bfe_tab_access('user',$1,'own')", [resident]),
  ).rejects.toThrow();
  await db.query(
    "UPDATE members SET extra_roles=ARRAY['admin'] WHERE user_id=$1",
    [other],
  );
  await as(
    developer,
    "bfe_set_access_manager($1,true,'Synthetic delegation')",
    [other],
  );
  expect(
    (await summary(resident, "own", other))?.effective?.requests.read,
  ).toBe(true);
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "SELECT has_function_privilege('authenticated','bfe_can_for(uuid,text,text,text)','EXECUTE') AS allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
});
it("permission summaries reject invalid scope, kind and unknown account", async () => {
  await expect(summary(resident, "unknown")).rejects.toThrow(
    /valid data scope/,
  );
  await expect(
    as(developer, "bfe_tab_access('unknown','homeowner','own')"),
  ).rejects.toThrow(/valid data scope/);
  await expect(summary("81000000-0000-4000-8000-000000000099")).rejects.toThrow(
    /unavailable/,
  );
});
it("installation verification reports private access tables and guarded listing storage", async () => {
  const sql = await readFile(
    new URL("../../scripts/verify-ui-access-media.sql", import.meta.url),
    "utf8",
  );
  const results = await db.exec(sql);
  const row = results
    .flatMap((r) => r.rows)
    .find((r) => "ui_access_media_verification" in r) as {
    ui_access_media_verification: Record<string, unknown>;
  };
  expect(row.ui_access_media_verification).toMatchObject({
    private_tables: 3,
    storage_guards: 5,
    anonymous_blocked: true,
    authenticated_endpoints: true,
    cover_bucket_private: true,
    tab_access_installed: true,
    permission_summaries_installed: true,
    listing_media_installed: true,
  });
});
it("tab defaults inherit until changed; view-only blocks server mutations and individual overrides win", async () => {
  await as(
    developer,
    "bfe_save_tab_access('role','homeowner','own',$1,'{}','Synthetic default')",
    [{ requests: "view" }],
  );
  const access = await as<{
    capabilities: { module: string; action: string; scope: string }[];
  }>(resident, "bfe_my_access()");
  expect(
    access?.capabilities.some(
      (c) =>
        c.module === "requests" && c.action === "view" && c.scope === "own",
    ),
  ).toBe(true);
  expect(
    access?.capabilities.some(
      (c) =>
        c.module === "requests" && c.action === "create" && c.scope === "own",
    ),
  ).toBe(false);
  await expect(
    as(
      resident,
      "bfe_create_request($1,'Synthetic request','Synthetic request description','Maintenance')",
      [crypto.randomUUID()],
    ),
  ).rejects.toThrow();
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,'{}','Synthetic override')",
    [resident, { requests: "edit" }],
  );
  const own = await as<{ capabilities: { module: string; action: string }[] }>(
    resident,
    "bfe_my_access()",
  );
  expect(
    own?.capabilities.some(
      (c) => c.module === "requests" && c.action === "create",
    ),
  ).toBe(true);
  await expect(
    as(
      developer,
      "bfe_save_tab_access('user',$1,'own',$2,'{}','Stale synthetic save')",
      [resident, { requests: "hidden" }],
    ),
  ).rejects.toThrow(/changed/i);
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,$3,'Synthetic hide')",
    [resident, { requests: "hidden" }, { requests: "edit" }],
  );
  const hidden = await as<{ capabilities: { module: string }[] }>(
    resident,
    "bfe_my_access()",
  );
  expect(hidden?.capabilities.some((c) => c.module === "requests")).toBe(false);
});
it("only designated active admins manage access, cannot elevate themselves or create developers", async () => {
  await db.query(
    "UPDATE members SET extra_roles=ARRAY['admin'] WHERE user_id=$1",
    [other],
  );
  await expect(
    as(other, "bfe_tab_access('role','homeowner','own')"),
  ).rejects.toThrow(/manager/i);
  await as(
    developer,
    "bfe_set_access_manager($1,true,'Synthetic delegation')",
    [other],
  );
  const manager = await as<{ access_manager: boolean }>(
    other,
    "bfe_my_access()",
  );
  expect(manager?.access_manager).toBe(true);
  await expect(
    as(other, "bfe_set_access_manager($1,true,'Synthetic escalation')", [
      resident,
    ]),
  ).rejects.toThrow(/Developer/);
  await expect(
    as(
      other,
      "bfe_save_tab_access('user',$1,'association',$2,'{}','Synthetic escalation')",
      [resident, { finance: "edit" }],
    ),
  ).rejects.toThrow(/beyond/);
  await expect(
    as(
      other,
      "bfe_provision_access($1,'maintenance','finance','view','association','allow','Synthetic escalation')",
      [other],
    ),
  ).rejects.toThrow();
  await expect(
    as(
      other,
      "bfe_save_tab_access('role','homeowner','own',$1,'{}','Synthetic mutation')",
      [{ technical: "edit" }],
    ),
  ).rejects.toThrow();
  await as(developer, "bfe_set_access_manager($1,false,'Synthetic revoke')", [
    other,
  ]);
  await expect(
    as(other, "bfe_tab_access('role','homeowner','own')"),
  ).rejects.toThrow();
});
it("hides registry and shuttle reads and blocks legacy lot claims when view-only is assigned", async () => {
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,'{}','Synthetic restrictions')",
    [resident, { transport: "hidden", property: "hidden" }],
  );
  await expect(as(resident, "bfe_shuttle_dashboard()")).rejects.toThrow(
    /hidden/i,
  );
  const registry = await as<{ total: number }>(resident, "bfe_list_lots()");
  expect(registry?.total).toBe(0);
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,$3,'Synthetic read only')",
    [
      resident,
      { property: "view" },
      { transport: "hidden", property: "hidden" },
    ],
  );
  await expect(
    as(resident, "bfe_claim_lot('1-01-001','household')"),
  ).rejects.toThrow(/view only/i);
});
it("committee defaults require current membership and view only does not approve publications", async () => {
  await grant(resident, "livelihood", "view", "own");
  await as(
    developer,
    "bfe_save_tab_access('committee','maintenance','own',$1,'{}','Synthetic committee')",
    [{ livelihood: "view" }],
  );
  const read = await as<{ capabilities: { module: string; action: string }[] }>(
    resident,
    "bfe_my_access()",
  );
  expect(
    read?.capabilities.some(
      (c) => c.module === "livelihood" && c.action === "create",
    ),
  ).toBe(false);
  const assignment = await db.query<{ id: string }>(
    "SELECT id FROM bfe_access_assignments WHERE user_id=$1",
    [resident],
  );
  await as(developer, "bfe_revoke_assignment($1,'Synthetic revoke')", [
    assignment.rows[0].id,
  ]);
  const restored = await as<{
    capabilities: { module: string; action: string }[];
  }>(resident, "bfe_my_access()");
  expect(
    restored?.capabilities.some(
      (c) => c.module === "livelihood" && c.action === "create",
    ),
  ).toBe(true);
  await expect(
    as(null, "bfe_tab_access('role','homeowner','own')"),
  ).rejects.toThrow();
  await expect(
    as(resident, "bfe_tab_access('role','homeowner','own')"),
  ).rejects.toThrow();
  await expect(
    as(
      resident,
      "bfe_save_tab_access('user',$1,'own',$2,'{}','Synthetic forbidden')",
      [resident, { livelihood: "edit" }],
    ),
  ).rejects.toThrow();
});
const startInspection = (
  actor = developer,
  target = resident,
  client = crypto.randomUUID(),
  reason = "Synthetic support troubleshooting",
) =>
  as<{ id: string; expires_at: string }>(
    actor,
    "bfe_start_member_inspection($1,$2,$3)",
    [client, target, reason],
  );
const inspect = (id: string, actor = developer, section = "requests") =>
  as(actor, "bfe_inspect_member($1,$2)", [id, section]);
const previewRead = (
  session: string,
  name: string,
  args: Record<string, unknown> = {},
  actor = developer,
) => as(actor, "bfe_account_preview_read($1,$2,$3)", [session, name, args]);
it("renders existing read endpoints under the target capabilities and never allows writes", async () => {
  const session = await startInspection();
  const member = (await previewRead(session!.id, "bfe_get_member")) as {
    user_id: string;
  };
  expect(member.user_id).toBe(resident);
  const access = (await previewRead(session!.id, "bfe_my_access")) as {
    developer_control: boolean;
  };
  expect(access.developer_control).toBe(false);
  for (const name of [
    "bfe_create_request",
    "bfe_mark_notifications",
    "bfe_update_member_access",
    "bfe_start_member_inspection",
    "bfe_account_preview_read",
  ])
    await expect(previewRead(session!.id, name)).rejects.toThrow(/disabled/);
  await expect(
    previewRead(session!.id, "bfe_get_member", { unexpected: "x" }),
  ).rejects.toThrow(/Unexpected/);
  await expect(
    previewRead(session!.id, "bfe_staff_directory", {
      p_kind: "members",
      p_page: 0,
      p_search: "",
      p_field: "name",
      p_status: "",
    }),
  ).rejects.toThrow(/Office access/);
  const checks = await db.exec(
    await readFile(
      new URL("../../scripts/verify-account-preview.sql", import.meta.url),
      "utf8",
    ),
  );
  const flags = checks
    .flatMap((r) => r.rows)
    .find((r) => "account_preview_verification" in r)
    ?.account_preview_verification as Record<string, boolean>;
  expect(Object.values(flags).every(Boolean)).toBe(true);
});
it("fails closed if an allowed read endpoint is no longer stable", async () => {
  const session = await startInspection();
  await db.exec("ALTER FUNCTION public.bfe_get_profile() VOLATILE");
  try {
    await expect(previewRead(session!.id, "bfe_get_profile")).rejects.toThrow(
      /unavailable/,
    );
  } finally {
    await db.exec("ALTER FUNCTION public.bfe_get_profile() STABLE");
  }
});
it("restores the real actor after successful and failed preview reads", async () => {
  await db.exec(
    `CREATE OR REPLACE FUNCTION public.bfe_test_context_restore(p_session uuid,p_fail boolean) RETURNS uuid LANGUAGE plpgsql AS $$BEGIN BEGIN IF p_fail THEN PERFORM public.bfe_account_preview_read(p_session,'bfe_lot_detail','{"p_lot":"88000000-0000-4000-8000-000000000001"}'); ELSE PERFORM public.bfe_account_preview_read(p_session,'bfe_get_member','{}'); END IF;EXCEPTION WHEN OTHERS THEN NULL;END;RETURN auth.uid();END;$$;`,
  );
  const session = await startInspection();
  for (const failed of [false, true])
    expect(
      await as(developer, "bfe_test_context_restore($1,$2)", [
        session!.id,
        failed,
      ]),
    ).toBe(developer);
  const rows = await db.query<{ actor_id: string }>(
    "SELECT actor_id FROM bfe_member_inspection_audit",
  );
  expect(rows.rows.every((r) => r.actor_id === developer)).toBe(true);
});
it("protects preview request rows and threads against other households", async () => {
  const own = await as<{ id: string }>(
    resident,
    "bfe_create_request($1,'Own synthetic request','Synthetic own request description','Idea')",
    [crypto.randomUUID()],
  );
  const foreign = await as<{ id: string }>(
    other,
    "bfe_create_request($1,'Other synthetic request','Synthetic other request description','Idea')",
    [crypto.randomUUID()],
  );
  const session = await startInspection();
  const rows = (await previewRead(session!.id, "bfe_preview_requests")) as {
    records: Array<{ id: string }>;
    total: number;
  };
  expect(rows.total).toBe(1);
  expect(rows.records[0].id).toBe(own!.id);
  await expect(
    previewRead(session!.id, "bfe_preview_request_thread", {
      p_id: foreign!.id,
    }),
  ).rejects.toThrow(/unavailable/);
  await expect(as(resident, "bfe_preview_requests()")).rejects.toThrow(
    /permission denied/,
  );
  await expect(
    previewRead(session!.id, "bfe_get_member", {}, other),
  ).rejects.toThrow(/developer/);
  await as(developer, "bfe_end_member_inspection($1)", [session!.id]);
  await expect(previewRead(session!.id, "bfe_get_member")).rejects.toThrow(
    /expired/,
  );
});
it("checks each supported member section and the read-only inspection verification script", async () => {
  await grant(resident, "security", "view", "own");
  const session = await startInspection();
  for (const section of [
    "requests",
    "submissions",
    "bookings",
    "visitor-passes",
    "shuttle",
    "participation",
  ])
    expect(
      memberInspectionSchema.parse(
        await inspect(session!.id, developer, section),
      ).rows,
    ).toEqual([]);
  const sql = await readFile(
    new URL("../../scripts/verify-member-inspection.sql", import.meta.url),
    "utf8",
  );
  const results = await db.exec(sql);
  const result = results
    .flatMap((r) => r.rows)
    .find((r) => "member_inspection_verification" in r)
    ?.member_inspection_verification as {
    private_tables: number;
    authenticated_endpoints: boolean;
    anonymous_blocked: boolean;
  };
  expect(result).toMatchObject({
    private_tables: 2,
    authenticated_endpoints: true,
    anonymous_blocked: true,
  });
});
it("limits member inspection to actual active developers, with private audit tables", async () => {
  await expect(startInspection(resident)).rejects.toThrow(/developer/);
  await expect(
    as(
      null,
      "bfe_start_member_inspection(gen_random_uuid(),$1,'Synthetic support reason')",
      [resident],
    ),
  ).rejects.toThrow(/permission denied/);
  await expect(
    startInspection(developer, resident, crypto.randomUUID(), "short"),
  ).rejects.toThrow(/reason/);
  const session = await startInspection();
  await expect(inspect(session!.id, other)).rejects.toThrow(/developer/);
  await expect(
    as(resident, "(SELECT count(*) FROM bfe_member_inspections)"),
  ).rejects.toThrow(/permission denied/);
});
it("shows only the selected member own records, keeps the developer identity and audits reads", async () => {
  for (const user of [resident, other])
    await as(
      user,
      "bfe_create_request($1,'Synthetic private request','Synthetic private request details','Idea')",
      [crypto.randomUUID()],
    );
  const session = await startInspection();
  const data = memberInspectionSchema.parse(await inspect(session!.id));
  expect(data.read_only).toBe(true);
  expect(data.member.user_id).toBe(resident);
  expect(data.total).toBe(1);
  const identity = await as<{ actor: string }>(
    developer,
    "jsonb_build_object('read',bfe_inspect_member($1),'actor',auth.uid())",
    [session!.id],
  );
  expect(identity?.actor).toBe(developer);
  await expect(
    as(
      developer,
      "bfe_create_request(gen_random_uuid(),'Synthetic request','Synthetic request details','Idea')",
    ),
  ).rejects.toThrow(/resident/i);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::integer n FROM bfe_member_inspection_audit WHERE action='Viewed'",
      )
    ).rows[0].n,
  ).toBe(2);
});
it("honors target capability denial and current inactive membership", async () => {
  await as(
    resident,
    "bfe_create_request(gen_random_uuid(),'Synthetic request','Synthetic request details','Idea')",
  );
  const session = await startInspection();
  await grant(resident, "requests", "view", "own", "deny");
  expect(
    memberInspectionSchema.parse(await inspect(session!.id)).rows,
  ).toHaveLength(0);
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    resident,
  ]);
  const result = memberInspectionSchema.parse(await inspect(session!.id));
  expect(result.active_roles).toEqual([]);
  expect(result.capabilities).toEqual([]);
  expect(result.rows).toEqual([]);
});
it("expires inspections, ends them explicitly, and supersedes a previous inspection", async () => {
  const first = await startInspection();
  const second = await startInspection(developer, other);
  await expect(inspect(first!.id)).rejects.toThrow(/expired/);
  await as(developer, "bfe_end_member_inspection($1)", [second!.id]);
  await expect(inspect(second!.id)).rejects.toThrow(/expired/);
  const third = await startInspection();
  await db.query(
    "UPDATE bfe_member_inspections SET created_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
    [third!.id],
  );
  await expect(inspect(third!.id)).rejects.toThrow(/expired/);
});
it("binds inspection references to a single member/reason and rechecks developer revocation", async () => {
  const client = crypto.randomUUID(),
    first = await startInspection(developer, resident, client);
  expect((await startInspection(developer, resident, client))?.id).toBe(
    first?.id,
  );
  await expect(startInspection(developer, other, client)).rejects.toThrow(
    /reference/,
  );
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    developer,
  ]);
  await expect(inspect(first!.id)).rejects.toThrow(/developer/);
});
it("rejects ambiguous targets and cross-developer session reuse", async () => {
  await db.query(
    "UPDATE members SET extra_roles=ARRAY['developer'] WHERE user_id=$1",
    [other],
  );
  const session = await startInspection();
  await expect(inspect(session!.id, other)).rejects.toThrow(/expired/);
  await db.query(
    "INSERT INTO members(id,user_id,name,role) VALUES('duplicate-synthetic',$1,'Synthetic duplicate','homeowner')",
    [resident],
  );
  await expect(startInspection()).rejects.toThrow(/ambiguous/);
  await expect(inspect(session!.id)).rejects.toThrow(/ambiguous/);
  await db.query("DELETE FROM members WHERE id='duplicate-synthetic'");
});
const submit = (
  user = resident,
  module = "businesses",
  fields = sampleBaselineFields(module),
  client = crypto.randomUUID(),
  consent = true,
) =>
  as<string>(user, "bfe_submit_feature($1,$2,$3,$4,$5,$6)", [
    client,
    module,
    "Synthetic feature",
    "Synthetic private submission details",
    fields,
    consent,
  ]);
const dashboard = (user = resident, view = "mine", module = "businesses") =>
  as(user, "bfe_feature_dashboard($1,$2)", [module, view]);
const review = (
  id: string,
  status: string,
  version: number,
  body = "Synthetic approved public description",
  consent = true,
) =>
  as(
    developer,
    "bfe_review_feature($1,$2,$3,$4,$5,$6,$7,now()+interval '1 day')",
    [
      id,
      version,
      status,
      "Synthetic review reason",
      "Synthetic public title",
      body,
      consent ? "members" : "board",
    ],
  );
it("installs and validates every project-owned module definition", async () => {
  for (const m of baselineModules)
    await db.query("SELECT bfe_validate_feature_fields($1,$2)", [
      m.id,
      sampleBaselineFields(m.id, "81000000-0000-4000-8000-000000000001"),
    ]);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::integer n FROM bfe_feature_definitions",
      )
    ).rows[0].n,
  ).toBe(baselineModules.length);
});
it("developer-only accounts can create announcements and all connected submission types", async () => {
  for (const module of baselineModules) {
    const result = featureDashboardSchema.parse(
      await dashboard(developer, "mine", module.id),
    );
    expect(result.can_create, module.id).toBe(true);
  }
  for (const module of ["publishing", "businesses"]) {
    const id = await submit(developer, module, sampleBaselineFields(module));
    const record = await db.query<{ status: string; owner_id: string }>(
      "SELECT status,owner_id FROM bfe_feature_records WHERE id=$1",
      [id],
    );
    expect(record.rows[0]).toEqual({
      status: "Submitted",
      owner_id: developer,
    });
  }
});
it("keeps listing links and covers private until publication, rejects unsafe links, and forces re-review after edits", async () => {
  const id = (await submit())!;
  const links = [
    {
      label: "Synthetic business",
      url: "https://business.example.test/contact",
    },
  ];
  await as(resident, "bfe_save_listing_links($1,$2)", [id, links]);
  await expect(as(other, "bfe_listing_media($1)", [id])).rejects.toThrow(
    /unavailable/i,
  );
  await expect(
    as(resident, "bfe_save_listing_links($1,$2)", [
      id,
      [{ label: "Unsafe", url: "javascript:alert(1)" }],
    ]),
  ).rejects.toThrow();
  const path = await as<string>(resident, "bfe_prepare_listing_cover($1)", [
    id,
  ]);
  await expect(as(other, "synthetic_upload($1)", [path])).rejects.toThrow();
  await as(resident, "synthetic_upload($1)", [path]);
  await db.exec(
    "CREATE POLICY synthetic_broad_storage_read ON storage.objects FOR SELECT TO authenticated,anon USING(true)",
  );
  expect(
    await as(other, "EXISTS(SELECT 1 FROM storage.objects WHERE name=$1)", [
      path,
    ]),
  ).toBe(false);
  expect(
    await as(null, "EXISTS(SELECT 1 FROM storage.objects WHERE name=$1)", [
      path,
    ]),
  ).toBe(false);
  await expect(as(resident, "synthetic_upload($1)", [path])).rejects.toThrow();
  await expect(review(id, "In review", 1)).rejects.toThrow(/changed/i);
  await review(id, "In review", 3);
  await expect(
    as(resident, "bfe_save_listing_links($1,$2)", [id, []]),
  ).rejects.toThrow();
  await review(id, "Published", 4);
  const published = await as<{ cover_path: string; links: unknown[] }>(
    other,
    "bfe_listing_media($1)",
    [id],
  );
  expect(published?.cover_path).toBe(path);
  expect(published?.links).toEqual(links);
  expect(
    await as(other, "EXISTS(SELECT 1 FROM storage.objects WHERE name=$1)", [
      path,
    ]),
  ).toBe(true);
  expect(
    await as(null, "EXISTS(SELECT 1 FROM storage.objects WHERE name=$1)", [
      path,
    ]),
  ).toBe(false);
  await expect(
    as(
      other,
      "bfe_revise_listing($1,5,'Synthetic edit','Synthetic replacement details',$2,true)",
      [id, sampleBaselineFields("businesses")],
    ),
  ).rejects.toThrow();
  await as(
    resident,
    "bfe_revise_listing($1,5,'Synthetic edit','Synthetic replacement details',$2,true)",
    [id, sampleBaselineFields("businesses")],
  );
  await expect(as(other, "bfe_listing_media($1)", [id])).rejects.toThrow();
  const publicRows = featureDashboardSchema.parse(
    await dashboard(other, "published"),
  );
  expect(publicRows.rows).toHaveLength(0);
});
it("requires consent and edit access for media; expiry and withdrawal revoke new reads", async () => {
  const noConsent = (await submit(
    resident,
    "businesses",
    sampleBaselineFields("businesses"),
    crypto.randomUUID(),
    false,
  ))!;
  await expect(
    as(resident, "bfe_prepare_listing_cover($1)", [noConsent]),
  ).rejects.toThrow();
  await expect(
    as(resident, "bfe_save_listing_links($1,$2)", [
      noConsent,
      [{ label: "Example", url: "https://example.test" }],
    ]),
  ).rejects.toThrow();
  const id = (await submit())!;
  await review(id, "In review", 1);
  await review(id, "Published", 2);
  await db.query(
    "UPDATE bfe_feature_records SET expires_at=now()-interval '1 second' WHERE id=$1",
    [id],
  );
  await expect(as(other, "bfe_listing_media($1)", [id])).rejects.toThrow();
  await as(
    developer,
    "bfe_save_tab_access('user',$1,'own',$2,'{}','Synthetic read only')",
    [resident, { livelihood: "view" }],
  );
  await expect(
    as(
      resident,
      "bfe_revise_listing($1,3,'Synthetic change','Synthetic edited details',$2,true)",
      [id, sampleBaselineFields("businesses")],
    ),
  ).rejects.toThrow();
  await expect(as(null, "bfe_listing_media($1)", [id])).rejects.toThrow();
  await expect(
    as(
      resident,
      "bfe_review_feature($1,3,'Withdrawn','Synthetic withdrawal')",
      [id],
    ),
  ).rejects.toThrow();
});
it("rejects a missing value for every required field in every module", async () => {
  for (const definition of baselineModules) {
    for (const field of definition.fields.filter((f) => f.required)) {
      const fields = sampleBaselineFields(
        definition.id,
        "81000000-0000-4000-8000-000000000001",
      );
      // A field hidden by showWhen is not asked, so it is not required either.
      if (!fieldVisible(field, fields)) continue;
      delete fields[field.key];
      await expect(
        db.query("SELECT bfe_validate_feature_fields($1,$2)", [
          definition.id,
          fields,
        ]),
      ).rejects.toThrow(/Check field/);
    }
  }
});
it("executes the owner verification script with all private tables and RPC checks", async () => {
  const sql = await readFile(
    new URL("../../scripts/verify-feature-services.sql", import.meta.url),
    "utf8",
  );
  const results = await db.exec(sql);
  const result = results
    .flatMap((r) => r.rows)
    .find((r) => "feature_services_verification" in r)
    ?.feature_services_verification as {
    form_definitions: number;
    new_private_tables: number;
    anonymous_operations_blocked: boolean;
  };
  expect(result.form_definitions).toBe(baselineModules.length);
  expect(result.new_private_tables).toBe(10);
  expect(result.anonymous_operations_blocked).toBe(true);
});
it("protects raw data and isolates submissions from other households", async () => {
  await submit();
  expect(featureDashboardSchema.parse(await dashboard()).rows).toHaveLength(1);
  expect(
    featureDashboardSchema.parse(await dashboard(other)).rows,
  ).toHaveLength(0);
  await expect(
    as(resident, "(SELECT count(*) FROM bfe_feature_records)"),
  ).rejects.toThrow(/permission denied/);
  await expect(dashboard(resident, "review")).rejects.toThrow(/Review access/);
  await expect(as(null, "bfe_feature_dashboard('businesses')")).rejects.toThrow(
    /permission denied/,
  );
});
it("enforces required fields, option values, numeric ranges, field allowlist and time order", async () => {
  await expect(submit(resident, "businesses", {})).rejects.toThrow(
    /Check field/,
  );
  await expect(
    submit(resident, "businesses", {
      ...sampleBaselineFields("businesses"),
      role: "developer",
    }),
  ).rejects.toThrow(/Unexpected/);
  await expect(
    submit(resident, "buy-sell", {
      ...sampleBaselineFields("buy-sell"),
      price: "-1",
    }),
  ).rejects.toThrow(/Invalid number/);
  await expect(
    submit(resident, "businesses", {
      ...sampleBaselineFields("businesses"),
      category: "Unapproved option",
    }),
  ).rejects.toThrow(/Invalid selection/);
  await expect(
    submit(developer, "events", {
      ...sampleBaselineFields("events"),
      start: "14:00",
      end: "12:00",
    }),
  ).rejects.toThrow(/End time/);
  await expect(
    submit(resident, "businesses", {
      ...sampleBaselineFields("businesses"),
      website: "javascript:alert(1)",
    }),
  ).rejects.toThrow(/HTTPS/);
});
it("makes retries idempotent and rejects reusing an id for changed details", async () => {
  const client = crypto.randomUUID();
  const id = await submit(
    resident,
    "businesses",
    sampleBaselineFields("businesses"),
    client,
  );
  expect(
    await submit(
      resident,
      "businesses",
      sampleBaselineFields("businesses"),
      client,
    ),
  ).toBe(id);
  await expect(
    submit(
      resident,
      "businesses",
      { ...sampleBaselineFields("businesses"), hours: "Changed hours" },
      client,
    ),
  ).rejects.toThrow(/reference already used/);
});
it("publishes only curated public text and never owner identity or private fields", async () => {
  const id = await submit();
  await review(id!, "In review", 1);
  await review(id!, "Published", 2);
  const data = featureDashboardSchema.parse(
    await dashboard(other, "published"),
  );
  expect(data.rows[0].detail).toBe("Synthetic approved public description");
  expect(data.rows[0].fields).toBeUndefined();
  expect(JSON.stringify(data)).not.toContain(resident);
  expect(JSON.stringify(data)).not.toContain("private submission");
  await expect(review(id!, "Withdrawn", 2)).rejects.toThrow(/changed/);
  await as(
    resident,
    "bfe_review_feature($1,3,'Withdrawn','Withdraw my publication')",
    [id],
  );
  expect(
    featureDashboardSchema.parse(await dashboard(other, "published")).rows,
  ).toHaveLength(0);
});
it("requires consent, permitted audience and live expiry; suspensions take effect immediately", async () => {
  const id = await submit(
    resident,
    "businesses",
    sampleBaselineFields("businesses"),
    crypto.randomUUID(),
    false,
  );
  await review(id!, "In review", 1);
  await expect(review(id!, "Published", 2)).rejects.toThrow(/consent/);
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    resident,
  ]);
  await expect(dashboard()).rejects.toThrow(/membership/);
});
async function facility() {
  return as<string>(
    developer,
    "bfe_configure_facility(NULL,'Synthetic facility','08:00','18:00',30,120,10,true,true,'Synthetic approved policy')",
  );
}
const times = () => {
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  return [date + "T09:00:00+08:00", date + "T10:00:00+08:00"];
};
async function book(
  f: string,
  user = resident,
  client = crypto.randomUUID(),
  start = times()[0],
  end = times()[1],
  attendees = 2,
) {
  return as<string>(
    user,
    "bfe_create_booking($1,$2,$3,$4,'Synthetic meeting purpose',$5)",
    [client, f, start, end, attendees],
  );
}
it("holds bookings without overlaps and allows touching adjacent slots", async () => {
  const f = await facility();
  await book(f!);
  await expect(book(f!, other)).rejects.toThrow(/reserved/);
  await book(
    f!,
    other,
    crypto.randomUUID(),
    times()[1],
    times()[1].replace("10:00", "11:00"),
  );
  const data = bookingDashboardSchema.parse(
    await as(resident, "bfe_booking_dashboard()"),
  );
  expect(data.rows).toHaveLength(1);
  expect(data.rows[0].status).toBe("Pending");
  const avail = await as(resident, "bfe_booking_availability($1,$2)", [
    f,
    times()[0].slice(0, 10),
  ]);
  expect(JSON.stringify(avail)).not.toContain("purpose");
  expect(JSON.stringify(avail)).not.toContain(resident);
});
it("rejects out-of-hours, over-capacity and misaligned bookings", async () => {
  const f = await facility();
  await expect(
    book(
      f!,
      resident,
      crypto.randomUUID(),
      times()[0].replace("09:00", "07:00"),
    ),
  ).rejects.toThrow(/approved hours/);
  await expect(
    book(f!, resident, crypto.randomUUID(), times()[0], times()[1], 11),
  ).rejects.toThrow(/capacity/);
  await expect(
    book(
      f!,
      resident,
      crypto.randomUUID(),
      times()[0].replace("09:00", "09:15"),
    ),
  ).rejects.toThrow(/approved hours/);
});
it("requires independent staff capability for booking decisions and supports resident cancellation", async () => {
  const f = await facility(),
    id = await book(f!);
  await expect(
    as(resident, "bfe_decide_booking($1,1,'Approved','Synthetic reason')", [
      id,
    ]),
  ).rejects.toThrow(/permission/);
  await as(
    developer,
    "bfe_decide_booking($1,1,'Approved','Synthetic office approval')",
    [id],
  );
  await expect(
    as(other, "bfe_decide_booking($1,2,'Cancelled','Synthetic cancellation')", [
      id,
    ]),
  ).rejects.toThrow(/permission/);
  await as(
    resident,
    "bfe_decide_booking($1,2,'Cancelled','Synthetic resident cancellation')",
    [id],
  );
  await book(f!, other);
});
it("blocks facility configuration while future reservations exist and validates idempotency", async () => {
  const f = await facility(),
    client = crypto.randomUUID(),
    id = await book(f!, resident, client);
  expect(await book(f!, resident, client)).toBe(id);
  await expect(
    as(
      developer,
      "bfe_configure_facility($1,'Changed synthetic','08:00','18:00',30,120,10,true,true,'Synthetic approved policy')",
      [f],
    ),
  ).rejects.toThrow(/Resolve future/);
  await expect(
    as(
      resident,
      "bfe_configure_facility(NULL,'Synthetic','08:00','18:00',30,120,10,true,true,'Synthetic policy')",
    ),
  ).rejects.toThrow(/management/);
});
async function visitor(
  user = resident,
  target = lot,
  from = new Date(Date.now() - 1000).toISOString(),
  until = new Date(Date.now() + 3600000).toISOString(),
) {
  return as<string>(
    user,
    "bfe_create_visitor_pass($1,$2,'Synthetic visitor','Synthetic visit purpose','TEST-ONLY',$3,$4)",
    [crypto.randomUUID(), target, from, until],
  );
}
async function visitorPermissions(user = resident) {
  await grant(user, "security", "create", "own");
  await grant(user, "security", "view", "own");
}
it("requires approved, unexpired lot membership and explicit visitor permissions", async () => {
  await expect(visitor()).rejects.toThrow(/permission/);
  await visitorPermissions();
  await visitorPermissions(other);
  await visitor();
  await expect(visitor(other)).rejects.toThrow(/lot membership/);
  await db.query(
    "UPDATE bfe_lot_memberships SET expires_at=now()-interval '1 minute',starts_at=now()-interval '1 day'",
  );
  await expect(visitor()).rejects.toThrow(/lot membership/);
});
it("allows only authorized security to record entry and exit, with version protection", async () => {
  await visitorPermissions();
  const id = await visitor();
  await as(
    developer,
    "bfe_update_visitor_pass($1,1,'Approved','Synthetic approval')",
    [id],
  );
  await expect(
    as(
      developer,
      "bfe_update_visitor_pass($1,2,'Entered','Synthetic gate entry')",
      [id],
    ),
  ).rejects.toThrow(/security permission/);
  await grant(guard, "security", "view");
  await grant(guard, "security", "status");
  await as(
    guard,
    "bfe_update_visitor_pass($1,2,'Entered','Synthetic gate entry')",
    [id],
  );
  await expect(
    as(guard, "bfe_update_visitor_pass($1,2,'Exited','Synthetic gate exit')", [
      id,
    ]),
  ).rejects.toThrow(/changed/);
  await as(
    guard,
    "bfe_update_visitor_pass($1,3,'Exited','Synthetic gate exit')",
    [id],
  );
  expect(
    visitorDashboardSchema.parse(await as(resident, "bfe_visitor_dashboard()"))
      .rows[0].status,
  ).toBe("Exited");
});
it("rechecks resident suspension and lot revocation at entry", async () => {
  await visitorPermissions();
  const id = await visitor();
  await as(
    developer,
    "bfe_update_visitor_pass($1,1,'Approved','Synthetic approval')",
    [id],
  );
  await grant(guard, "security", "view");
  await grant(guard, "security", "status");
  await db.query("UPDATE bfe_lot_memberships SET state='revoked'");
  await expect(
    as(
      guard,
      "bfe_update_visitor_pass($1,2,'Entered','Synthetic gate entry')",
      [id],
    ),
  ).rejects.toThrow(/withdrawn/);
});
it("hides expired passes from the gate and prevents expired entry", async () => {
  await visitorPermissions();
  const id = await visitor();
  await as(
    developer,
    "bfe_update_visitor_pass($1,1,'Approved','Synthetic approval')",
    [id],
  );
  await db.query(
    "UPDATE bfe_visitor_passes SET valid_from=now()-interval '2 hours',valid_until=now()-interval '1 hour' WHERE id=$1",
    [id],
  );
  expect(
    visitorDashboardSchema.parse(await as(resident, "bfe_visitor_dashboard()"))
      .rows[0].effective_status,
  ).toBe("Expired");
  expect(
    visitorDashboardSchema.parse(
      await as(developer, "bfe_visitor_dashboard(true)"),
    ).rows,
  ).toHaveLength(0);
});
it("returns only permitted workflow history and denies unrelated households", async () => {
  const id = await submit();
  await review(id!, "In review", 1);
  const history = await as<Array<{ action: string }>>(
    resident,
    "bfe_workflow_history('feature',$1)",
    [id],
  );
  expect(history?.[0].action).toBe("In review");
  await expect(
    as(other, "bfe_workflow_history('feature',$1)", [id]),
  ).rejects.toThrow(/unavailable/);
});
async function workshop(capacity = 2) {
  const fields = {
    ...sampleBaselineFields("workshops"),
    capacity: String(capacity),
    date: times()[0].slice(0, 10),
  };
  const id = await submit(developer, "workshops", fields);
  await review(id!, "In review", 1);
  await review(id!, "Published", 2);
  return id!;
}
async function apply(
  activity: string,
  user = resident,
  places = 1,
  client = crypto.randomUUID(),
) {
  return as<string>(
    user,
    "bfe_request_participation($1,$2,$3,'Synthetic application details')",
    [client, activity, places],
  );
}
const decide = (id: string, status: string, version = 1, user = developer) =>
  as(
    user,
    "bfe_decide_participation($1,$2,$3,'Synthetic application decision')",
    [id, version, status],
  );
it("commits capacity only on approval and rejects overbooking", async () => {
  const activity = await workshop(2),
    a = await apply(activity, resident, 2),
    b = await apply(activity, other, 1);
  await decide(a!, "Confirmed");
  await expect(decide(b!, "Confirmed")).rejects.toThrow(/capacity/);
  await decide(a!, "Withdrawn", 2, resident);
  await decide(b!, "Confirmed");
  const result = await as<{
    activities: Array<{ confirmed: number }>;
    rows: Array<{ status: string }>;
  }>(other, "bfe_participation_dashboard('workshops')");
  expect(result?.activities[0].confirmed).toBe(1);
  expect(result?.rows[0].status).toBe("Confirmed");
});
it("checks activity visibility, deadlines, duplicate references, permission and suspension", async () => {
  const activity = await workshop(),
    client = crypto.randomUUID(),
    id = await apply(activity, resident, 1, client);
  expect(await apply(activity, resident, 1, client)).toBe(id);
  await expect(apply(activity, resident)).rejects.toThrow(
    /current application/,
  );
  await expect(decide(id!, "Confirmed", 1, resident)).rejects.toThrow(
    /permission/,
  );
  await db.query("UPDATE members SET status='Suspended' WHERE user_id=$1", [
    resident,
  ]);
  await expect(decide(id!, "Confirmed")).rejects.toThrow(/membership/);
  await db.query(
    "UPDATE bfe_feature_records SET expires_at=now()-interval '1 second' WHERE id=$1",
    [activity],
  );
  await expect(apply(activity, other)).rejects.toThrow(/closed/);
});
it("withdrawal of a published activity closes applications and records the reason", async () => {
  const activity = await workshop(),
    id = await apply(activity);
  await decide(id!, "Confirmed");
  await review(activity, "Withdrawn", 3);
  const result = await as<{
    rows: Array<{ status: string; history: Array<{ note: string }> }>;
  }>(resident, "bfe_participation_dashboard('workshops')");
  expect(result?.rows[0].status).toBe("Rejected");
  expect(result?.rows[0].history[0].note).toContain("withdrawn");
});
