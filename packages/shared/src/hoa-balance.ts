import { z } from "zod";
const cents = z.string().regex(/^\d+$/);
export const hoaBalanceSchema = z
  .object({
    as_of: z.iso.date(),
    scope: z.literal("posted_hoa_only"),
    linked_lots: z.number().int().nonnegative(),
    billed_lots: z.number().int().nonnegative(),
    invoice_count: z.number().int().nonnegative(),
    billed_centavos: cents,
    allocated_centavos: cents,
    hoa_balance_centavos: cents,
    total_recorded_balance_centavos: cents,
    unallocated_centavos: cents,
    unpaid_months: z.number().int().nonnegative(),
    unpaid_charges: z.number().int().nonnegative(),
    overdue_charges: z.number().int().nonnegative(),
    needs_review: z.boolean(),
    rows: z.array(
      z.object({
        id: z.uuid(),
        physical_id: z.string(),
        period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        due_date: z.iso.date(),
        billed_centavos: cents,
        allocated_centavos: cents,
        balance_centavos: cents,
        status: z.enum(["Paid", "Partial", "Unpaid", "Review"]),
      }),
    ),
  })
  .refine(
    (value) =>
      BigInt(value.hoa_balance_centavos) ===
      BigInt(value.total_recorded_balance_centavos),
    { message: "Recorded total must equal the connected HOA balance." },
  );
export type HoaBalance = z.infer<typeof hoaBalanceSchema>;
export function balanceMoney(value: string) {
  const amount = BigInt(value);
  return `₱${new Intl.NumberFormat("en-PH").format(amount / 100n)}.${String(amount % 100n).padStart(2, "0")}`;
}
export function billingMonth(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00Z`));
}
