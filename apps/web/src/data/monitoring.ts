import { useQuery } from "@tanstack/react-query";
import { memberRoles } from "../../../../packages/shared/src/auth";
import { monitorResponseSchema } from "../../../../packages/shared/src/monitoring";
import { makeClient, useAuth } from "./auth";

export function useModuleMonitor(section: string | null, page: number) {
  const auth = useAuth();
  const enabled =
    !!section &&
    !auth.preview &&
    !auth.rolePreview &&
    !!auth.userId &&
    !auth.checking &&
    !auth.memberError &&
    !!auth.member &&
    memberRoles(auth.member).includes("developer");
  return useQuery({
    queryKey: ["developer-monitor", auth.userId, section, page],
    enabled,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const client = makeClient();
      if (!enabled || !client)
        throw new Error("A verified developer session is required.");
      const { data, error } = await client
        .rpc("bfe_monitor_module", { p_section: section!, p_page: page })
        .abortSignal(signal);
      if (error) {
        if (["PGRST202", "42883"].includes(error.code))
          throw new Error(
            "Module monitoring needs its database setup. No sample records are shown in this view.",
          );
        if (error.code === "42501")
          throw new Error(
            "The database did not confirm developer access. Refresh your membership or review its assignment.",
          );
        throw new Error(
          "Monitoring records could not be loaded. Retry after checking the connection. No sample data has been substituted.",
        );
      }
      const parsed = monitorResponseSchema.safeParse(data);
      if (!parsed.success || parsed.data.source !== section)
        throw new Error("The monitoring response could not be verified.");
      return parsed.data;
    },
  });
}
