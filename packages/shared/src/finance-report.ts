import { z } from "zod";

export const reportPeriods = [
  "This month",
  "Last 3 months",
  "Last 6 months",
  "This year",
] as const;
const rowSchema = z
  .object({
    unit: z.string(),
    due: z.iso.date(),
    amount: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
  })
  .refine((row) => row.received <= row.amount);
export type ReportInvoice = z.infer<typeof rowSchema>;
export function buildFinanceReport(
  input: ReportInvoice[],
  asOf: string,
  period: (typeof reportPeriods)[number],
) {
  z.iso.date().parse(asOf);
  z.enum(reportPeriods).parse(period);
  const all = z.array(rowSchema).parse(input);
  const year = Number(asOf.slice(0, 4));
  const month = Number(asOf.slice(5, 7)) - 1;
  const startMonth =
    period === "This year"
      ? 0
      : month -
        (period === "Last 6 months" ? 5 : period === "Last 3 months" ? 2 : 0);
  const endMonth = period === "This year" ? 11 : month;
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const start = iso(new Date(Date.UTC(year, startMonth, 1)));
  const end = iso(new Date(Date.UTC(year, endMonth + 1, 0)));
  const rows = all
    .filter((row) => row.due >= start && row.due <= end)
    .sort((a, b) => a.due.localeCompare(b.due) || a.unit.localeCompare(b.unit));
  const months = Array.from(
    { length: endMonth - startMonth + 1 },
    (_, index) => {
      const date = new Date(Date.UTC(year, startMonth + index, 1));
      const key = iso(date).slice(0, 7);
      const records = rows.filter((row) => row.due.startsWith(key));
      const billed = records.length
        ? records.reduce((sum, row) => sum + row.amount, 0)
        : null;
      const received = records.length
        ? records.reduce((sum, row) => sum + row.received, 0)
        : null;
      return {
        key,
        label: date.toLocaleDateString("en-PH", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        billed,
        received,
        outstanding: billed === null ? null : billed - received!,
        count: records.length,
      };
    },
  );
  const billed = rows.length
    ? rows.reduce((sum, row) => sum + row.amount, 0)
    : null;
  const received = rows.length
    ? rows.reduce((sum, row) => sum + row.received, 0)
    : null;
  return {
    period,
    asOf,
    start,
    end,
    rows,
    months,
    billed,
    received,
    outstanding: billed === null ? null : billed - received!,
  };
}
export function financeReportCsv(
  report: ReturnType<typeof buildFinanceReport>,
) {
  const php = (value: number | null) =>
    value === null ? "Unavailable" : (value / 100).toFixed(2);
  const rows: unknown[][] = [
    ["BELLEFORT ESTATES - SAMPLE FINANCIAL REPORT"],
    ["REPORT INFORMATION"],
    ["Report", "Billing and recorded balances"],
    ["Period", report.period],
    ["Start", report.start],
    ["End", report.end],
    ["Snapshot", report.asOf],
    ["Currency", "PHP"],
    [
      "Source",
      "Six-household synthetic invoice snapshot; not official HOA records",
    ],
    [
      "Period basis",
      "Invoice due month. Receipt timestamps are unavailable; amounts are not monthly cash collections.",
    ],
    [
      "Coverage",
      "Only supplied invoices. Missing months, unbilled households, expenses and bank balances are unavailable.",
    ],
    [],
    ["SUMMARY"],
    ["Metric", "Amount (PHP)", "Basis"],
    ["Billed", php(report.billed), "Selected supplied invoices"],
    [
      "Recorded against bills",
      php(report.received),
      "As of snapshot; not receipt-date totals",
    ],
    ["Outstanding", php(report.outstanding), "Billed minus recorded"],
    [],
    ["MONTHLY BREAKDOWN"],
    [
      "Due month",
      "Billed (PHP)",
      "Recorded against bills (PHP)",
      "Outstanding (PHP)",
      "Invoice count",
      "Source state",
    ],
    ...report.months.map((month) => [
      month.key,
      php(month.billed),
      php(month.received),
      php(month.outstanding),
      month.count,
      month.count
        ? "Synthetic invoices supplied"
        : "No supplied invoices; totals unavailable",
    ]),
    [],
    ["INVOICE DETAIL"],
    [
      "Synthetic unit",
      "Due date",
      "Billed (PHP)",
      "Recorded (PHP)",
      "Outstanding (PHP)",
      "Status",
    ],
    ...report.rows.map((row) => [
      row.unit,
      row.due,
      php(row.amount),
      php(row.received),
      php(row.amount - row.received),
      row.received === row.amount
        ? "Paid"
        : row.received
          ? "Part paid"
          : "Unpaid",
    ]),
    [
      "SELECTED TOTAL",
      "",
      php(report.billed),
      php(report.received),
      php(report.outstanding),
    ],
    [],
    ["END OF SAMPLE REPORT - NOT AN OFFICIAL STATEMENT OR BANK RECONCILIATION"],
  ];
  return rows.map((row) => [
    ...row,
    ...Array(Math.max(0, 6 - row.length)).fill(""),
  ]);
}
