import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const db = new PGlite();
const editorParts: string[] = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "import sys,json;sys.path.insert(0,'scripts');from test_lot_workbook import module,fixture;lots,receipts,_=module.validate(fixture());print(json.dumps(module.split_sql(lots,receipts,'c'*64,'synthetic.xlsx')))",
    ],
    { encoding: "utf8" },
  ),
);
const users = {
  owner: "71000000-0000-4000-8000-000000000001",
  other: "71000000-0000-4000-8000-000000000002",
  developer: "71000000-0000-4000-8000-000000000003",
  staff: "71000000-0000-4000-8000-000000000004",
};
const lot = {
  physical_id: "1-01-001",
  phase: 1,
  block: 1,
  lot: 1,
  admin_unit: "SYNTHETIC-001",
  registry_status: "Synthetic",
  recorded_homeowner: "Sample owner",
  review_priority: "MEDIUM",
  source_row: 2,
  fields: {
    "Admin Homeowner Name(s)": "Sample owner",
    "Verified Monthly Rate": null,
  },
};
const receipt = {
  physical_id: lot.physical_id,
  or_number: "SYNTHETIC-OR-01",
  receipt_date: "2026-01-02",
  amount_centavos: 90000,
  account_series: "SYNTHETIC-ACCOUNT",
  payer: "Sample payer",
  source_file: "synthetic.xlsx",
  source_row: 2,
};
async function actor<T>(id: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`BEGIN;SET LOCAL ROLE ${id ? "authenticated" : "anon"};`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    const r = await db.query<{ result: T }>(`SELECT ${sql} result`, args);
    await db.exec("COMMIT");
    return r.rows[0]?.result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
async function runImport(
  lots: unknown[] = [lot],
  receipts: unknown[] = [receipt],
  hash = "a".repeat(64),
) {
  try {
    return (
      await db.query<{ id: string }>(
        "SELECT public.bfe_import_registry($1,'synthetic.xlsx',$2,$3) id",
        [hash, JSON.stringify(lots), JSON.stringify(receipts)],
      )
    ).rows[0].id;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
async function lotId() {
  return (
    await db.query<{ id: string }>(
      "SELECT id FROM bfe_lots WHERE physical_id='1-01-001'",
    )
  ).rows[0].id;
}
async function receiptId() {
  return (await db.query<{ id: string }>("SELECT id FROM bfe_receipts LIMIT 1"))
    .rows[0].id;
}
async function approve(user = users.owner) {
  await actor(user, "public.bfe_claim_lot('1-01-001','owner')");
  const id = (
    await db.query<{ id: string }>(
      "SELECT id FROM bfe_lot_memberships WHERE user_id=$1 AND state='pending'",
      [user],
    )
  ).rows[0].id;
  await actor(
    users.developer,
    "public.bfe_review_lot_membership($1,'approved','Synthetic verification',NULL)",
    [id],
  );
  return id;
}
async function grant(module: string, action: string) {
  await actor(
    users.developer,
    "public.bfe_provision_access($1,'data_governance',$2,$3,'association','allow','Synthetic approval',NULL)",
    [users.staff, module, action],
  );
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE public.members(id text PRIMARY KEY,user_id uuid,name text,email text,phone text,unit text,title text,role text,extra_roles text[] DEFAULT '{}',status text DEFAULT 'Active',last_seen timestamptz);
 CREATE TABLE public.portal_data(key text PRIMARY KEY,value jsonb);
 CREATE TABLE public.registrations(id text PRIMARY KEY,name text,email text,phone text,unit text,role text,status text,created_at timestamptz,review_note text,proof text);
 CREATE TABLE public.audit_log(id bigint PRIMARY KEY,at timestamptz,actor_role text,action text,source text,ref_no text);`);
  for (const [name, id] of Object.entries(users)) {
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query(
      "INSERT INTO members(id,user_id,name,role,extra_roles) VALUES($1,$2,$3,$4,$5)",
      [
        name,
        id,
        `Sample ${name}`,
        name === "owner" || name === "other" ? "homeowner" : "admin",
        name === "developer" ? ["developer"] : [],
      ],
    );
  }
  for (const file of [
    "202611050001_request_workflow.sql",
    "202611050002_module_monitoring.sql",
    "202611050003_access_permissions.sql",
    "202611050004_accounts_notifications_developer.sql",
    "202611060005_lot_register.sql",
  ]) {
    await db.exec(
      await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  }
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE bfe_registry_audit,bfe_receipt_entitlements,bfe_lot_memberships,bfe_receipts,bfe_lot_evidence,bfe_import_stage,bfe_lots,bfe_import_batches CASCADE;DELETE FROM bfe_access_grants;DELETE FROM bfe_access_assignments;UPDATE members SET status='Active';",
  );
  await runImport();
});
afterAll(() => db.close());
it("assesses legacy structure and lot receipt links without returning source values or changing records", async () => {
  await db.query(
    "INSERT INTO portal_data(key,value) VALUES('bookings',$1),('ledger',$2)",
    [
      JSON.stringify([
        {
          id: "synthetic-duplicate",
          unit: "synthetic-unit",
          name: "Private synthetic name",
          unknown: "Private synthetic value",
        },
        { id: "synthetic-duplicate", unit: null, amount: 123 },
        42,
      ]),
      JSON.stringify({ "Private synthetic key": "Private synthetic value" }),
    ],
  );
  const sql = await readFile(
    new URL("../../scripts/assess-legacy-data.sql", import.meta.url),
    "utf8",
  );
  const results = await db.exec(sql);
  const result = results.find((r) => r.rows[0] && "assessment" in r.rows[0])!
    .rows[0].assessment as {
    assessment_only: boolean;
    registry: {
      active_lots: number;
      active_receipts: number;
      total_centavos: number;
      receipts_without_active_lot: number;
    };
    legacy_sections: {
      section: string;
      item_count: number;
      nonobject_items: number;
      duplicate_nonempty_ids: number;
      fields: { field: string }[];
    }[];
  };
  expect(result.assessment_only).toBe(true);
  expect(result.registry).toMatchObject({
    active_lots: 1,
    active_receipts: 1,
    total_centavos: 90000,
    receipts_without_active_lot: 0,
  });
  expect(
    result.legacy_sections.find((s) => s.section === "bookings"),
  ).toMatchObject({
    item_count: 3,
    nonobject_items: 1,
    duplicate_nonempty_ids: 1,
  });
  expect(
    result.legacy_sections.find((s) => s.section === "ledger")?.fields,
  ).toEqual([]);
  expect(JSON.stringify(result)).not.toContain("Private synthetic");
  expect(JSON.stringify(result)).not.toContain("synthetic-duplicate");
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT jsonb_array_length(value) n FROM portal_data WHERE key='bookings'",
      )
    ).rows[0].n,
  ).toBe(3);
  await db.exec("DELETE FROM portal_data WHERE key IN ('bookings','ledger')");
});
it("counts exact legacy lot candidates while retaining ambiguous, conflicting and missing references for review", async () => {
  await runImport(
    [
      {
        ...lot,
        physical_id: "1-01-002",
        lot: 2,
        admin_unit: "SYNTHETIC-002",
        source_row: 3,
      },
      {
        ...lot,
        physical_id: "1-01-003",
        lot: 3,
        admin_unit: "SYNTHETIC-003",
        source_row: 4,
      },
    ],
    [],
    "d".repeat(64),
  );
  await db.query(
    "INSERT INTO portal_data(key,value) VALUES('units',$1),('bookings',$2),('gatePasses',$3),('passes',$4)",
    [
      JSON.stringify([
        {
          unit: "synthetic-A",
          phase: "Phase 1",
          block: "Block 1",
          lotNo: "Lot 1",
        },
        { unit: "synthetic-B", physical_id: "1-01-001" },
        { unit: "synthetic-B", physical_id: "1-01-002" },
        { unit: "synthetic-C", phase: "1", lot: 99 },
        { unit: "SYNTHETIC-002" },
        {
          unit: "synthetic-rejected",
          phase: "Unknown phase 1",
          block: "1",
          lotNo: "1",
        },
        {
          unit: "synthetic-D",
          phase: "1",
          block: "1",
          lotNo: "3",
          physical_id: "1-01-001",
        },
      ]),
      JSON.stringify(
        [
          "synthetic-A",
          "synthetic-B",
          "synthetic-C",
          "synthetic-D",
          "1-01-001",
          "synthetic-unknown",
          "",
          null,
        ].map((unit) => ({ unit, name: "Private synthetic value" })),
      ),
      JSON.stringify([{ id: "synthetic-pass" }]),
      JSON.stringify([{ id: "synthetic-pass" }]),
    ],
  );
  const sql = await readFile(
    new URL("../../scripts/assess-legacy-lot-links.sql", import.meta.url),
    "utf8",
  );
  const results = await db.exec(sql);
  const result = results.find(
    (r) => r.rows[0] && "lot_link_assessment" in r.rows[0],
  )!.rows[0].lot_link_assessment as {
    units: {
      unique_lot_candidates: number;
      conflicting_physical_id_candidates: number;
      duplicate_unit_reference_groups: number;
    };
    sections: { section: string }[];
    same_id_gate_pass_candidates: number;
    assessment_version: number;
    unit_field_formats: { field: string; masked_format: string }[];
  };
  expect(result.units).toMatchObject({
    unique_lot_candidates: 4,
    conflicting_physical_id_candidates: 1,
    duplicate_unit_reference_groups: 1,
  });
  expect(result.sections.find((s) => s.section === "bookings")).toMatchObject({
    records: 8,
    exact_physical_id_candidates: 1,
    unique_legacy_unit_candidates: 1,
    missing_unit_references: 2,
    ambiguous_or_conflicting: 2,
    legacy_unit_without_unique_lot: 1,
    unmatched: 1,
  });
  expect(result.same_id_gate_pass_candidates).toBe(1);
  expect(result.assessment_version).toBe(2);
  expect(result.unit_field_formats).toContainEqual(
    expect.objectContaining({ field: "phase", masked_format: "AAAAA 9" }),
  );
  expect(JSON.stringify(result)).not.toContain("Unknown phase");
  expect(JSON.stringify(result)).not.toContain("SYNTHETIC-002");
  expect(JSON.stringify(result)).not.toContain("synthetic-A");
  expect(JSON.stringify(result)).not.toContain("Private synthetic value");
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT jsonb_array_length(value) n FROM portal_data WHERE key='bookings'",
      )
    ).rows[0].n,
  ).toBe(8);
  await db.exec(
    "DELETE FROM portal_data WHERE key IN ('units','bookings','gatePasses','passes')",
  );
});
it("stages editor parts privately and rejects missing or altered uploads before atomic finalization", async () => {
  await db.exec(
    "CREATE ROLE service_role;TRUNCATE bfe_import_batches CASCADE;",
  );
  await db.exec(editorParts[0]);
  await db.exec("SET ROLE anon");
  await expect(
    db.exec("SELECT * FROM bfe_upload_cccccccccccccccc.chunks"),
  ).rejects.toThrow();
  await db.exec("RESET ROLE");
  await expect(db.exec(editorParts[2])).rejects.toThrow(
    "Upload incomplete or changed",
  );
  await db.exec("ROLLBACK");
  await db.exec(editorParts[1]);
  await db.exec(
    "UPDATE bfe_upload_cccccccccccccccc.chunks SET payload=payload || ' ' WHERE part=2",
  );
  await expect(db.exec(editorParts[2])).rejects.toThrow(
    "Upload incomplete or changed",
  );
  await db.exec("ROLLBACK");
  expect(
    (await db.query<{ n: number }>("SELECT count(*)::int n FROM bfe_lots"))
      .rows[0].n,
  ).toBe(0);
  await db.exec(editorParts[1]);
  await db.exec(editorParts[2]);
  expect(
    (
      await db.query<{ total_centavos: number }>(
        "SELECT total_centavos::int FROM bfe_import_batches",
      )
    ).rows,
  ).toEqual([{ total_centavos: 90000 }]);
  expect(
    (await db.query("SELECT * FROM bfe_lot_memberships")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "SELECT 1 FROM pg_namespace WHERE nspname='bfe_upload_cccccccccccccccc'",
      )
    ).rows,
  ).toHaveLength(0);
  for (const part of editorParts) await db.exec(part);
  expect(
    (await db.query<{ n: number }>("SELECT count(*)::int n FROM bfe_receipts"))
      .rows[0].n,
  ).toBe(1);
});
it("imports atomically, reconciles cents and never creates accounts or links", async () => {
  expect(
    (await db.query<{ n: number }>("SELECT count(*)::int n FROM members"))
      .rows[0].n,
  ).toBe(4);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_lot_memberships",
      )
    ).rows[0].n,
  ).toBe(0);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT total_centavos::int n FROM bfe_import_batches",
      )
    ).rows[0].n,
  ).toBe(90000);
  await runImport();
  await runImport([lot], [receipt], "b".repeat(64));
  expect(
    (await db.query<{ n: number }>("SELECT count(*)::int n FROM bfe_receipts"))
      .rows[0].n,
  ).toBe(1);
});
it("rejects conflicts and rolls back newly staged data", async () => {
  await expect(
    runImport([lot], [{ ...receipt, amount_centavos: 80000 }], "c".repeat(64)),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_import_batches",
      )
    ).rows[0].n,
  ).toBe(1);
  await expect(
    runImport([lot, lot], [receipt], "c".repeat(64)),
  ).rejects.toThrow();
  await expect(
    runImport([lot], [{ ...receipt, physical_id: "2-01-001" }], "c".repeat(64)),
  ).rejects.toThrow();
});
it("denies anonymous access, raw browser reads/writes and browser imports", async () => {
  await expect(actor(null, "public.bfe_list_lots()")).rejects.toThrow();
  await expect(
    actor(
      users.developer,
      "public.bfe_import_registry($1,'synthetic.xlsx',$2,$3)",
      ["d".repeat(64), JSON.stringify([lot]), JSON.stringify([receipt])],
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ ok: boolean }>(
        "SELECT has_table_privilege('authenticated','public.bfe_lots','SELECT') ok",
      )
    ).rows[0].ok,
  ).toBe(false);
  expect(
    (
      await db.query<{ ok: boolean }>(
        "SELECT has_table_privilege('authenticated','public.bfe_receipts','UPDATE') ok",
      )
    ).rows[0].ok,
  ).toBe(false);
});
it("does not expose a claimed lot before independent approval", async () => {
  await actor(users.owner, "public.bfe_claim_lot('1-01-001','owner')");
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_list_lots()"))
      .total,
  ).toBe(0);
  const id = (
    await db.query<{ id: string }>("SELECT id FROM bfe_lot_memberships")
  ).rows[0].id;
  await expect(
    actor(
      users.owner,
      "public.bfe_review_lot_membership($1,'approved','Synthetic evidence',NULL)",
      [id],
    ),
  ).rejects.toThrow();
});
it("isolates lots and historical receipts until entitlement is verified", async () => {
  const membership = await approve();
  const id = await lotId();
  const r = await receiptId();
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_list_lots()"))
      .total,
  ).toBe(1);
  await expect(
    actor(users.other, "public.bfe_lot_detail($1)", [id]),
  ).rejects.toThrow();
  const detail = await actor<{ evidence: null; recorded_homeowner: null }>(
    users.owner,
    "public.bfe_lot_detail($1)",
    [id],
  );
  expect(detail.evidence).toBeNull();
  expect(detail.recorded_homeowner).toBeNull();
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_lot_receipts()"))
      .total,
  ).toBe(0);
  await actor(
    users.developer,
    "public.bfe_entitle_receipt($1,$2,'Synthetic entitlement',false)",
    [membership, r],
  );
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_lot_receipts()"))
      .total,
  ).toBe(1);
  await actor(
    users.developer,
    "public.bfe_entitle_receipt($1,$2,'Synthetic revoke',true)",
    [membership, r],
  );
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_lot_receipts()"))
      .total,
  ).toBe(0);
});
it("revocation, expiry and suspension remove lot and receipt access", async () => {
  const m = await approve();
  await actor(
    users.developer,
    "public.bfe_entitle_receipt($1,$2,'Synthetic entitlement',false)",
    [m, await receiptId()],
  );
  await db.query(
    "UPDATE bfe_lot_memberships SET starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1",
    [m],
  );
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_list_lots()"))
      .total,
  ).toBe(0);
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_lot_receipts()"))
      .total,
  ).toBe(0);
  await db.exec(
    "UPDATE bfe_lot_memberships SET expires_at=NULL;UPDATE members SET status='Suspended' WHERE id='owner';",
  );
  await expect(
    actor(users.owner, "public.bfe_lot_receipts()"),
  ).rejects.toThrow();
});
it("keeps property, finance, audit and export capabilities separate", async () => {
  await grant("property", "view");
  expect(
    (await actor<{ total: number }>(users.staff, "public.bfe_list_lots()"))
      .total,
  ).toBe(1);
  expect(
    (await actor<{ total: number }>(users.staff, "public.bfe_lot_receipts()"))
      .total,
  ).toBe(0);
  await grant("finance", "view");
  expect(
    (await actor<{ total: number }>(users.staff, "public.bfe_lot_receipts()"))
      .total,
  ).toBe(1);
  await expect(
    actor(users.staff, "public.bfe_lot_receipts(NULL,NULL,NULL,0,true)"),
  ).rejects.toThrow();
  await grant("finance", "export");
  expect(
    (
      await actor<{ total: number }>(
        users.staff,
        "public.bfe_lot_receipts(NULL,NULL,NULL,0,true)",
      )
    ).total,
  ).toBe(1);
});
it("preserves original names, checks concurrent corrections and never transfers access", async () => {
  const id = await lotId();
  await actor(
    users.developer,
    "public.bfe_correct_homeowner($1,1,'Corrected sample owner','Synthetic evidence')",
    [id],
  );
  const d = await actor<{
    original_homeowner: string;
    recorded_homeowner: string;
  }>(users.developer, "public.bfe_lot_detail($1)", [id]);
  expect(d.original_homeowner).toBe("Sample owner");
  expect(d.recorded_homeowner).toBe("Corrected sample owner");
  await expect(
    actor(
      users.developer,
      "public.bfe_correct_homeowner($1,1,'Another sample','Synthetic evidence')",
      [id],
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM bfe_lot_memberships",
      )
    ).rows[0].n,
  ).toBe(0);
});
it("requires owner relationship and matching lot for receipt entitlement", async () => {
  await actor(users.other, "public.bfe_claim_lot('1-01-001','renter')");
  const m = (
    await db.query<{ id: string }>("SELECT id FROM bfe_lot_memberships")
  ).rows[0].id;
  await actor(
    users.developer,
    "public.bfe_review_lot_membership($1,'approved','Synthetic approval',NULL)",
    [m],
  );
  await expect(
    actor(
      users.developer,
      "public.bfe_entitle_receipt($1,$2,'Synthetic reference',false)",
      [m, await receiptId()],
    ),
  ).rejects.toThrow();
});
it("keeps withdrawal reversible without deleting evidence", async () => {
  const batch = (
    await db.query<{ id: string }>("SELECT id FROM bfe_import_batches")
  ).rows[0].id;
  await db.query(
    "SELECT bfe_withdraw_registry_import($1,'Synthetic recovery',false)",
    [batch],
  );
  expect(
    (await actor<{ total: number }>(users.developer, "public.bfe_list_lots()"))
      .total,
  ).toBe(0);
  expect(
    (
      await actor<{ total: number }>(
        users.developer,
        "public.bfe_lot_receipts()",
      )
    ).total,
  ).toBe(0);
  expect(
    (await db.query<{ n: number }>("SELECT count(*)::int n FROM bfe_receipts"))
      .rows[0].n,
  ).toBe(1);
  await db.query(
    "SELECT bfe_withdraw_registry_import($1,'Synthetic restore',true)",
    [batch],
  );
  expect(
    (await actor<{ total: number }>(users.developer, "public.bfe_list_lots()"))
      .total,
  ).toBe(1);
});

it("supports multiple lots and co-owners without broadening receipt entitlements", async () => {
  const second = { ...lot, physical_id: "2-01-001", phase: 2, source_row: 3 };
  await runImport([lot, second], [receipt], "e".repeat(64));
  await approve();
  await approve(users.other);
  await actor(users.owner, "public.bfe_claim_lot('2-01-001','owner')");
  const m = (
    await db.query<{ id: string }>(
      "SELECT id FROM bfe_lot_memberships WHERE state='pending'",
    )
  ).rows[0].id;
  await actor(
    users.developer,
    "public.bfe_review_lot_membership($1,'approved','Synthetic approval',NULL)",
    [m],
  );
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_list_lots()"))
      .total,
  ).toBe(2);
  expect(
    (await actor<{ total: number }>(users.other, "public.bfe_list_lots()"))
      .total,
  ).toBe(1);
  await expect(
    actor(
      users.developer,
      "public.bfe_entitle_receipt($1,$2,'Wrong lot entitlement',false)",
      [m, await receiptId()],
    ),
  ).rejects.toThrow();
});

it("revokes approved links and keeps their history", async () => {
  const m = await approve();
  await actor(
    users.developer,
    "public.bfe_review_lot_membership($1,'revoked','Synthetic revocation',NULL)",
    [m],
  );
  expect(
    (await actor<{ total: number }>(users.owner, "public.bfe_list_lots()"))
      .total,
  ).toBe(0);
  expect(
    (
      await db.query<{ state: string }>(
        "SELECT state FROM bfe_lot_memberships WHERE id=$1",
        [m],
      )
    ).rows[0].state,
  ).toBe("revoked");
});

it("permits finance identification without exposing registry evidence or other people's memberships", async () => {
  await approve();
  await grant("finance", "view");
  const detail = await actor<{ evidence: null; memberships: unknown[] }>(
    users.staff,
    "public.bfe_lot_detail($1)",
    [await lotId()],
  );
  expect(detail.evidence).toBeNull();
  expect(detail.memberships).toEqual([]);
});

it("reconciles a full-size synthetic batch and paginates without losing receipts", async () => {
  await db.exec(
    "TRUNCATE bfe_registry_audit,bfe_receipt_entitlements,bfe_lot_memberships,bfe_receipts,bfe_lot_evidence,bfe_import_stage,bfe_lots,bfe_import_batches CASCADE",
  );
  const lots = Array.from({ length: 921 }, (_, i) => {
    const phase = i < 669 ? 1 : i < 867 ? 2 : 3;
    const n = i < 669 ? i : i < 867 ? i - 669 : i - 867;
    const block = Math.floor(n / 50) + 1;
    const number = (n % 50) + 1;
    return {
      ...lot,
      phase,
      block,
      lot: number,
      physical_id: `${phase}-${String(block).padStart(2, "0")}-${String(number).padStart(3, "0")}`,
      admin_unit: `SYNTHETIC-${i}`,
      source_row: i + 2,
    };
  });
  const target = 566005850;
  const base = Math.floor(target / 4314);
  const remainder = target % 4314;
  const receipts = Array.from({ length: 4314 }, (_, i) => ({
    ...receipt,
    physical_id: lots[i % lots.length].physical_id,
    or_number: `SYNTHETIC-BULK-${i}`,
    amount_centavos: base + (i < remainder ? 1 : 0),
    receipt_date: `2026-${String((i % 9) + 1).padStart(2, "0")}-02`,
    source_row: i + 2,
  }));
  await runImport(lots, receipts);
  const first = await actor<{
    total: number;
    total_centavos: number;
    rows: unknown[];
  }>(users.developer, "public.bfe_lot_receipts(NULL,NULL,NULL,0,true)");
  expect(first.total).toBe(4314);
  expect(first.total_centavos).toBe(566005850);
  expect(first.rows).toHaveLength(500);
  const last = await actor<{ rows: unknown[] }>(
    users.developer,
    "public.bfe_lot_receipts(NULL,NULL,NULL,8,true)",
  );
  expect(last.rows).toHaveLength(314);
  expect(
    (
      await actor<{ total: number; rows: unknown[] }>(
        users.developer,
        "public.bfe_list_lots()",
      )
    ).rows,
  ).toHaveLength(20);
  expect(
    (await actor<{ total: number }>(users.developer, "public.bfe_list_lots()"))
      .total,
  ).toBe(921);
}, 30000);
