import { z } from "zod";

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const accountLotMatchSchema = z.object({
  expected: z.object({
    user_id: z.uuid(),
    name: z.string().nullable(),
    unit: z.string().nullable(),
    role: z.string(),
    extra_roles: z.array(z.string()).nullable(),
    status: z.string(),
  }),
  physical_id: z.string().nullable(),
  can_link: z.boolean(),
  candidate: z
    .object({
      id: z.uuid(),
      physical_id: z.string(),
      recorded_homeowner: z.string(),
      version: z.number().int(),
    })
    .nullable(),
  relationships: z.array(
    z.object({ relationship: z.string(), state: z.string() }),
  ),
});
export const workbookAccountMatchesSchema = z.object({
  workbook_installed: z.boolean(),
  ready: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      target_id: z.uuid(),
      name: z.string().nullable(),
      unit: z.string().nullable(),
      status: z.string(),
      match: accountLotMatchSchema.nullable(),
    }),
  ),
});
export const lotSchema = z.object({
  id: z.uuid(),
  physical_id: z.string(),
  phase: z.number().int(),
  block: z.number().int(),
  lot: z.number().int(),
  admin_unit: z.string(),
  registry_status: z.string(),
  recorded_homeowner: z.string().nullable(),
  review_priority: z.string().nullable().optional(),
  version: z.number().int(),
});
export const membershipSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().nullable(),
  relationship: z.enum(["owner", "renter", "household"]),
  state: z.enum(["pending", "approved", "rejected", "revoked"]),
  starts_at: z.string(),
  expires_at: z.string().nullable(),
  reference: z.string(),
});
export const lotDetailSchema = lotSchema
  .omit({ review_priority: true })
  .extend({
    original_homeowner: z.string().nullable(),
    evidence: z.record(z.string(), z.unknown()).nullable(),
    memberships: z.array(membershipSchema),
    history: z.array(
      z.object({
        at: z.string(),
        action: z.string(),
        actor_label: z.string().default("Authorized operator"),
        details: z.record(z.string(), z.unknown()),
      }),
    ),
    source: z.object({
      batch_id: z.uuid(),
      imported_at: z.string(),
      source_name: z.string().nullable(),
    }),
  });
export const receiptSchema = z.object({
  id: z.uuid(),
  lot_id: z.uuid(),
  physical_id: z.string(),
  or_number: z.string(),
  receipt_date: z.iso.date(),
  amount_centavos: cents,
  account_series: z.string(),
  payer: z.string(),
  source_file: z.string(),
  batch_id: z.uuid(),
});
export const receiptPageSchema = z.object({
  rows: z.array(receiptSchema),
  total: z.number().int().nonnegative(),
  total_centavos: cents,
  monthly: z.array(
    z.object({
      month: z.string(),
      count: z.number().int(),
      amount_centavos: cents,
    }),
  ),
  phases: z.array(
    z.object({
      phase: z.number().int(),
      count: z.number().int(),
      amount_centavos: cents,
    }),
  ),
  lots: z.array(
    z.object({
      physical_id: z.string(),
      count: z.number().int(),
      amount_centavos: cents,
    }),
  ),
});
export const lotPageSchema = z.object({
  rows: z.array(lotSchema),
  total: z.number().int().nonnegative(),
});
export type Lot = z.infer<typeof lotSchema>;
export type LotDetail = z.infer<typeof lotDetailSchema>;
export type ReceiptPage = z.infer<typeof receiptPageSchema>;
export function receiptCsv(report: ReceiptPage, from: string, to: string) {
  return [
    ["BELLEFORT ESTATES - RECORDED COLLECTIONS"],
    [
      "From",
      from || "Earliest supplied receipt",
      "To",
      to || "Latest supplied receipt",
    ],
    [
      "Basis",
      "Receipt date; imported evidence. Not bank reconciliation or settled bills.",
    ],
    [
      "Receipt count",
      report.total,
      "Total PHP",
      (report.total_centavos / 100).toFixed(2),
    ],
    [],
    ["MONTHLY TOTALS"],
    ["Month", "Receipts", "Amount PHP"],
    ...report.monthly.map((r) => [
      r.month,
      r.count,
      (r.amount_centavos / 100).toFixed(2),
    ]),
    [],
    ["PHASE TOTALS"],
    ["Phase", "Receipts", "Amount PHP"],
    ...report.phases.map((r) => [
      r.phase,
      r.count,
      (r.amount_centavos / 100).toFixed(2),
    ]),
    [],
    ["LOT TOTALS"],
    ["Physical lot", "Receipts", "Amount PHP"],
    ...report.lots.map((r) => [
      r.physical_id,
      r.count,
      (r.amount_centavos / 100).toFixed(2),
    ]),
    [],
    ["RECEIPT DETAIL"],
    [
      "Physical lot",
      "OR number",
      "Receipt date",
      "Amount PHP",
      "Recorded payer",
      "Agency account",
      "Source file",
      "Import batch",
    ],
    ...report.rows.map((r) => [
      r.physical_id,
      r.or_number,
      r.receipt_date,
      (r.amount_centavos / 100).toFixed(2),
      r.payer,
      r.account_series,
      r.source_file,
      r.batch_id,
    ]),
  ];
}
