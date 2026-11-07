import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ownProfileSchema,
  notificationsSchema,
  profilePreferencesSchema,
  type AppNotification,
  type ProfilePreferences,
} from "../../../../packages/shared/src/accounts";
import { makeClient, useAuth } from "./auth";

function serviceError(error: { code?: string } | null) {
  if (!error) return;
  throw new Error(
    ["PGRST202", "42883", "42P01"].includes(error.code ?? "")
      ? "Account services need database migration 004. No sample data replaces your account records."
      : error.code === "42501"
        ? "Your account is not allowed to perform this action. Refresh access."
        : "The operation could not be confirmed. Refresh and try again.",
  );
}
function sampleNotifications(scope: string): AppNotification[] {
  const key = `bellefort-account-samples:${scope}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return notificationsSchema.shape.rows.parse(JSON.parse(raw));
  } catch {
    /* Synthetic tab storage is optional. */
  }
  const now = Date.now();
  const at = (offset: number) => new Date(now - offset).toISOString();
  const rows: AppNotification[] = [
    {
      id: "41000000-0000-4000-8000-000000000001",
      kind: "request",
      title: "Sample request update",
      body: "An invented request is ready for review.",
      path: "/services/requests",
      created_at: at(10 * 60000),
      read_at: null,
    },
    {
      id: "41000000-0000-4000-8000-000000000002",
      kind: "account",
      title: "Sample profile saved",
      body: "An invented account activity for this preview.",
      path: "/more/profile",
      created_at: at(60 * 60000),
      read_at: at(30 * 60000),
    },
    {
      id: "41000000-0000-4000-8000-000000000003",
      kind: "community",
      title: "Sample community reminder",
      body: "Synthetic notification. No message was delivered.",
      path: "/more/notifications",
      created_at: at(3 * 86400000),
      read_at: at(2 * 86400000),
    },
  ];
  try {
    sessionStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* Optional. */
  }
  return rows;
}
export function useOwnProfile() {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  return useQuery({
    queryKey: ["account", auth.userId, auth.rolePreview, "profile"],
    enabled:
      sample ||
      (!!auth.userId && !!auth.member && !auth.checking && !auth.memberError),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      if (sample)
        return ownProfileSchema.parse({
          display_name: auth.member?.name ?? "Sample resident",
          phone: "",
          bio: "Synthetic profile preferences.",
          updated_at: null,
        });
      const client = makeClient();
      if (!client) throw new Error("Sign-in is required.");
      const { data, error } = await client
        .rpc("bfe_get_profile")
        .abortSignal(signal);
      serviceError(error);
      return ownProfileSchema.parse(data);
    },
  });
}
export function useNotifications(page = 0, unreadOnly = false) {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  return useQuery({
    queryKey: [
      "account",
      auth.userId,
      auth.rolePreview,
      "notifications",
      page,
      unreadOnly,
    ],
    enabled:
      sample ||
      (!!auth.userId && !!auth.member && !auth.checking && !auth.memberError),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      if (sample) {
        const all = sampleNotifications(auth.rolePreview ?? "local");
        const rows = all.filter((n) => !unreadOnly || !n.read_at);
        return {
          rows: rows.slice(page * 20, page * 20 + 20),
          total: rows.length,
          unread: all.filter((n) => !n.read_at).length,
        };
      }
      const client = makeClient();
      if (!client) throw new Error("Sign-in is required.");
      const { data, error } = await client
        .rpc("bfe_my_notifications", {
          p_page: page,
          p_unread_only: unreadOnly,
        })
        .abortSignal(signal);
      serviceError(error);
      return notificationsSchema.parse(data);
    },
  });
}
export function useAccountActions() {
  const auth = useAuth();
  const cache = useQueryClient();
  const sample = auth.preview || !!auth.rolePreview;
  const invalidate = () => {
    void cache.invalidateQueries({ queryKey: ["account", auth.userId] });
  };
  const saveProfile = useMutation({
    mutationFn: async (input: ProfilePreferences) => {
      if (sample)
        throw new Error("Exit role preview to update your real account.");
      const parsed = profilePreferencesSchema.parse(input);
      const client = makeClient();
      if (!client || !auth.userId || auth.checking || auth.memberError)
        throw new Error("Verified sign-in is required.");
      const { data, error } = await client.rpc("bfe_save_profile", {
        p_display_name: parsed.display_name,
        p_phone: parsed.phone,
        p_bio: parsed.bio,
      });
      serviceError(error);
      return ownProfileSchema.parse(data);
    },
    onSuccess: invalidate,
  });
  const markRead = useMutation({
    mutationFn: async (ids: string[] | null) => {
      if (sample) {
        const scope = auth.rolePreview ?? "local";
        const rows = sampleNotifications(scope).map((n) =>
          !ids || ids.includes(n.id)
            ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
            : n,
        );
        try {
          sessionStorage.setItem(
            `bellefort-account-samples:${scope}`,
            JSON.stringify(rows),
          );
        } catch {
          /* No real delivery. */
        }
        return;
      }
      const client = makeClient();
      if (!client || !auth.userId || auth.checking || auth.memberError)
        throw new Error("Verified sign-in is required.");
      const { error } = await client.rpc("bfe_mark_notifications", {
        p_ids: ids,
      });
      serviceError(error);
    },
    onSuccess: invalidate,
  });
  return { saveProfile, markRead };
}
