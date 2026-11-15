import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth, makeClient } from "./auth";
const schema = z.object({
  workspace: z.enum(["board", "security", "transport"]),
  as_of: z.string(),
  timezone: z.literal("Asia/Manila"),
  entered_passes: z.number().int().nonnegative().optional(),
  movements_today: z.number().int().nonnegative().optional(),
  entries_by_type: z
    .array(
      z.object({ label: z.string(), count: z.number().int().nonnegative() }),
    )
    .optional(),
  association_scope: z.boolean().optional(),
  riders_today: z.number().nonnegative().optional(),
  served_requests: z.number().int().nonnegative().optional(),
  average_pickup_minutes: z.number().nonnegative().nullable().optional(),
  timed_requests: z.number().int().nonnegative().optional(),
  finance_available: z.boolean().optional(),
  billed_centavos: z.string().regex(/^\d+$/).optional(),
  allocated_centavos: z.string().regex(/^\d+$/).optional(),
  allocation_percent: z.number().min(0).max(100).nullable().optional(),
  expense_centavos: z.string().regex(/^\d+$/).optional(),
  expense_categories: z
    .array(
      z.object({
        label: z.string(),
        amount_centavos: z.string().regex(/^\d+$/),
      }),
    )
    .optional(),
});
export function useWorkspaceMetrics(
  workspace: "board" | "security" | "transport" | null,
) {
  const auth = useAuth();
  return useQuery({
    queryKey: ["workspace-metrics", auth.userId, workspace],
    enabled:
      !!workspace &&
      !!auth.userId &&
      !auth.checking &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview,
    retry: false,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      const client = makeClient();
      if (!client) throw new Error("Sign in to load workspace summaries.");
      const { data, error } = await client
        .rpc("bfe_workspace_metrics", { p_workspace: workspace })
        .abortSignal(signal);
      if (error) {
        if (["PGRST202", "42883"].includes(error.code))
          throw new Error(
            "Summary information is not ready yet. Ask the system administrator to check the setup.",
          );
        if (error.code === "42501") {
          const reasons: Record<string, string> = {
            "Active account required.":
              "Your account could not be confirmed. Please sign in again.",
            "Board role required.":
              "Your account needs Board access to view these totals.",
            "Board or Developer role required.":
              "You need Board or system support access to view these totals.",
            "Security view permission required.":
              "Your account does not have permission to view Security totals. Ask the administrator to check your access.",
            "Driver or transport review permission required.":
              "You need an assigned shuttle or permission to review transport to view these totals.",
          };
          throw new Error(
            reasons[error.message] ??
              "Your account does not have permission to view these totals. Ask the administrator to check your access.",
          );
        }
        throw new Error(
          "Totals could not be loaded. Check your connection and try again.",
        );
      }
      const parsed = schema.parse(data);
      if (parsed.workspace !== workspace)
        throw new Error(
          "These totals could not be confirmed for the selected workspace.",
        );
      return parsed;
    },
  });
}
export function metricMoney(value: string) {
  const cents = BigInt(value);
  return `₱${new Intl.NumberFormat("en-PH").format(cents / 100n)}.${String(cents % 100n).padStart(2, "0")}`;
}
