import { z } from "zod";
export type AccountingQuestion = {
  key: string;
  label: string;
  type?: "text" | "date" | "month" | "number" | "textarea";
  required?: boolean;
  options?: string[];
};
export type AccountingForm = {
  id: string;
  title: string;
  effect: string;
  fields: AccountingQuestion[];
};
const question = (
  key: string,
  label: string,
  type: AccountingQuestion["type"] = "text",
  required = true,
): AccountingQuestion => ({ key, label, type, required });
export const accountingForms: AccountingForm[] = [
  {
    id: "dues-rule",
    title: "Dues configuration",
    effect:
      "Posting authorizes this rate for a later billing run. It does not create invoices or charge late fees automatically.",
    fields: [
      question("name", "Rate name"),
      {
        key: "mode",
        label: "Assessment basis",
        required: true,
        options: ["Flat amount", "Per square metre"],
      },
      question("rate", "Monthly rate (PHP)", "number"),
      question("dueDay", "Due day of month (1–31)", "number"),
      question("latePercent", "Approved late fee percentage", "number"),
      question("effective", "Effective from", "date"),
      question("source", "Approved policy reference"),
    ],
  },
  {
    id: "billing-run",
    title: "Billing run",
    effect:
      "Posting creates monthly invoices for the selected active properties using a posted rate. A per-area run requires reviewed lot areas. No payment is recorded.",
    fields: [
      question("period", "Billing month", "month"),
      question("rule", "Posted rate reference"),
      {
        key: "scope",
        label: "Properties to bill",
        required: true,
        options: ["All active lots", "One phase", "One lot"],
      },
      question("phase", "Phase (when billing one phase)", "number", false),
      question(
        "physicalId",
        "Physical lot ID (when billing one lot)",
        "text",
        false,
      ),
      question("memo", "Billing memo", "textarea", false),
    ],
  },
  {
    id: "payment",
    title: "Payment recording",
    effect:
      "Posting records an approved accounting payment. Allocation to an invoice is explicit; this is not a bank-clearance or payment-gateway confirmation.",
    fields: [
      question("physicalId", "Physical lot ID"),
      question("date", "Date paid", "date"),
      question("amount", "Amount (PHP)", "number"),
      question("method", "Payment method"),
      question("payee", "Received from / payer"),
      question("reference", "Official receipt or payment reference"),
      question(
        "allocationPeriod",
        "Invoice month to allocate (leave blank for unallocated)",
        "month",
        false,
      ),
      question("memo", "Payment memo", "textarea", false),
    ],
  },
  {
    id: "receipt-allocation",
    title: "Imported receipt allocation",
    effect:
      "After Office verifies the lot's billing baseline, apply an existing receipt to the month it actually covers. Posting reduces that invoice's remaining amount; it does not create another payment. Split a multi-month receipt across separate month allocations. An independent reviewer must post each allocation.",
    fields: [
      question("receiptReference", "Imported OR number"),
      question("physicalId", "Physical lot ID"),
      question("allocationPeriod", "Verified billing month covered", "month"),
      question("amount", "Amount to allocate (PHP)", "number"),
      question("reference", "Office verification reference"),
      question("memo", "Allocation / baseline verification notes", "textarea"),
    ],
  },
  {
    id: "expense-category",
    title: "Expense category",
    effect:
      "Posting makes this category available for recording expenses. Reversal is blocked while posted expenses use it.",
    fields: [
      question("category", "Category name"),
      question("description", "Description", "textarea", false),
    ],
  },
  {
    id: "expense",
    title: "Expense recording",
    effect:
      "Posting records the reviewed expense amount and its evidence. It does not execute a bank payment.",
    fields: [
      question("date", "Expense date", "date"),
      question("category", "Posted expense category"),
      question("amount", "Amount (PHP)", "number"),
      question("payee", "Payee"),
      question("method", "Payment method"),
      question("reference", "Expense voucher or document reference"),
      question("memo", "Expense memo", "textarea", false),
    ],
  },
  {
    id: "monthly-expense",
    title: "Monthly expense total",
    effect:
      "Posting records an approved reported monthly total for reconciliation. It is not added again to individual expense entries.",
    fields: [
      question("period", "Reporting month", "month"),
      question("amount", "Reported expense total (PHP)", "number"),
      question("reference", "Report reference"),
      question("memo", "Notes and reconciliation explanation", "textarea"),
    ],
  },
];
export const accountingEntrySchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  fields: z.record(z.string(), z.string()),
  status: z.enum(["Draft", "Submitted", "Posted", "Rejected", "Reversed"]),
  version: z.number().int(),
  creator_id: z.uuid(),
  created_at: z.string(),
  reviewer_id: z.uuid().nullable(),
  review_note: z.string().nullable(),
});
export const accountingDashboardSchema = z.object({
  rows: z.array(accountingEntrySchema),
  total: z.number().int(),
  can_create: z.boolean(),
  can_review: z.boolean(),
  can_reverse: z.boolean(),
  can_export: z.boolean(),
  rules: z.array(z.object({ id: z.uuid(), name: z.string() })),
  categories: z.array(z.string()),
  summary: z.object({
    invoices: z.number().int(),
    billed_centavos: z.string(),
    allocated_centavos: z.string(),
    unallocated_centavos: z.string(),
    expenses_centavos: z.string(),
  }),
});
