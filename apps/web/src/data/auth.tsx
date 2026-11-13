import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  memberSchema,
  type AuthMember,
  type PreviewRole,
  previewMember,
} from "../../../../packages/shared/src/auth";
import { authConfig } from "./auth-config";
import { readOnlyPreviewClient } from "./account-preview-client";
import { authStorage, authStorageKey } from "./auth-storage";
import {
  readSessionPolicy,
  SessionExpiredError,
  useSessionActivity,
} from "./session-policy";

function hasStoredSession() {
  return !!authStorage.getItem(authStorageKey);
}
function clearSampleDrafts() {
  for (const key of [
    "bellefort-preview-v1",
    "bellefort-workspace-v1",
    "bellefort-preview-entry",
    "bellefort-request-samples-v1",
  ])
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Preview storage unavailable. */
    }
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (
        key?.startsWith("bellefort-role-preview:") ||
        key?.startsWith("bellefort-account-samples:")
      )
        sessionStorage.removeItem(key);
    }
  } catch {
    /* Storage may be unavailable. */
  }
}
let singleton: SupabaseClient | null = null;
export function makeRealClient() {
  if (!authConfig.settings) return null;
  singleton ??= createClient(authConfig.settings.url, authConfig.settings.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: authStorage,
      storageKey: authStorageKey,
    },
  });
  return singleton;
}
export function makeClient() {
  const client = makeRealClient();
  return client ? readOnlyPreviewClient(client) : null;
}
type AuthState = {
  memberPreview?: boolean;
  preview: boolean;
  rolePreview: PreviewRole | null;
  configured: boolean;
  checking: boolean;
  userId: string | null;
  accountEmail: string | null;
  verifiedAt: number | null;
  member: AuthMember | null;
  memberPending: boolean;
  memberError: Error | null;
  identityError: boolean;
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  recover: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  retry: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeRealClient);
  const cache = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(!!client);
  const [identityError, setIdentityError] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [revision, setRevision] = useState(0);
  const previousUser = useRef<string | null>(null);
  const failureTimer = useRef<number | null>(null);
  const expireSession = useCallback(() => {
    setUserId(null);
    setAccountEmail(null);
    setSession(null);
    setVerifiedAt(null);
    setChecking(false);
    setRecovering(false);
    setIdentityError(false);
    previousUser.current = null;
    clearSampleDrafts();
    void cache.cancelQueries().then(() => cache.clear());
    // Supabase removes the shared persisted session and broadcasts SIGNED_OUT.
    // Server enforcement already rejects an expired bearer token.
    void client?.auth
      .signOut({ scope: "local" })
      .then(({ error }) => {
        if (error) authStorage.removeItem(authStorageKey);
      })
      .catch(() => authStorage.removeItem(authStorageKey));
  }, [client, cache]);
  const sessionUnavailable = useCallback(() => setIdentityError(true), []);
  const sessionVerified = useCallback(() => setIdentityError(false), []);
  useSessionActivity(
    client,
    userId,
    expireSession,
    sessionUnavailable,
    sessionVerified,
  );
  useEffect(() => {
    // Backup for browser environments without Supabase BroadcastChannel support.
    const changed = (event: StorageEvent) => {
      if (
        (event.key === authStorageKey || event.key === null) &&
        !authStorage.getItem(authStorageKey)
      ) {
        setUserId(null);
        setAccountEmail(null);
        setSession(null);
        setChecking(false);
        setIdentityError(false);
        setRecovering(false);
        previousUser.current = null;
        clearSampleDrafts();
        void cache.cancelQueries().then(() => cache.clear());
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [cache]);

  useEffect(() => {
    if (!client) return;
    // Keep this callback synchronous: awaiting another Auth call here can deadlock.
    const { data } = client.auth.onAuthStateChange((event, next) => {
      // A routine token refresh, or a re-emitted sign-in for the account that
      // is already verified, must not drop the app back to "Checking…". Only a
      // different user, the first load, or a sign-out resets the verified view.
      // The getUser() verification below still runs on the session change.
      const nextUser = next?.user?.id ?? null;
      const sameUser = nextUser !== null && nextUser === previousUser.current;
      if (!sameUser) {
        setChecking(!!next);
        setUserId(null);
        setAccountEmail(null);
      }
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        previousUser.current = null;
        setVerifiedAt(null);
        setRecovering(false);
        setIdentityError(false);
        clearSampleDrafts();
        void cache.cancelQueries().then(() => cache.clear());
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client, cache]);

  useEffect(() => {
    if (!client || session === undefined) return;
    let live = true;
    if (!session) return;
    // On reload the stored access token is frequently expired, so getUser()
    // fails for a moment before the client's automatic refresh emits a fresh
    // session. Bouncing to /sign-in in that window is the flash the owner saw.
    // While a stored session is still present we keep showing the loader; a
    // TOKEN_REFRESHED or SIGNED_OUT event resolves it, and a bounded fallback
    // surfaces a genuine failure so the loader can never hang.
    const settleFailure = () => {
      if (!live) return;
      setIdentityError(true);
      setUserId(null);
      cache.removeQueries({ queryKey: ["auth-member"] });
      setChecking(false);
    };
    const deferOrFail = () => {
      if (!live) return;
      if (hasStoredSession()) {
        if (failureTimer.current) clearTimeout(failureTimer.current);
        failureTimer.current = window.setTimeout(settleFailure, 10000);
        return;
      }
      settleFailure();
    };
    void client.auth
      .getUser()
      .then(async ({ data, error }) => {
        if (!live) return;
        if (error || !data.user || data.user.id !== session.user.id) {
          deferOrFail();
          return;
        }
        try {
          // Only first verification/resume counts as activity, not token refresh.
          await readSessionPolicy(
            client,
            previousUser.current !== data.user.id,
          );
        } catch (cause) {
          if (!live) return;
          if (cause instanceof SessionExpiredError) expireSession();
          else settleFailure();
          return;
        }
        if (!live) return;
        if (previousUser.current && previousUser.current !== data.user.id)
          cache.clear();
        previousUser.current = data.user.id;
        setIdentityError(false);
        setUserId(data.user.id);
        setAccountEmail(data.user.email ?? null);
        setVerifiedAt(Date.now());
        setChecking(false);
      })
      .catch(deferOrFail);
    return () => {
      live = false;
      if (failureTimer.current) {
        clearTimeout(failureTimer.current);
        failureTimer.current = null;
      }
    };
  }, [client, session, revision, cache, expireSession]);

  const membership = useQuery({
    queryKey: ["auth-member", userId],
    enabled: !!client && !!userId,
    queryFn: async ({ signal }) => {
      const own = await client!.rpc("bfe_get_member").abortSignal(signal);
      const response =
        own.error && ["PGRST202", "42883"].includes(own.error.code)
          ? await client!
              .from("members")
              .select(
                "id,user_id,name,unit,role,extra_roles,status,title,phone",
              )
              .eq("user_id", userId!)
              .abortSignal(signal)
              .maybeSingle()
          : own;
      const { data, error } = response;
      if (error)
        throw new Error(
          "We could not verify your membership. Please retry or contact the office.",
        );
      if (!data) return null;
      const parsed = memberSchema.safeParse(data);
      if (!parsed.success || parsed.data.user_id !== userId)
        throw new Error("Your member record needs an office review.");
      return parsed.data;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 60_000,
  });
  const member =
    userId && !membership.isError ? (membership.data ?? null) : null;
  function requireClient() {
    if (!client) throw new Error("Sign-in is not configured yet.");
    return client;
  }
  async function signIn(email: string, password: string) {
    const { error } = await requireClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      throw new Error(
        error.status === 429
          ? "Too many attempts. Please wait before trying again."
          : "Sign-in failed. Check your email and password, then try again.",
      );
  }
  async function signOut() {
    const { error } = await requireClient().auth.signOut({ scope: "local" });
    if (error)
      throw new Error("We could not finish signing out. Please retry.");
    await cache.cancelQueries();
    cache.clear();
    // Remove synthetic drafts so one account does not inherit another's tab edits.
    clearSampleDrafts();
    setUserId(null);
    setSession(null);
    setIdentityError(false);
    setRecovering(false);
    setChecking(false);
    previousUser.current = null;
  }
  async function recover(email: string) {
    const { error } = await requireClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error)
      throw new Error(
        error.status === 429
          ? "Please wait before requesting another recovery email."
          : "We could not request recovery. Please try again later.",
      );
  }
  async function updatePassword(password: string) {
    const { error } = await requireClient().auth.updateUser({ password });
    if (error)
      throw new Error(
        "The password could not be updated. Check the password requirements or request a fresh recovery link.",
      );
    setRecovering(false);
  }
  const value: AuthState = {
    preview: authConfig.mode === "preview",
    rolePreview: null,
    configured: !!client,
    checking,
    userId,
    accountEmail,
    verifiedAt,
    member,
    memberPending: !!userId && membership.isPending,
    memberError: membership.error,
    identityError,
    recovering,
    signIn,
    signOut,
    recover,
    updatePassword,
    retry: () => {
      setRevision((value) => value + 1);
      if (userId) void membership.refetch();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}
export function AccountPreviewIdentity({
  member,
  children,
}: {
  member: AuthMember;
  children: ReactNode;
}) {
  const real = useAuth();
  const blocked = async () => {
    throw new Error(
      "Account actions are disabled in read-only account preview.",
    );
  };
  return (
    <AuthContext.Provider
      value={{
        ...real,
        member,
        memberPreview: true,
        userId: member.user_id,
        accountEmail: null,
        preview: false,
        rolePreview: null,
        signIn: blocked,
        signOut: blocked,
        recover: blocked,
        updatePassword: blocked,
        retry: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
// Only mount beneath the real developer gate. Account-changing APIs are never
// available through a synthetic role, and private Auth cache stays outside it.
export function RolePreviewIdentity({
  role,
  children,
}: {
  role: PreviewRole;
  children: ReactNode;
}) {
  const real = useAuth();
  const blocked = async () => {
    throw new Error(
      "Account changes are unavailable in role preview. Exit preview first.",
    );
  };
  return (
    <AuthContext.Provider
      value={{
        ...real,
        preview: false,
        rolePreview: role,
        member: previewMember(role),
        userId: previewMember(role).user_id,
        accountEmail: null,
        verifiedAt: null,
        checking: false,
        memberPending: false,
        memberError: null,
        identityError: false,
        recovering: false,
        signIn: blocked,
        signOut: blocked,
        recover: blocked,
        updatePassword: blocked,
        retry: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
