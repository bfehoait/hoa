import { isOfficeApprovalQueue } from "./office-approval-queues";
import { z } from "zod";
import type { OfficeReviewQueue } from "../../../../../packages/shared/src/office-review";
import { featureRpc } from "../../data/feature-records";

// Small display-only projection of each existing authorized queue reader.
// Details and decisions are still read and checked by the original desks.
const rowSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  created_at: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  purpose: z.string().optional(),
  facility_name: z.string().optional(),
  visitor: z.string().optional(),
  physical_id: z.string().optional(),
  starts_at: z.string().optional(),
  valid_from: z.string().optional(),
  activity_title: z.string().nullable().optional(),
  details: z.unknown().optional(),
  pickup: z.string().optional(),
  destination: z.string().optional(),
  sale_title: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  pending: z.number().optional(),
});
const envelope = z.object({
  rows: z.array(rowSchema),
  total: z.number().int().nonnegative(),
});
export type InboxRecord = {
  id: string;
  title: string;
  description: string;
  status: string;
  at?: string | null;
  queue: OfficeReviewQueue;
  page: number;
};

export async function readInboxRecords(queue: OfficeReviewQueue, page: number) {
  if (!isOfficeApprovalQueue(queue))
    throw new Error(
      "This item belongs in its service desk, not the approval inbox.",
    );
  const base = { p_page: page, p_search: "" };
  let raw: unknown;
  switch (queue.kind) {
    case "registrations":
      raw = await featureRpc("bfe_staff_directory", {
        ...base,
        p_kind: "registrations",
        p_field: "name",
        p_status: "Pending",
      });
      break;
    case "bookings":
    case "passes":
      raw = await featureRpc("bfe_office_operation_queue", {
        p_kind: queue.kind === "bookings" ? "booking" : "visitor",
        p_page: page,
      });
      break;
    case "accounting":
      raw = await featureRpc("bfe_accounting_dashboard", {
        ...base,
        p_kind: queue.module,
        p_status: "Submitted",
      });
      break;
    case "participation":
      raw = await featureRpc("bfe_business_participation_dashboard", {
        p_module: queue.module,
        p_office: true,
        p_pending: true,
        p_page: page,
      });
      break;
    case "garage_items":
      raw = await featureRpc("bfe_garage_items", {
        p_record: null,
        p_office: true,
        p_page: page,
      });
      break;
    case "lots":
      raw = await featureRpc("bfe_pending_lot_links", { p_page: page });
      break;
    case "requests":
    case "shuttle":
      throw new Error(
        "This item belongs in its service desk, not the approval inbox.",
      );
    default:
      raw = await featureRpc(
        queue.kind === "household"
          ? "bfe_office_household_queue"
          : queue.kind === "issuance"
            ? "bfe_office_issuance_queue"
            : "bfe_office_feature_queue",
        {
          ...base,
          p_module:
            queue.kind === "household" ? "household-changes" : queue.module,
        },
      );
  }
  const parsed = envelope.parse(raw);
  return {
    total: parsed.total,
    rows: parsed.rows
      .filter((r) => queue.kind !== "garage_items" || r.status === "Submitted")
      .map((r): InboxRecord => ({
        id: r.id,
        queue,
        page,
        at: r.created_at ?? r.starts_at ?? r.valid_from,
        title:
          r.name ||
          r.facility_name ||
          r.visitor ||
          r.title ||
          r.activity_title ||
          r.physical_id ||
          r.pickup ||
          r.fields?.name ||
          r.fields?.reference ||
          queue.module ||
          "Submission",
        description: [
          r.unit || r.physical_id,
          r.role,
          r.purpose || r.detail || r.destination || r.sale_title,
        ]
          .filter(Boolean)
          .join(" · "),
        status:
          r.status ?? (queue.kind === "lots" ? "Pending" : "Awaiting review"),
      })),
  };
}
