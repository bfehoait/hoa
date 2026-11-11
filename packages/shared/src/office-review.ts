import { z } from "zod";

// Routing metadata only. Protected RPCs independently authorize each read/decision.
export const featureReviewCapabilities = {
  "unit-register": "property",
  "expense-evidence": "finance",
  businesses: "livelihood",
  "buy-sell": "livelihood",
  jobs: "livelihood",
  "garage-sales": "livelihood",
  "booth-events": "livelihood",
  workshops: "livelihood",
  "booth-applications": "livelihood",
  participation: "livelihood",
  "ride-requests": "transport",
  "carpool-interests": "transport",
  stations: "transport",
  carpools: "transport",
  complaints: "requests",
  concerns: "requests",
  tickets: "requests",
  messages: "requests",
  "gate-passes": "security",
  "walk-ins": "security",
  "guard-roster": "security",
  "household-changes": "property",
  publishing: "community",
  events: "community",
  "board-records": "documents",
  "election-setup": "documents",
  "billing-proposals": "finance",
  "payment-evidence": "finance",
  budgets: "finance",
  "access-proposals": "operations",
  "facility-rules": "operations",
  "election-candidates": "documents",
  vehicles: "property",
  permits: "property",
} as const;

export const officeReviewSchema = z.object({
  accounting_available: z.boolean().optional(),
  queues: z.array(
    z.object({
      kind: z.enum([
        "accounting",
        "garage_items",
        "registrations",
        "lots",
        "bookings",
        "passes",
        "feature",
        "participation",
        "issuance",
        "household",
        "requests",
        "shuttle",
      ]),
      module: z.string(),
      pending: z.number().int().nonnegative(),
      in_review: z.number().int().nonnegative(),
      can_decide: z.boolean(),
    }),
  ),
});
export type OfficeReviewQueue = z.infer<
  typeof officeReviewSchema
>["queues"][number];
export function officeReviewPath(
  queue: Pick<OfficeReviewQueue, "kind" | "module">,
) {
  switch (queue.kind) {
    case "garage_items":
      return "/office/garage-items";
    case "accounting":
      return `/office/finance/accounting?kind=${encodeURIComponent(queue.module)}&status=Submitted`;
    case "registrations":
      return "/office/registrations?status=Pending";
    case "lots":
      return "/office/approvals?queue=lots";
    case "bookings":
      return "/office/bookings?queue=pending";
    case "passes":
      return "/office/visitors?queue=pending";
    case "requests":
      return "/office/requests";
    case "shuttle":
      return "/office/shuttle";
    case "participation":
      return `/office/participation/${queue.module}`;
    case "household":
      return "/office/review/household-changes?application=1";
    case "issuance":
      return `/office/review/${queue.module}?issuance=1`;
    case "feature":
      return `/office/review/${queue.module}`;
  }
}
