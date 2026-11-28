import { z } from "zod";
export const requestCategories = [
  "Maintenance",
  "Concern",
  "Complaint",
  "Idea",
  "Document",
  "Support",
] as const;
// Choices offered when creating a request. "Concern" also covers suggestions:
// the stored "Idea" value stays valid on the server for earlier requests but is
// no longer offered, and displays under the combined label. Each detail is the
// full note shown under the Category field.
const privateToHandlers =
  "Your request is visible to you and authorized handlers, not the community feed.";
export const helpdeskCategories = [
  {
    value: "Maintenance",
    label: "Community and Maintenance Issue",
    detail:
      "Report common-area damage or maintenance needs. Your request goes directly to authorized committee and will not appear on the community feed.",
  },
  {
    value: "Complaint",
    label: "Violation or Complaint",
    detail:
      "Report a rule violation or neighbor dispute privately. Only you and authorized committee can view this request—it will not appear on the community feed.",
  },
  {
    value: "Concern",
    label: "Concern and Suggestion",
    detail:
      "Raise a community concern or suggest an improvement for office, BOD, or officer review. Your request is visible only to you and authorized committee, not the community feed.",
  },
  {
    value: "Support",
    label: "Support",
    detail: `Get help with an account or community service. ${privateToHandlers}`,
  },
] as const;
export const requestBusinessFields = [
  {
    key: "topic",
    label: "Topic or issue type",
    categories: [
      "Maintenance",
      "Concern",
      "Complaint",
      "Idea",
      "Document",
      "Support",
    ],
  },
  {
    key: "location",
    label: "Location",
    categories: ["Maintenance", "Concern", "Complaint", "Idea"],
  },
  {
    key: "party",
    label: "Person or household involved",
    categories: ["Complaint"],
  },
  {
    key: "service",
    label: "Related service or document",
    categories: ["Support", "Document"],
  },
  {
    key: "evidence_reference",
    label: "Supporting evidence reference",
    categories: ["Maintenance", "Concern", "Complaint", "Document", "Support"],
  },
] as const;
export const requestBusinessDetailsSchema = z
  .object({
    topic: z.string().trim().max(120).default(""),
    location: z.string().trim().max(200).default(""),
    party: z.string().trim().max(200).default(""),
    service: z.string().trim().max(120).default(""),
    evidence_reference: z.string().trim().max(500).default(""),
  })
  .strict();
export const requestHandlingSchema = z.object({
  details: requestBusinessDetailsSchema,
  priority: z.enum(["Untriaged", "Low", "Normal", "High", "Urgent"]),
  assignee_id: z.uuid().nullable(),
  assignee_name: z.string().nullable(),
  resolution: z.string(),
  version: z.number().int(),
  can_handle: z.boolean(),
  can_assign: z.boolean(),
  handlers: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export const requestCategoryLabel = (value: string) =>
  helpdeskCategories.find(
    (c) => c.value === (value === "Idea" ? "Concern" : value),
  )?.label ?? value;
export const requestStatuses = ["Open", "In progress", "Resolved"] as const;
export const liveRequestInput = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(120),
  description: z
    .string()
    .trim()
    .min(10, "Add a little more detail (at least 10 characters).")
    .max(5000),
  category: z.enum(requestCategories),
  business_details: requestBusinessDetailsSchema.optional(),
});
export const liveRequestSchema = liveRequestInput.extend({
  id: z.uuid(),
  owner_id: z.uuid(),
  unit_snapshot: z.string().nullable(),
  status: z.enum(requestStatuses),
  version: z.number().int().positive(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const liveMessageSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  author_id: z.uuid(),
  author_kind: z.enum(["Resident", "Office"]),
  body: z.string().min(1).max(5000),
  created_at: z.iso.datetime({ offset: true }),
});
export type LiveRequest = z.infer<typeof liveRequestSchema>;
export type LiveRequestInput = z.infer<typeof liveRequestInput>;
export const liveRequestFields =
  "id,owner_id,title,description,category,unit_snapshot,status,version,created_at,updated_at";
export const liveMessageFields =
  "id,request_id,author_id,author_kind,body,created_at";
