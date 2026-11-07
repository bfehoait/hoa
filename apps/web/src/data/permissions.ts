import { useQuery } from "@tanstack/react-query";
import {
  effectiveAccessSchema,
  hasCapability,
  officeRequirement,
} from "../../../../packages/shared/src/permissions";
import { makeClient, useAuth } from "./auth";
const featureCapabilities: Record<string, string> = {
  "unit-register": "property",
  "expense-evidence": "finance",
  businesses: "livelihood",
  "buy-sell": "livelihood",
  jobs: "livelihood",
  "garage-sales": "livelihood",
  "booth-events": "livelihood",
  "booth-applications": "livelihood",
  workshops: "livelihood",
  participation: "livelihood",
  "ride-requests": "transport",
  carpools: "transport",
  "carpool-interests": "transport",
  stations: "transport",
  complaints: "requests",
  concerns: "requests",
  tickets: "requests",
  messages: "requests",
  "gate-passes": "security",
  "walk-ins": "security",
  "guard-roster": "security",
  "household-changes": "property",
  publishing: "community",
  events: "community",
  "board-records": "documents",
  "election-setup": "documents",
  "billing-proposals": "finance",
  "payment-evidence": "finance",
  budgets: "finance",
  "access-proposals": "operations",
  "facility-rules": "operations",
  "election-candidates": "documents",
};
function tabForPath(
  path: string,
): { module: string; scope: string } | undefined {
  const office = officeRequirement(path);
  if (office) return office;
  const normalized = path.split(/[?#]/)[0];
  if (normalized.startsWith("/explore/")) {
    const module = featureCapabilities[normalized.split("/")[2]];
    if (module) return { module, scope: "own" };
  }
  const entries: [RegExp, string, string][] = [
    [/^\/account(\/|$)/, "finance", "own"],
    [/^\/more\/lots(\/|$)/, "property", "own"],
    [/^\/services\/(book|booking|bookings|calendar)(\/|$)/, "calendar", "own"],
    [/^\/services\/(visitor|visitors)(\/|$)/, "security", "own"],
    [/^\/services\/(request|requests|inbox)(\/|$)/, "requests", "own"],
    [/^\/(driver|more\/transport)(\/|$)/, "transport", "own"],
    [/^\/board\/shuttle/, "transport", "association"],
    [
      /^\/(directory\/market|more\/marketplace|directory\/learning|more\/training)(\/|$)/,
      "livelihood",
      "approved",
    ],
    [/^\/community(\/|$)/, "community", "approved"],
    [/^\/security(\/|$)/, "security", "association"],
  ];
  const item = entries.find(([pattern]) => pattern.test(normalized));
  return item ? { module: item[1], scope: item[2] } : undefined;
}

export function usePermissions() {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  const query = useQuery({
    queryKey: [
      "permissions",
      auth.userId,
      auth.member?.role,
      auth.member?.extra_roles,
      auth.member?.status,
    ],
    enabled:
      !sample &&
      !!auth.userId &&
      !!auth.member &&
      !auth.memberPending &&
      !auth.checking &&
      !auth.memberError &&
      auth.member.status === "Active",
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const client = makeClient();
      if (!client) throw new Error("Sign-in is not connected.");
      const { data, error } = await client
        .rpc("bfe_my_access")
        .abortSignal(signal);
      if (error)
        throw new Error(
          ["42883", "PGRST202"].includes(error.code)
            ? "Access permissions have not been installed. Ask the system owner to complete setup."
            : "Your access could not be verified. Refresh or contact the office.",
        );
      return effectiveAccessSchema.parse(data);
    },
  });
  const allowsPath = (path: string) => {
    if (sample) return true;
    const tab = tabForPath(path);
    if (
      tab &&
      query.data?.tab_modes.some(
        (t) =>
          t.module === tab.module &&
          t.scope === tab.scope &&
          t.mode === "hidden",
      )
    )
      return false;
    const requirement = officeRequirement(path);
    if (requirement === null) return true;
    return (
      !!requirement && !query.isError && hasCapability(query.data, requirement)
    );
  };
  const readOnlyPath = (path: string) => {
    const tab = tabForPath(path);
    return (
      !!tab &&
      !!query.data?.tab_modes.some(
        (t) =>
          t.module === tab.module && t.scope === tab.scope && t.mode === "view",
      )
    );
  };
  return { ...query, sample, allowsPath, readOnlyPath };
}
