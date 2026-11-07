import { describe, expect, it } from "vitest";
import {
  aging,
  balance,
  bookingSchema,
  csvCell,
  invoiceSchema,
  invoiceStatus,
  requestSchema,
  visitorSchema,
  type Invoice,
} from "./index";
const bill = (due: string, received = 0): Invoice => ({
  id: "test",
  period: "test",
  due,
  amount: 10000,
  received,
});
describe("financial integrity", () => {
  it("subtracts partial receipts in integer centavos", () =>
    expect(balance(bill("2026-11-30", 4000))).toBe(6000));
  it("does not make an invoice overdue on its due day", () =>
    expect(invoiceStatus(bill("2026-11-04"), "2026-11-04")).toBe("Due"));
  it("marks a remaining balance overdue after the due day", () =>
    expect(invoiceStatus(bill("2026-11-03", 4000), "2026-11-04")).toBe(
      "Overdue",
    ));
  it("keeps a fully paid old bill paid", () =>
    expect(invoiceStatus(bill("2026-01-01", 10000), "2026-11-04")).toBe(
      "Paid",
    ));
  it("uses calendar days and remaining amounts for all age boundaries", () => {
    expect(
      aging(
        [
          bill("2026-11-04"),
          bill("2026-11-03", 2000),
          bill("2026-10-05"),
          bill("2026-10-04"),
          bill("2026-09-05"),
          bill("2026-09-04"),
        ],
        "2026-11-04",
      ),
    ).toEqual({
      current: 10000,
      days1to30: 18000,
      days31to60: 20000,
      days61plus: 10000,
    });
  });
  it("does not manufacture totals for an empty ledger", () =>
    expect(aging([], "2026-11-04")).toEqual({
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61plus: 0,
    }));
  it("refuses negative bill amounts", () =>
    expect(
      invoiceSchema.safeParse({ ...bill("2026-11-04"), amount: -1 }).success,
    ).toBe(false));
  it("refuses fractional centavos", () =>
    expect(
      invoiceSchema.safeParse({ ...bill("2026-11-04"), received: 0.5 }).success,
    ).toBe(false));
  it("refuses overpayment without a separate credit record", () =>
    expect(invoiceSchema.safeParse(bill("2026-11-04", 10001)).success).toBe(
      false,
    ));
});
describe("forms and safe export", () => {
  it("refuses impossible calendar dates", () =>
    expect(
      bookingSchema.safeParse({
        amenity: "Clubhouse",
        date: "2099-02-30",
        time: "09:00–11:00",
        guests: 4,
      }).success,
    ).toBe(false));
  it("neutralizes whitespace before a spreadsheet formula", () =>
    expect(csvCell("   =SUM(1,2)")).toBe('"\'   =SUM(1,2)"'));
  it("trims meaningful request input", () =>
    expect(
      requestSchema.parse({
        category: "Concern",
        title: "  A damaged light  ",
        details: "  The light by the gate is broken.  ",
      }).title,
    ).toBe("A damaged light"));
  it("refuses blank or unexplained requests", () =>
    expect(
      requestSchema.safeParse({
        category: "Maintenance",
        title: "   ",
        details: "short",
      }).success,
    ).toBe(false));
  it("refuses unrecognized request categories", () =>
    expect(
      requestSchema.safeParse({
        category: "Admin",
        title: "Sample title",
        details: "Enough detail for the sample office.",
      }).success,
    ).toBe(false));
  it("refuses booking dates in the past", () =>
    expect(
      bookingSchema.safeParse({
        amenity: "Clubhouse",
        date: "2020-01-01",
        time: "09:00–11:00",
        guests: 4,
      }).success,
    ).toBe(false));
  it("refuses oversized sample party sizes", () =>
    expect(
      bookingSchema.safeParse({
        amenity: "Clubhouse",
        date: "2099-01-01",
        time: "09:00–11:00",
        guests: 51,
      }).success,
    ).toBe(false));
  it("refuses a past visitor request", () =>
    expect(
      visitorSchema.safeParse({
        name: "Demo Visitor",
        date: "2020-01-01",
        purpose: "Delivery",
        plate: "",
      }).success,
    ).toBe(false));
  it("escapes CSV quotes", () => expect(csvCell('a"b')).toBe('"a""b"'));
  it.each([
    '=HYPERLINK("https://example.invalid")',
    "+SUM(1,2)",
    "-1+1",
    "@SUM(1,2)",
    "\t=1",
  ])("neutralizes spreadsheet formula %s", (value) =>
    expect(csvCell(value).startsWith("\"'")).toBe(true),
  );
});
