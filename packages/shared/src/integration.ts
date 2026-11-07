import { z } from "zod";
import type { WorkItem } from "./workspace";

export const publishableModules = [
  "businesses",
  "buy-sell",
  "jobs",
  "garage-sales",
  "booth-events",
  "workshops",
  "carpools",
  "publishing",
  "events",
  "board-records",
  "election-candidates",
] as const;
export const localActorSchema = z.enum(["Resident", "Office"]);
export type LocalActor = z.infer<typeof localActorSchema>;
export const localMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  actor: localActorSchema,
  text: z.string().trim().min(5).max(1000),
  at: z.iso.datetime(),
});
export const messageInputSchema = localMessageSchema.pick({
  threadId: true,
  actor: true,
  text: true,
});
export const sampleAttachmentSchema = z.object({
  id: z.string(),
  name: z.string().regex(/^DEMO-[A-Za-z0-9-]+\.(pdf|png)$/),
  kind: z.enum([
    "Document reference",
    "Image reference",
    "QR content reference",
  ]),
  caption: z.string().max(120),
});
export const conversationModules = [
  "messages",
  "complaints",
  "concerns",
  "tickets",
];
export const audienceOptions = [
  "All members",
  "Homeowners",
  "Renters",
  "Board",
  "Security",
] as const;
export function isPublishedContent(item: WorkItem) {
  return (
    item.kind === "baseline" &&
    item.status === "Preview published" &&
    (publishableModules as readonly string[]).includes(item.metadata.module)
  );
}
export function matchesAudience(item: WorkItem, audience: string) {
  const target = item.metadata.audience;
  return (
    !target ||
    target === "All members" ||
    target === "Members" ||
    target === audience
  );
}
export function unreadMessages(
  messages: z.infer<typeof localMessageSchema>[],
  marks: Record<string, string>,
  threadId: string,
  actor: LocalActor,
) {
  const thread = messages.filter((message) => message.threadId === threadId);
  const cursor = thread.findIndex(
    (message) => message.id === marks[`${actor}:${threadId}`],
  );
  return thread.filter(
    (message, index) => index > cursor && message.actor !== actor,
  ).length;
}
export const garageReviewSchema = z.object({
  index: z.number().int().min(0).max(19),
  item: z.string().min(1).max(300),
  decision: z.enum(["Preview reviewed", "Changes requested"]),
  reason: z.string().trim().min(5).max(300),
});
export function garageItems(text: string) {
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
export function assertContentPublication(item: WorkItem) {
  if (
    item.kind !== "baseline" ||
    !(publishableModules as readonly string[]).includes(item.metadata.module)
  )
    throw new Error(
      "Only supported sample content can appear in local directories. Financial, access and operational records cannot be published.",
    );
  if (item.status !== "In review")
    throw new Error(
      "Submit the local draft and start its review before preview publication.",
    );
  if (
    item.metadata.module === "garage-sales" &&
    garageItems(item.metadata.items ?? "").some(
      (name, index) =>
        !item.garageReviews.some(
          (review) =>
            review.index === index &&
            review.item === name &&
            review.decision === "Preview reviewed",
        ),
    )
  )
    throw new Error(
      "Review every current sample garage item before local publication. This does not approve any real item.",
    );
}
