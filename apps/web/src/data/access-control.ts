import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth, makeClient } from "./auth";
import { memberRoles } from "../../../../packages/shared/src/auth";
import { usePermissions } from "./permissions";
const accessMemberSchema = z.object({
  user_id: z.uuid(),
  name: z.string().nullable(),
  unit: z.string().nullable(),
  role: z.string(),
  extra_roles: z.array(z.string()).nullable(),
  status: z.string(),
});
export type AccessMember = z.infer<typeof accessMemberSchema>;
const assignmentsSchema = z.array(
  z.object({
    id: z.uuid(),
    committee_id: z.string(),
    expires_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
    grants: z.number().int(),
  }),
);
async function controlCall(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const client = makeClient();
  if (!client) throw new Error("Sign-in is required.");
  const { data, error } = await client
    .rpc(name, args)
    .abortSignal(signal ?? new AbortController().signal);
  if (error)
    throw new Error(
      error.code === "40001"
        ? "This member changed. Reload the account before saving."
        : ["PGRST202", "42883"].includes(error.code)
          ? name === "bfe_filtered_access_members"
            ? "Role filtering needs database update 040. Choose All roles to use the existing search."
            : "Developer controls need database migration 004."
          : error.code === "42501"
            ? "Developer control was not authorized. Refresh your membership."
            : "The change could not be confirmed. Check the account and approval reference, then reload before retrying.",
    );
  return data;
}
export function useAccessMembers(search: string, page: number, role = "") {
  const auth = useAuth();
  const access = usePermissions();
  return useQuery({
    queryKey: ["access-control", auth.userId, "members", search, page, role],
    enabled:
      !auth.preview &&
      !auth.rolePreview &&
      !!auth.member &&
      !auth.checking &&
      !auth.memberError &&
      (memberRoles(auth.member).includes("developer") ||
        !!access.data?.access_manager),
    gcTime: 300_000,
    retry: false,
    queryFn: async ({ signal }) =>
      z
        .object({
          rows: z.array(accessMemberSchema),
          total: z.number().int(),
          lookup_mode: z.enum(["email_exact", "name_unit"]).optional(),
        })
        .parse(
          await controlCall(
            role ? "bfe_filtered_access_members" : "bfe_access_members",
            {
              p_search: search,
              p_page: page,
              ...(role ? { p_role: role } : {}),
            },
            signal,
          ),
        ),
  });
}
export function useMemberAssignments(userId: string) {
  const auth = useAuth();
  return useQuery({
    queryKey: ["access-control", auth.userId, "assignments", userId],
    enabled: !!userId && !auth.preview && !auth.rolePreview,
    gcTime: 300_000,
    retry: false,
    queryFn: async ({ signal }) =>
      assignmentsSchema.parse(
        await controlCall(
          "bfe_member_assignments",
          { p_user_id: userId },
          signal,
        ),
      ),
  });
}
export type GrantInput = {
  userId: string;
  committee: string;
  module: string;
  action: string;
  scope: string;
  effect: string;
  reference: string;
};
export function useAccessControlActions() {
  const auth = useAuth();
  const access = usePermissions();
  const cache = useQueryClient();
  const ready = () => {
    if (
      auth.preview ||
      auth.rolePreview ||
      !auth.member ||
      auth.checking ||
      auth.memberError ||
      (!memberRoles(auth.member).includes("developer") &&
        !access.data?.access_manager)
    )
      throw new Error("Exit preview and verify your developer account first.");
  };
  const invalidate = () => {
    void cache.invalidateQueries({ queryKey: ["access-control", auth.userId] });
    void cache.invalidateQueries({ queryKey: ["permissions"] });
  };
  const grant = useMutation({
    mutationFn: async (input: GrantInput) => {
      ready();
      return controlCall("bfe_provision_access", {
        p_user_id: input.userId,
        p_committee: input.committee,
        p_module: input.module,
        p_action: input.action,
        p_scope: input.scope,
        p_effect: input.effect,
        p_reference: input.reference,
        p_expires: null,
      });
    },
    onSuccess: invalidate,
  });
  const roles = useMutation({
    mutationFn: async (input: {
      member: AccessMember;
      role: string;
      extra: string[];
      status: string;
      reference: string;
    }) => {
      ready();
      return controlCall("bfe_update_member_access", {
        p_user_id: input.member.user_id,
        p_role: input.role,
        p_extra: input.extra,
        p_status: input.status,
        p_reference: input.reference,
        p_expected: {
          role: input.member.role,
          extra_roles: input.member.extra_roles,
          status: input.member.status,
        },
      });
    },
    onSuccess: (_data, input) => {
      invalidate();
      if (input.member.user_id === auth.userId) auth.retry();
    },
  });
  const revoke = useMutation({
    mutationFn: async (input: { id: string; reference: string }) => {
      ready();
      return controlCall("bfe_revoke_assignment", {
        p_assignment_id: input.id,
        p_reference: input.reference,
      });
    },
    onSuccess: invalidate,
  });
  return { grant, roles, revoke };
}
