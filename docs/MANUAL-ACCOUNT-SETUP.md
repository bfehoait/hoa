# Manual account creation

Prepared locally on 9 November 2026. The owner subsequently reported that manual creation works after applying 025 and deploying the function. Codex has not connected to the live database or performed deployment.

The existing developer People & accounts screen and office member directory share one **Create account** form. It collects name, email, role, household address when applicable, initial password and reason. No invitation or confirmation email is requested. Staff must verify the person's identity and email through their own onboarding process before issuing credentials.

## What you need to do later

### Browser editor alternative (no terminal login)

You can deploy from the already signed-in Supabase dashboard instead of using the CLI below:

1. Open **Edge Functions > Deploy a new function > Via Editor**.
2. Replace all of the example `index.ts` content with the entire contents of [bfe-create-account.editor.txt](setup/bfe-create-account.editor.txt). This generated file includes the shared validator and pinned npm imports, so no additional editor files are needed. Do not paste the SQL migration here.
3. Set **Function name** to exactly `bfe-create-account` and choose **Deploy function**.
4. In that function's configuration, turn off **Verify JWT with legacy secret** if it is enabled, and save. The function itself validates the caller's session and database authority.
5. No custom secret is needed for the known demo origins. The function defaults to `http://127.0.0.1:5173`, `http://localhost:5173`, `https://behoademo.hoa-system.com` and `https://bfehoa.vercel.app`. The latter is the request origin shown by the owner's embedded portal console on 12 November. For different addresses, an authorized project administrator can optionally set `BFE_ACCOUNT_ALLOWED_ORIGINS` to an exact comma-separated origin list; it replaces those defaults. If that override already exists, include the Vercel origin there as well. Do not add service keys to the source code; the hosted runtime supplies its server environment.
6. Refresh the app and follow the manual verification steps below. Deployment success alone does not confirm account creation works.

To refresh the generated editor file after changing the canonical function, shared schema or runtime import map, run `node scripts/prepare-manual-account-editor.mjs`. Edit those canonical sources rather than the generated artifact.

### Database preparation and CLI deployment

1. **Review the existing database triggers first.** Run [verify-manual-account-setup.sql](../scripts/verify-manual-account-setup.sql) in the intended project's SQL Editor. It returns trigger metadata and installation flags, not member data. Existing legacy triggers are not present in this repository. If a trigger on `auth.users` already inserts members, or a member INSERT guard requires additional fields, review its function before installing this workflow. Do not disable guards or delete records to make account creation succeed. The prepared linking trigger deliberately refuses existing member records. No deployed compatibility is claimed yet.

2. **Apply migration 025 once**, after the already applied migrations through 024: [202611090025_manual_account_creation.sql](../supabase/migrations/202611090025_manual_account_creation.sql). Run the entire file in SQL Editor, including BEGIN and COMMIT. This creates functions, a receipt table and a deferred Auth trigger; it creates no accounts. Re-run the inspection script afterward and check that the installation flags are true. Do not re-run older function-replacing migrations out of order.

