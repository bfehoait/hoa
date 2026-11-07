import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { memberRoles } from "../../../../packages/shared/src/auth";
import {
  applicationSchema,
  directoryMemberSchema,
} from "../../../../packages/shared/src/people";
import { makeClient, useAuth } from "./auth";
import { usePermissions } from "./permissions";

export type PeopleFilter = {
  page: number;
  search: string;
  field: "name" | "email" | "unit";
  status: string;
};
export function usePeople(
  kind: "members" | "registrations",
  filter: PeopleFilter,
) {
  const auth = useAuth();
  const permissions = usePermissions();
  const permitted =
    !auth.preview &&
    !auth.rolePreview &&
    !auth.checking &&
    !auth.memberPending &&
    !auth.memberError &&
    !!auth.userId &&
    !!auth.member &&
    memberRoles(auth.member).some(
      (role) => role === "admin" || role === "developer",
    ) &&
    permissions.allowsPath(
      kind === "members" ? "/office/residents" : "/office/registrations",
    );
  return useQuery({
    queryKey: ["office-people", auth.userId, kind, filter],
    enabled: permitted,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const client = makeClient();
      if (!permitted || !client) throw new Error("Office access is required.");
      const result = await client
        .rpc("bfe_staff_directory", {
          p_kind: kind,
          p_page: Math.max(0, Math.floor(filter.page)),
          p_search: filter.search.trim().slice(0, 100),
          p_field: filter.field,
          p_status: filter.status,
        })
        .abortSignal(signal);
      if (result.error)
        throw new Error(
          "The staff directory needs database migration 004, or your access could not be verified.",
        );
      const envelope = z
        .object({
          rows: z.array(z.unknown()),
          total: z.number().int().nonnegative(),
        })
        .parse(result.data);
      const data = envelope.rows;
      const count = envelope.total;
      const parsed =
        kind === "members"
          ? z.array(directoryMemberSchema).safeParse(data)
          : z.array(applicationSchema).safeParse(data);
      if (!parsed.success)
        throw new Error(
          "The database returned an unsupported record format. No sample records have been substituted.",
        );
      return { rows: parsed.data, total: count };
    },
  });
}
