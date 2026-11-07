import { z } from "zod";
import {
  localMessageSchema,
  sampleAttachmentSchema,
  garageReviewSchema,
} from "./integration";

export const workKindSchema = z.enum([
  "registration",
  "vehicle",
  "permit",
  "incident",
  "expense",
  "announcement",
  "enrollment",
  "ride",
  "listing",
  "access-change",
  "document",
  "baseline",
]);
export const workStatusSchema = z.enum([
  "Draft",
  "Submitted locally",
  "In review",
  "Changes requested",
  "Preview published",
  "Cancelled",
  "Archived",
]);
export const workInputSchema = z.object({
  kind: workKindSchema,
  title: z.string().trim().min(3, "Use at least 3 characters.").max(100),
  detail: z.string().trim().min(10, "Add at least 10 characters.").max(2000),
  date: z.iso.date().optional(),
  amount: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.string().max(300)).default({}),
});
export const workItemSchema = workInputSchema.extend({
  id: z.string(),
  status: workStatusSchema,
  createdAt: z.string(),
  events: z.array(z.object({ at: z.string(), label: z.string() })),
  attachments: z.array(sampleAttachmentSchema).max(8).default([]),
  garageReviews: z.array(garageReviewSchema).max(20).default([]),
});
export type WorkKind = z.infer<typeof workKindSchema>;
export type WorkStatus = z.infer<typeof workStatusSchema>;
export type WorkInput = z.infer<typeof workInputSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export const workTransitionSchema = z.object({
  id: z.string().min(1),
  next: workStatusSchema,
  reason: z
    .string()
    .trim()
    .min(5, "Add a short reason for this local change.")
    .max(300),
});
export const workspaceStateSchema = z.object({
  version: z.literal(1),
  items: z.array(workItemSchema),
  preferences: z.object({ inApp: z.boolean(), email: z.boolean() }),
  messages: z.array(localMessageSchema).max(1000).default([]),
  readMarks: z.record(z.string(), z.string()).default({}),
});
export const registrationPreviewSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z
    .email()
    .refine(
      (value) => value.endsWith("@example.invalid"),
      "Use a sample address ending in @example.invalid.",
    ),
  unit: z.string().trim().min(3).max(60),
  role: z.enum(["Homeowner", "Renter"]),
});
export const proposedTransitions: Record<WorkStatus, WorkStatus[]> = {
  Draft: ["Submitted locally", "Preview published", "Archived"],
  "Submitted locally": ["In review", "Cancelled"],
  "In review": ["Changes requested", "Archived"],
  "Changes requested": ["Submitted locally", "Cancelled"],
  "Preview published": ["Archived"],
  Cancelled: [],
  Archived: [],
};
export function assertPreviewTransition(
  item: Pick<WorkItem, "kind" | "status">,
  next: WorkStatus,
) {
  if (!proposedTransitions[item.status].includes(next))
    throw new Error(
      "This preview status change is not available. Refresh the record and try again.",
    );
  if (
    next === "Preview published" &&
    !["announcement", "listing", "document"].includes(item.kind)
  )
    throw new Error("Only sample content can be published in the preview.");
}
export const capabilityRows = [
  {
    task: "Household statements",
    resident: "Own sample household",
    office: "Finance policy pending",
    security: "Not proposed",
    driver: "Not proposed",
    board: "Oversight policy pending",
  },
  {
    task: "Requests & bookings",
    resident: "Submit and follow own",
    office: "Assigned work proposed",
    security: "Security work only",
    driver: "Assigned trips only",
    board: "Policy pending",
  },
  {
    task: "Roles & permissions",
    resident: "No self-escalation",
    office: "Protected authority pending",
    security: "No general authority",
    driver: "No general authority",
    board: "Not automatic",
  },
  {
    task: "Payment verification",
    resident: "No self-verification",
    office: "Finance authority pending",
    security: "No authority proposed",
    driver: "No authority proposed",
    board: "Policy pending",
  },
  {
    task: "Gate activity",
    resident: "Request only",
    office: "Override rules pending",
    security: "Verification rules pending",
    driver: "No authority proposed",
    board: "Not automatic",
  },
] as const;
