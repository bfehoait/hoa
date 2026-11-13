import { createClient } from "@supabase/supabase-js";
import {
  manualAccountSchema,
  deleteAccountSchema,
} from "../../../packages/shared/src/manual-accounts.ts";

// Creation requires 025; deletion also requires 026. Review legacy triggers.
// Never log requests, passwords, tokens, Auth errors or account details.
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  // Public website origins need no custom secret for the known demo setup.
  // An environment override replaces these exact defaults for other sites.
  const allowed = (
    Deno.env.get("BFE_ACCOUNT_ALLOWED_ORIGINS") ??
    "http://127.0.0.1:5173,http://localhost:5173,https://behoademo.hoa-system.com,https://bfehoa.vercel.app"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...(allowed.includes(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!origin || !allowed.includes(origin))
    return reply(403, {
      message: "This site is not enabled for account creation.",
    });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply(405, { message: "Use the account creation form." });
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token)
    return reply(401, { message: "Sign in again before creating an account." });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    return reply(503, { message: "Account creation is not configured yet." });
  try {
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: identityError } =
      await admin.auth.getUser(token);
    if (identityError || !identity.user || identity.user.is_anonymous)
      return reply(401, {
        message: "Sign in again before creating an account.",
      });
    // Service-role account operations must first validate the caller's portal
    // session using their JWT. getUser alone does not enforce our role timeouts.
    const browserKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!browserKey)
      return reply(503, {
        message: "Account service is temporarily unavailable.",
      });
    const caller = createClient(url, browserKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const policy = await caller.rpc("bfe_session_status", { p_touch: false });
    if (policy.error?.code === "PT401")
      return reply(401, {
        message: "Your session expired. Please sign in again.",
      });
    if (policy.error)
      return reply(503, {
        message: "We could not verify your session. Please retry.",
      });
    if (policy.data?.valid !== true)
      return reply(401, {
        message: "Your session expired. Please sign in again.",
      });
    if (Number(request.headers.get("Content-Length")) > 8192)
      return reply(413, { message: "Account details are too long." });
    const text = await request.text();
    if (text.length > 8192)
      return reply(413, { message: "Account details are too long." });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { message: "Check the account details." });
    }
    if (
      typeof body === "object" &&
      body !== null &&
      "operation" in body &&
      body.operation === "delete"
    ) {
      const deletion = deleteAccountSchema.safeParse(body);
      if (!deletion.success)
        return reply(400, {
          message: "Confirm the member name and enter a reason.",
        });
      const input = deletion.data;
      const args = {
        p_actor: identity.user.id,
        p_target: input.userId,
        p_request: input.requestId,
        p_expected: input.expected,
        p_confirmation: input.confirmation,
        p_reason: input.reason,
      };
      const prepared = await admin.rpc("bfe_prepare_account_deletion", args);
      if (prepared.error)
        return reply(prepared.error.code === "42501" ? 403 : 409, {
          message:
            prepared.error.code === "42501"
              ? "You cannot delete this account. Your own account and developer accounts are protected."
              : prepared.error.code === "40001"
                ? "The account changed. Close and reopen its settings before deleting."
                : "Deletion could not be prepared. Refresh the member and check that database update 026 is installed.",
        });
      if (prepared.data?.deleted) return reply(200, { deleted: true });
      const removed = await admin.auth.admin.deleteUser(input.userId);
      // Receipt is committed by the same Auth deletion transaction. A retry
      // must never act on a replacement account that happens to share an email.
      const confirmed = await admin.rpc("bfe_prepare_account_deletion", args);
      if (!confirmed.error && confirmed.data?.deleted)
        return reply(200, { deleted: true });
      return reply(removed.error ? 409 : 503, {
        message:
          "Deletion was not confirmed. Linked records or uploaded files may prevent removal. Refresh the directory; use Suspended to block access while retaining records.",
      });
    }
    const parsed = manualAccountSchema.safeParse(body);
    if (!parsed.success)
      return reply(400, {
        message: "Check the name, email, role, address, password and reason.",
      });
    const input = parsed.data;
    const preflight = () =>
      admin.rpc("bfe_manual_account_preflight", {
        p_actor: identity.user.id,
        p_request: input.requestId,
        p_email: input.email,
      });
    const check = await preflight();
    const fail = (code?: string) =>
      reply(code === "42501" ? 403 : code === "23505" ? 409 : 503, {
        message:
          code === "42501"
            ? "Your current permissions do not allow account creation."
            : code === "23505"
              ? "This email already has an account or member record. Review it in People & accounts."
              : "Account creation could not be verified. Check the setup before trying again.",
      });
    if (check.error) return fail(check.error.code);
    if (check.data?.created) return reply(200, { created: true });
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      // Staff-issued credentials: no verification/invitation email is sent.
      email_confirm: true,
      app_metadata: {
        bfe_manual_account: {
          actor_id: identity.user.id,
          request_id: input.requestId,
          registration_id: input.registrationId ?? null,
          name: input.name,
          unit: input.unit,
          role: input.role,
          reason: input.reason,
        },
      },
    });
    // A response may be lost after a commit or race with a repeated request.
    // Never reset a password or overwrite an account to make a retry succeed.
    const confirmed = await preflight();
    if (!confirmed.error && confirmed.data?.created)
      return reply(200, { created: true });
    if (error)
      return reply(error.code === "email_exists" ? 409 : 400, {
        message:
          error.code === "email_exists"
            ? "This email already has an account. Review the existing account."
            : "Account creation was not confirmed. Check the directory before retrying. The account may conflict with an existing record or exceed your authority.",
      });
    // Missing receipt is never reported as success, even if Auth returned a UID.
    return reply(503, {
      message: data.user
        ? "Sign-in account returned without a confirmed member link. Ask the system owner to check the account before retrying."
        : "Account creation was not confirmed. Check the directory before retrying.",
    });
  } catch {
    return reply(503, {
      message:
        "Account creation could not be confirmed. Check the directory before retrying.",
    });
  }
});
