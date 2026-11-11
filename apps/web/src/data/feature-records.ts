import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { featureDashboardSchema } from "../../../../packages/shared/src/feature-records";
import { makeClient, useAuth } from "./auth";
export async function featureRpc(name: string, args: Record<string, unknown>) {
  const client = makeClient();
  if (!client) throw new Error("Sign in to connect to this service.");
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (["42883", "PGRST202", "42P01"].includes(error.code))
      throw new Error(
        "This service is not available yet. Contact the HOA office for help.",
      );
    if (error.code === "42501")
      throw new Error(
        "This action is not available for your account. Contact the HOA office for help.",
      );
    if (error.code === "40001")
      throw new Error("This record changed. Refresh before retrying.");
    throw new Error(
      error.code === "22023" || error.code === "P0001"
        ? error.message
        : "The save could not be confirmed. Refresh to check before retrying.",
    );
  }
  return data;
}
export function useFeatureRecords(
  module: string,
  view: string,
  page: number,
  search: string,
  category = "",
  pendingOnly = false,
  issuanceOnly = false,
) {
  const auth = useAuth();
  return useQuery({
    queryKey: [
      "feature-records",
      auth.userId,
      module,
      view,
      page,
      search,
      category,
      pendingOnly,
      issuanceOnly,
    ],
    enabled:
      !!auth.userId && !auth.checking && !auth.preview && !auth.rolePreview,
    retry: false,
    gcTime: 300_000,
    refetchInterval: 30000,
    queryFn: async () =>
      featureDashboardSchema.parse(
        await featureRpc(
          issuanceOnly && view === "review"
            ? module === "household-changes"
              ? "bfe_office_household_queue"
              : "bfe_office_issuance_queue"
            : pendingOnly && view === "review"
              ? "bfe_office_feature_queue"
              : !auth.memberPreview &&
                  view === "published" &&
                  ["businesses", "buy-sell", "jobs", "garage-sales"].includes(
                    module,
                  )
                ? "bfe_livelihood_dashboard"
                : "bfe_feature_dashboard",
          {
            p_module: module,
            ...((pendingOnly || issuanceOnly) && view === "review"
              ? {}
              : { p_view: view }),
            p_page: page,
            p_search: search,
            ...(!auth.memberPreview &&
            view === "published" &&
            ["businesses", "buy-sell", "jobs", "garage-sales"].includes(module)
              ? { p_category: category }
              : {}),
          },
        ),
      ),
  });
}
export function useFeatureMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      args,
    }: {
      name: string;
      args: Record<string, unknown>;
    }) => featureRpc(name, args),
    onSuccess: async () => {
      await client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "account" &&
          query.queryKey.includes("notifications"),
      });
      await Promise.all(
        [
          "feature-records",
          "marketplace",
          "participation",
          "document-library",
          "office-review-inbox",
          "notifications",
          "feature-issuance",
          "calendar-bookings",
          "household-application",
          "registry",
          "office-people",
          "workflow-history",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}
