# Persistent sign-in and session expiry

Prepared locally. Nothing here has been installed against the live project.

| Account access | Maximum since sign-in | Inactivity |
| --- | --- | --- |
| Homeowner/renter only | 30 days | 7 days |
| Admin, Board, Security, Driver, Developer, or association-level access grant | 12 hours | 30 minutes |

The stricter policy follows the actual server membership/access assignments,
including extra roles, even when the user opens the resident workspace. Unknown
or inactive memberships receive the stricter timeout without gaining any access.

## Owner rollout order

1. Review and run migration `202611130072_persistent_sessions.sql` after 071.
   This adds an activity table, a caller-only status RPC, a Data API security hook
   and a restrictive session policy for Storage buckets prefixed `bfe-`.
   It aborts if another Data API hook is configured, rather than overwriting it.
   If it aborts, retain the existing hook and arrange reviewed chaining before
   continuing. Do not deploy the new frontend without this migration.
2. Redeploy `bfe-create-account` using its canonical function source or the
   regenerated `docs/setup/bfe-create-account.editor.txt`. It now checks the
   caller's portal session before service-role account creation/deletion.
   The standard Supabase `SUPABASE_ANON_KEY` environment variable must exist.
3. Publish the matching frontend through the normal owner release workflow.
   Neither commit, push nor deployment has been performed by Codex.
4. Verify all flows below. Some older idle sessions will need one fresh sign-in.

No modification of Supabase-managed Auth tables or token lifetime is required.
Keep JWT expiry near the existing one-hour default and automatic token refresh
enabled. This custom policy enforces portal access without relying on the Pro
plan's project-wide session-limit settings; it does not revoke refresh tokens
inside Supabase Auth or change other applications using the project.

## Behavior

Only authentication storage moves to localStorage. Existing tab sessions migrate
once; a migration marker prevents old tab credentials from reappearing after a
shared sign-out. If persistent storage is blocked, tab storage or memory is used;
browser restarts cannot be remembered in those restricted environments. Preview
records/drafts remain tab-only. Passwords are never stored by this implementation.

On reopening, the browser verifies the user and server session before exposing
membership. Trusted foreground input and returning to a visible tab may update
activity, throttled to about once per minute. Background polling and token
refresh do not update it. Session checks fail closed during a connection failure,
show retry UI and retain saved credentials. Server-confirmed expiry clears the
view and caches and attempts local Supabase sign-out, shared across browser tabs.
Explicit sign-out ends this browser session; other devices remain signed in.

The server uses Auth's session UUID, start time, server clock and native
`not_after`, if present. It checks the timeout before accepting activity; an
expired session cannot revive itself. New credentials are required to obtain a
new session UUID. Data API calls are guarded before RPCs/tables, Storage policies
guard new `bfe-` object requests, and the account Edge function separately checks
the caller before elevated operations. No application Realtime channels exist
in this checkout; future Realtime or additional Edge functions require the same
review. Existing signed file URLs remain usable until their own short expiry.

Inactivity represents portal foreground interaction, not token refresh frequency.
As with any session heartbeat, an authorized client can deliberately send an
activity request; this cannot prove a human is present. Absolute expiry remains
server-owned. Persistent tokens in a browser SPA are JavaScript-readable; retain
the existing CSP and XSS protections. An HttpOnly-cookie architecture would be
a separate backend architecture change.

## Verification and limits

Source reviewed, frontend TypeScript, targeted ESLint, production build,
formatting and `git diff --check` are checked locally. No automated suite,
browser/E2E run, live Auth connection or SQL execution is authorized/performed.
Deno is unavailable locally, so the Edge runtime has not been typechecked/run.
Do not treat compilation as proof that live expiration enforcement is installed.

Owner checks on a staging project first:

- Verify migration creates the hook and Storage policy without replacing an
  existing hook. Confirm anon registration and password recovery still work.
- Sign in as resident; close/reopen the browser and installed PWA on the same
  origin; confirm restored account and no unnecessary sign-in screen.
- Open two tabs, sign out in one, confirm both clear identity/private data.
- Use a controlled staging session to verify idle and absolute boundaries,
  including idle background polling, token refresh and browser clock changes.
  Do not shorten production timeouts or alter live user sessions for testing.
- Confirm a mixed resident/staff account receives the shorter policy; switching
  workspace does not extend it. Expired requests must fail at the Data API,
  Storage and account Edge function, not merely hide frontend controls.
- Disconnect/reconnect: verify retry view, no saved-token deletion for network
  errors, and no restoration of expired access. Verify signed URLs' short expiry.
- Confirm protected account creation/deletion, uploads, sign-in, reset password,
  preview isolation, tab migration and blocked-storage fallback.

Official references: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
and [Data API pre-request limitations](https://supabase.com/docs/guides/api/securing-your-api).
