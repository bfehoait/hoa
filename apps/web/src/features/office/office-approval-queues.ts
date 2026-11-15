import {
  featureReviewCapabilities,
  type OfficeReviewQueue,
} from "../../../../../packages/shared/src/office-review";

// Inbox purpose only, not authorization. Each service still checks permissions.
// Conversations and ride dispatch have their own desks, rather than decisions
// in the approval inbox. Keep both aggregate counts and item readers consistent.
export function isOfficeApprovalQueue(
  queue: Pick<OfficeReviewQueue, "kind" | "module">,
) {
  if (queue.kind === "requests" || queue.kind === "shuttle") return false;
  if (queue.kind === "feature") {
    const capability =
      featureReviewCapabilities[
        queue.module as keyof typeof featureReviewCapabilities
      ];
    return capability !== "requests" && queue.module !== "ride-requests";
  }
  return true;
}
