import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { memberRoles } from "../../../../packages/shared/src/auth";
import { officeReviewSchema } from "../../../../packages/shared/src/office-review";
import { isOfficeApprovalQueue } from "../features/office/office-approval-queues";
import { makeClient, useAuth } from "./auth";

const count = z.number().int().nonnegative();
const schema = z.object({
  as_of: z.string(),
  office: officeReviewSchema.optional(),
  gate_checks: count.optional(),
  shuttle_review: count.optional(),
  driver_actions: count.optional(),
});
export type ActionBadge = { count: number; label: string };

export function useNavigationBadges(enabled: boolean) {
  const auth = useAuth();
  const client = useQueryClient();
  const roles = auth.member ? memberRoles(auth.member).sort().join(",") : "";
  const active =
    enabled &&
    !!auth.userId &&
    !!auth.member &&
    !auth.memberError &&
    !auth.checking &&
    !auth.preview &&
    !auth.rolePreview &&
    !auth.memberPreview;
  const query = useQuery({
    queryKey: ["navigation-action-badges", auth.userId, roles],
    enabled: active,
    retry: false,
    staleTime: 15000,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      const { data, error } = await makeClient()!
        .rpc("bfe_navigation_action_badges")
        .abortSignal(signal);
      if (error)
        throw new Error(
          ["PGRST202", "42883"].includes(error.code)
            ? "Pending counts are not ready yet. Ask the system administrator to check the setup. You can still open the review pages."
            : "Pending counts could not update. Open the relevant section to check the current requests.",
        );
      return schema.parse(data);
    },
  });
  // Decisions anywhere in the app refresh the shared counts immediately.
  // Polling also catches work submitted by a different signed-in account.
  useEffect(() => {
    if (!active) return;
    return client.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success")
        void client.invalidateQueries({
          queryKey: ["navigation-action-badges", auth.userId],
        });
    });
  }, [active, auth.userId, client]);

  const badges: Record<string, ActionBadge> = {};
  // Never carry a stale permission result into a denied/failed refresh.
  if (active && !query.isError && query.data) {
    const data = query.data;
    if (data.office) {
      const actionable = data.office.queues.filter((queue) => queue.can_decide);
      badges["/office/approvals"] = {
        count: actionable
          .filter(isOfficeApprovalQueue)
          .reduce((sum, q) => sum + q.pending + q.in_review, 0),
        label: "Approvals and review follow-up",
      };
      badges["/office/requests"] = {
        count: actionable
          .filter((q) => !isOfficeApprovalQueue(q) && q.kind !== "shuttle")
          .reduce((sum, q) => sum + q.pending + q.in_review, 0),
        label: "Helpdesk requests needing follow-up",
      };
    }
    if (data.gate_checks !== undefined)
      badges["/security/gate"] = {
        count: data.gate_checks,
        label: "Passes ready for gate check or exit follow-up",
      };
    if (data.shuttle_review !== undefined)
      badges["/board/shuttle"] = {
        count: data.shuttle_review,
        label: "Active shuttle requests for review",
      };
    if (data.driver_actions !== undefined)
      badges["/driver"] = {
        count: data.driver_actions,
        label: "Available ride requests and assigned rides to progress",
      };
  }
  return {
    badges,
    error: active && query.isError ? query.error.message : null,
  };
}
