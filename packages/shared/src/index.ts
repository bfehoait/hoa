import { z } from "zod";

export const requestSchema = z.object({
  category: z.enum(["Maintenance", "Concern", "Complaint", "Document"]),
  title: z.string().trim().min(5, "Use at least 5 characters.").max(100),
  details: z
    .string()
    .trim()
    .min(15, "Add at least 15 characters so the office can understand.")
    .max(2000),
});
export const bookingSchema = z
  .object({
    amenity: z.enum(["Clubhouse", "Basketball court", "Swimming pool"]),
    date: z.iso.date("Choose a valid date."),
    time: z.enum(["09:00–11:00", "14:00–16:00", "17:00–19:00"]),
    guests: z.coerce.number().int().min(1).max(50),
  })
  .superRefine((value, ctx) => {
    if (value.date < manilaDate())
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Choose today or a future date.",
      });
  });
export const visitorSchema = z
  .object({
    name: z.string().trim().min(3, "Enter the visitor’s full name.").max(100),
    date: z.iso.date("Choose a valid date."),
    purpose: z.enum(["Family or friend", "Delivery", "Service provider"]),
    plate: z.string().trim().max(16),
  })
  .superRefine((value, ctx) => {
    if (value.date < manilaDate())
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Choose today or a future date.",
      });
  });
export const profileSchema = z.object({
  name: z.string().trim().min(3).max(100),
  phone: z
    .string()
    .regex(/^09\d{9}$/, "Use an 11-digit mobile number starting with 09."),
});
export function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function money(centavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}
export const invoiceSchema = z
  .object({
    id: z.string(),
    period: z.string(),
    due: z.string(),
    amount: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
  })
  .refine(
    (v) => v.received <= v.amount,
    "Receipts cannot exceed the bill; credits need a separate ledger.",
  );
export type Invoice = z.infer<typeof invoiceSchema>;
export function balance(invoice: Invoice) {
  return Math.max(0, invoice.amount - invoice.received);
}
export function invoiceStatus(invoice: Invoice, asOf: string) {
  return balance(invoice) === 0
    ? "Paid"
    : invoice.due < asOf
      ? "Overdue"
      : "Due";
}
export function aging(invoices: Invoice[], asOf: string) {
  const buckets = { current: 0, days1to30: 0, days31to60: 0, days61plus: 0 };
  for (const invoice of invoices) {
    const amount = balance(invoice);
    const days = Math.floor(
      (Date.parse(asOf + "T00:00:00Z") -
        Date.parse(invoice.due + "T00:00:00Z")) /
        86400000,
    );
    if (days <= 0) buckets.current += amount;
    else if (days <= 30) buckets.days1to30 += amount;
    else if (days <= 60) buckets.days31to60 += amount;
    else buckets.days61plus += amount;
  }
  return buckets;
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^(?:\s*[=+\-@]|[\t\r])/.test(text) ? "'" + text : text).replaceAll(
      '"',
      '""',
    ) +
    '"'
  );
}
