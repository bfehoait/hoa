import { expect, it } from "vitest";
import { receiptPageSchema, receiptCsv } from "./registry";
import { csvCell } from "./index";
it("exports receipt-date summaries and provenance without inventing balances", () => {
  const id = "61000000-0000-4000-8000-000000000001";
  const report = receiptPageSchema.parse({
    rows: [
      {
        id,
        lot_id: id,
        physical_id: "1-01-001",
        or_number: "00001",
        receipt_date: "2026-01-02",
        amount_centavos: 90000,
        account_series: "SYNTHETIC",
        payer: "=SYNTHETIC()",
        source_file: "synthetic.xlsx",
        batch_id: id,
      },
    ],
    total: 1,
    total_centavos: 90000,
    monthly: [{ month: "2026-01", count: 1, amount_centavos: 90000 }],
    phases: [{ phase: 1, count: 1, amount_centavos: 90000 }],
    lots: [{ physical_id: "1-01-001", count: 1, amount_centavos: 90000 }],
  });
  const csv = receiptCsv(report, "2026-01-01", "2026-01-31");
  expect(csv.flat()).toContain("900.00");
  expect(csv.flat()).toContain("00001");
  expect(csv.flat()).toContain("PHASE TOTALS");
  expect(csv.flat()).toContain("LOT TOTALS");
  expect(csv.flat()).not.toContain("Outstanding");
  expect(csvCell("=SYNTHETIC()")).toContain("'=SYNTHETIC()");
});
it("rejects unsafe amounts in server responses", () => {
  expect(
    receiptPageSchema.safeParse({
      rows: [],
      total: 0,
      total_centavos: Number.MAX_SAFE_INTEGER + 1,
      monthly: [],
      phases: [],
      lots: [],
    }).success,
  ).toBe(false);
});
