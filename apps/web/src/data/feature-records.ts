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
        "This service needs its numbered database migration. Contact the office; nothing was saved locally.",
      );
    if (error.code === "42501")
      throw new Error(
        "Your membership or assigned permissions do not allow this action.",
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
) {
  const auth = useAuth();
  return useQuery({
    queryKey: ["feature-records", auth.userId, module, view, page, search],
    enabled:
      !!auth.userId && !auth.checking && !auth.preview && !auth.rolePreview,
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () =>
      featureDashboardSchema.parse(
        await featureRpc("bfe_feature_dashboard", {
          p_module: module,
          p_view: view,
          p_page: page,
          p_search: search,
        }),
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
      await client.invalidateQueries({ queryKey: ["feature-records"] });
    },
  });
}