3. **Deploy the Edge Function to that same Supabase project.** From the project root in PowerShell, with Supabase CLI available:

   ```powershell
   supabase login
   $accountProjectRef = Read-Host 'Supabase project reference'
   supabase functions deploy bfe-create-account --project-ref $accountProjectRef --no-verify-jwt
   ```

   The known demo and local origins work without setting custom secrets. For other origins, use exact origins without paths or trailing slashes in the optional environment override. The function independently verifies the session token using `auth.getUser(token)` and rechecks database authority. `--no-verify-jwt` disables only the gateway's legacy JWT check; it does not bypass those application checks. Keep the function's `deno.json` import map when deploying. Supabase-hosted functions provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server; never copy a privileged key into `.env.local`, a VITE variable, the browser or this repository. [Supabase session validation](https://supabase.com/docs/reference/javascript/auth-getuser), [server-only account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

4. **Use the locally edited frontend**, or deploy it through your normal release process when ready. A database migration alone does not update the production UI. Open People & accounts, choose Create account and submit a new account. Before the migration is installed, the button opens a setup-needed message rather than creating a local sample account.

5. **Check the result yourself.** Confirm the new member appears once, Manage access opens the same account, and the person can sign in with the issued password. In a separate session, confirm a resident cannot create accounts or invoke the function successfully. Confirm a duplicate email is refused and the existing account/password remains unchanged. Use an isolated test project and clearly labelled synthetic identities for trial accounts, not real residents as test fixtures. Verify the assigned role cannot enter office/developer screens without the required authority.

6. Share the credentials privately. The member can choose **Profile → Change password** while signed in; this uses the existing password update screen and does not require an email. Successful password updates sign them out, so they sign back in with their new password. A first-login password change is **not enforced** in this implementation. Supabase password-security or reauthentication settings can still require an additional step; those project settings have not been inspected.

## Authority and behavior

- Active developers can create the six operational roles. The form cannot create developers or a new super-admin role.
- An office admin must already have delegated access management plus `people/view/association` and `people/create/association`. Merely being an admin or seeing the page does not permit creation. The new role's effective capabilities are compared with the manager's authority, following migration 014's delegation ceiling.
- No additional roles, committee permissions, lot approvals or finance links are assigned. A recorded address is not verified property ownership. New accounts receive existing role defaults; some staff roles need explicit permissions afterward.
- Auth Admin creates the sign-in user. A deferred database trigger reads the final server-owned app metadata and inserts its linked Active member, receipt and audit within the same transaction. This accounts for Auth writing app metadata/confirmation after its initial user INSERT. If the link or authority checks fail, that transaction is rejected. Existing Auth/member triggers must be checked as described above. [Auth Admin implementation](https://github.com/supabase/auth/blob/master/internal/api/admin.go).
- The browser sends no actor ID. The function derives it from a verified session. Actor, reason, role and request reference are recorded server-side; the password is not included in application audits or receipts.
- The server accepts at most five successful creations per actor per minute. Duplicate emails and member records are rejected; the flow never claims an existing member or changes an existing password.
- A request ID makes the same submitted form retryable. After submission the form locks the details. If a response is uncertain, check the directory before starting another form. A confirmed receipt returns success without creating another user. Closing the form does not undo a committed account.
- No password is stored in local/session storage or application logs. The entered password stays in form memory until success or closing. Avoid sharing screenshots of filled forms or enabling request-body logging in infrastructure.

## Account deletion (new setup required)

The owner confirmed creation works before requesting deletion. Deletion is prepared locally and is not yet confirmed live.

1. Apply [migration 026](../supabase/migrations/202611090026_account_deletion.sql) once after 025 in SQL Editor. It creates no deletions by itself. Do not re-run 025.
2. Open the **existing `bfe-create-account` function**, replace its code with the newly regenerated [editor file](setup/bfe-create-account.editor.txt), and deploy the update. Keep its endpoint name unchanged and the legacy gateway JWT setting off. The same verified-session function handles both operations; no second function or custom secret is needed.
3. Refresh the locally edited app. Open a member's **Manage access > Role & status > Delete account**. Enter the exact member name and a reason, then choose Delete account permanently. The deployed website also needs the frontend changes published through your usual release process.
4. Verify in an isolated project with a clearly labelled synthetic account: an unused account is removed from Auth and Members; a self-delete, developer deletion, unauthorized call, changed member snapshot and account with linked records are rejected. A successful creation check does not verify deletion.

Active developers may delete other non-developer accounts. An admin needs active delegated access management and `people/view/association` plus `people/manage/association`, and cannot delete another active access manager or exceed their own authority. Developer accounts are protected even when suspended. Self-deletion is never offered or accepted.

The deletion uses the supported Auth Admin `deleteUser` API. A short-lived, service-only approval identifies the verified actor and expected member snapshot. A BEFORE DELETE trigger rechecks them, inspects installed foreign keys to Auth and Members (including cascading relationships), and refuses removal when operational records or storage ownership would be affected. The trigger removes only the member entry, profile preferences, recipient notifications and individual tab rules inside the Auth deletion transaction; audits and completed receipts are retained. Existing inspection history, lot memberships, access assignments, bookings or requests can therefore block deletion. Use **Suspended** when history must be retained. Legacy relationships without database foreign keys require owner review and are not inferred from matching names, addresses or emails. [Supabase deletion API](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).

A deletion approval expires after ten minutes and must be reopened if expired. Changing the role, status, name or unit after confirmation invalidates the snapshot. A repeated completed request returns its receipt without targeting any replacement account. If confirmation is uncertain, refresh the directory before retrying; closing the form does not undo a completed deletion.

Auth access tokens may remain valid until expiry after deletion; the application's membership-based RPCs must continue checking the live member record. No claim is made that all external services invalidate tokens immediately. Existing project policies, triggers and Storage behavior still need owner verification. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

## Validation and remaining checks

`npx.cmd tsc --noEmit --incremental false` passed for the frontend/shared schema. Migration 025 compiled in an isolated PGlite database with stub dependencies; this was a syntax check, not a live Auth workflow check. The Edge source passed a separate TypeScript compiler check using a minimal declaration for `Deno.env.get` and `Deno.serve` and the installed SDK. Native Deno is not installed here, so Deno package resolution, function deployment, Auth-trigger ordering on the deployed version, email-free sign-in, password changes and browser interaction remain for owner verification. No test suites, E2E or live database connection were run.

When Deno is available, run `deno check --config supabase/functions/bfe-create-account/deno.json supabase/functions/bfe-create-account/index.ts` before deployment. This resolves the pinned runtime imports; the frontend typecheck does not cover the Edge runtime.
# Session policy dependency (migration 072)

The current account Edge function also requires migration 072 before deployment.
It checks the caller's portal session before creating or deleting accounts.
Use the rollout order in [Persistent sessions](PERSISTENT-SESSIONS.md).
The generated dashboard editor artifact includes this check.
