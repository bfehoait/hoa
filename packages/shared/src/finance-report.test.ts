import { describe, expect, it } from "vitest";
import { buildFinanceReport, financeReportCsv } from "./finance-report";
const rows = [
  { unit: "Sample A", due: "2026-11-30", amount: 185000, received: 90000 },
  { unit: "Sample B", due: "2026-10-15", amount: 100000, received: 100000 },
  { unit: "Sample C", due: "2026-08-15", amount: 20000, received: 0 },
  { unit: "Sample D", due: "2025-12-15", amount: 50000, received: 0 },
];
describe("period financial report", () => {
  it("aggregates selected due-month invoices and preserves exact cent totals", () => {
    const report = buildFinanceReport(rows, "2026-11-04", "Last 3 months");
    expect([report.start, report.end]).toEqual(["2026-09-01", "2026-11-30"]);
    expect([report.billed, report.received, report.outstanding]).toEqual([
      285000, 190000, 95000,
    ]);
    expect(report.months.map((month) => month.billed)).toEqual([
      null,
      100000,
      185000,
    ]);
    expect(report.rows).toHaveLength(2);
  });
  it("includes future due dates within the current billed month without asserting receipt dates", () => {
    const report = buildFinanceReport(rows, "2026-11-04", "This month");
    expect(report.rows.map((row) => row.unit)).toEqual(["Sample A"]);
    expect(report.outstanding).toBe(95000);
  });
  it("handles cross-year month windows and leap years", () => {
    const report = buildFinanceReport(rows, "2026-01-10", "Last 3 months");
    expect([report.start, report.end]).toEqual(["2025-11-01", "2026-01-31"]);
    expect(report.billed).toBe(50000);
    expect(buildFinanceReport([], "2024-02-20", "This month").end).toBe(
      "2024-02-29",
    );
    expect(
      buildFinanceReport(rows, "2026-11-04", "This year").months,
    ).toHaveLength(12);
  });
  it("distinguishes missing months from a supplied zero invoice", () => {
    expect(
      buildFinanceReport([], "2026-11-04", "This month").billed,
    ).toBeNull();
    expect(
      buildFinanceReport(
        [{ unit: "Sample", due: "2026-11-30", amount: 0, received: 0 }],
        "2026-11-04",
        "This month",
      ).billed,
    ).toBe(0);
  });
  it("exports a labelled rectangular report with period, summary, detail and unavailable values", () => {
    const csv = financeReportCsv(
      buildFinanceReport(rows, "2026-11-04", "Last 3 months"),
    );
    expect(csv.every((row) => row.length === 6)).toBe(true);
    expect(csv.some((row) => row[0] === "Billed" && row[1] === "2850.00")).toBe(
      true,
    );
    expect(
      csv.some((row) => row[0] === "2026-09" && row[1] === "Unavailable"),
    ).toBe(true);
    expect(csv.flat().join(" ")).toContain(
      "Receipt timestamps are unavailable",
    );
    expect(csv.flat().join(" ")).not.toContain("Sample D");
  });
  it("rejects invalid source amounts rather than silently charting them", () => {
    expect(() =>
      buildFinanceReport(
        [{ ...rows[0], received: 999999 }],
        "2026-11-04",
        "This month",
      ),
    ).toThrow();
    expect(() =>
      buildFinanceReport(rows, "not-a-date", "This month"),
    ).toThrow();
  });
});
