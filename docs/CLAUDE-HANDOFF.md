# Claude handoff — Bellefort Estate Portal

Updated: 6 November 2026, Asia/Manila.

You are continuing an existing local rebuild. Preserve completed work and the user's established preferences. This document is context, not authorization to deploy, connect to production or create accounts.

## 1. Read first

Read these in order, then inspect the relevant implementation before changing it:

1. Root AGENTS.md — mandatory project boundaries.
2. This handoff.
3. docs/UI-UX-FIX-LIST.md — screenshot requests, completed changes and follow-ups.
4. docs/UI-ACCESS-MEDIA-SETUP.md — current permissions, marketplace and booking behavior.
5. docs/ACCOUNT-PREVIEW.md — actual account preview and its restrictions.
6. docs/START-HERE.md — project history; older sections contain superseded instructions.
7. Relevant notes under docs/vault, particularly Architecture, User experience, Roles and permissions, Permission planning matrix, Connected workflows and Verification.
8. package.json, playwright.config.ts and the relevant shared schemas/source.

Prefer current code, dated verification notes and the latest user instructions over stale historical statements. Some older documents still say a migration is pending even though the owner subsequently reported installing it. Do not tell the owner to repeat successful migrations or imports.

## 2. Workspace and non-negotiable boundaries

- Workspace: D:\GHL\Bellefort Estate Portal
- Environment: Windows, PowerShell, Node/npm. User-facing dates/times use Asia/Manila.
- This is a separate rebuild. Never edit or connect to Kate's repository, Supabase or Vercel project.
- The reference exception permits static, read-only information extraction from reference/upstream-hoa only. Do not edit/push it, execute/import its code, copy its design/assets or connect to its backend. Preserve the dev-server denial and ignored raw source.
- Existing screenshots describe desired workflows and problems; they do not authorize copying reference implementation code or establishing official business policies.
- No commit, push, publication, deployment, live database connection or store submission without explicit authorization. The previous agent prepared code/SQL locally; the owner ran SQL manually.
- Ordinary reversible local edits and local tests within the requested task do not need repeated confirmation.
- Do not read, print or copy credentials, .env.local values, raw private imports, real resident data or authentication tokens. Use synthetic fixtures and mock APIs. Do not put names from the user's screenshots into tests or source.
- Keep unknown official rates, facilities, hours, fees and committee powers unavailable until supplied/approved. Do not invent them from reference screenshots.
- No resident control can confirm payments, grant roles, approve submissions or set election totals. Protected server operations own authority.
- A frontend role selector or local preview is not authentication or permission enforcement.
- Local sample saves must stay labelled synthetic/local; only an actual successful backend response may be described as server-confirmed.
- At handoff, Test-Path .git returned false. Do not assume there is a Git checkout, remote, branch or commit history here.

## 3. How to collaborate with the user

The user communicates through IDE context and screenshots, often sending several messages while work is ongoing.

- Treat screenshots and follow-ups as additions to the active task unless the user clearly cancels/replaces it.
- Keep a running list in docs/UI-UX-FIX-LIST.md. Explain what is completed, what needs setup, and what is still missing.
- Bias toward implementing the authorized work; do not stop at a plan or ask permission for routine local fixes.
- Give short progress updates before tools and during longer work. Explain findings and next checks plainly.
- Distinguish a real defect from a read-only preview restriction, an empty setup state, a missing permission or a monitoring-only page. Fix misleading UI rather than merely telling the user they clicked the wrong thing.
- Do not claim “everything is wired” or “production-ready” because migration verification passed.
- Finish with a concise summary: what changed, what was actually tested, any remaining setup, and whether new SQL is needed.
- If new SQL is genuinely necessary, give an additive numbered migration and exact owner instructions after local testing. Avoid repeated setup steps for already installed services.
- Do not send messages to other people/services, install plugins or use outside accounts unless specifically authorized.
- The current request is a handoff. Do not invent additional feature work from this document; continue with the user's next concrete request.

## 4. Stack and UI standards

Preserve:

- React 19 and TypeScript.
- React Router.
- TanStack Query for async server state and invalidation.
- Shared zod schemas under packages/shared.
- Plain CSS tokens and CSS Modules.
- Lucide icons and the established burgundy branding.

Do not introduce Tailwind, component kits, a replacement framework or copied reference assets.

UI requirements:

- Mobile first; 16px body and input text, secondary text at least 14px.
- Controls at least 48px, visible keyboard focus, useful labels, reduced motion and safe areas.
- Consistent shell and sidebar ordering. Preserve sidebar scroll on navigation.
- Clear loading, error, empty and permission states.
- Dialogs must retain focus management, scrolling bodies, close behavior and busy-state safeguards.
- Avoid technical implementation explanations in primary customer flows; put necessary detail in disclosures.
- Keep real data and synthetic preview data clearly distinguishable.

The ui-ux-pro-max skill was used as a review checklist. Its local SKILL.md is under C:/Users/User/.codex/skills/ui-ux-pro-max. Its search scripts were unavailable in this environment. Do not block work or install anything solely to use that skill; follow the existing design/accessibility standards.

## 5. Architecture and source map

### Shell, authentication and routing

- apps/web/src/main.tsx: providers and BrowserRouter basename.
- apps/web/src/App.tsx and App.module.css: shell, fixed sidebar, desktop/mobile layout and routes.
- apps/web/src/components/AccountNavigation.tsx: area navigation and permission-filtered links.
- apps/web/src/components/AccessLink.tsx: UI destination filtering.
- packages/shared/src/auth.ts: supported roles/workspaces and role-based route access.
- apps/web/src/data/auth.tsx: real Auth session and preview identities.
- apps/web/src/features/auth/AuthGate.tsx: authentication, membership and office module gates.
- apps/web/src/data/permissions.ts and packages/shared/src/permissions.ts: capabilities, tab modes and path visibility.

Developer/admin route access to /directory/market and /directory/learning was explicitly added so staff can use the marketplace workspace. This does not grant household account/finance routes or bypass backend permissions.

### Account preview

- features/developer/MemberAccountPicker.tsx: choose an existing member and start preview.
- features/developer/AccountInterfacePreview.tsx: target identity, expiry, banner and exit.
- data/account-preview-client.ts: read-only RPC proxy and allowlist.
- features/developer/RolePreview.tsx: separate synthetic role preview.

Actual account preview:

1. Developer remains logged in with their own Auth identity.
2. An audited support session lasts ten minutes.
3. A read-only gateway checks developer identity, target membership, session ownership/expiry and an explicit RPC allowlist.
4. It temporarily uses the target's database member context for approved STABLE reads, restores context on success/error, and records the real developer actor.
5. The existing portal screens run with the target's role/capabilities and isolated caches.
6. Writes, authentication/password actions, notification changes and uploads remain disabled.
7. No member notification is sent merely for opening the preview.
8. Exit ends the support session and returns to the developer member picker.

Do not revert this to the old inspection-record dashboard or require a support-reason popup. The user specifically requested the person's actual portal layout.

Preview is not screen sharing: viewport, device state and theme belong to the browser doing the preview. Real submissions require direct sign-in as a test user.

The preview banner's measured height is provided through --preview-banner-offset using ResizeObserver. App.module.css offsets the account-preview sidebar by it. Preserve this fix; a fixed sidebar otherwise covers the logo/navigation.

### Permissions

- features/developer/AccessPlanning.tsx: access page shared with authorized office managers.
- features/developer/TabAccess.tsx: user overrides and role/committee defaults.
- features/developer/AccessManager.tsx: existing roles, status, committee assignments and advanced action grants.
- data/access-control.ts: protected operations and query invalidation.

Modes are Inherit, Hidden, View only, Can edit. Scopes are own, approved, assigned, association.

- Existing baseline access stays in place until a custom rule is configured.
- Per-user rules override group rules.
- Among group rules, hidden takes priority; otherwise edit wins over view.
- Explicit action denials remain authoritative.
- Can edit includes viewing/summaries, creation, reply and status updates; approval, publication, export, assignment and management remain separate grants.
- Profile/support and developer recovery access are protected.
- Only developers appoint/remove permission managers.
- A designated active admin uses /office/access and cannot self-elevate, grant developer status, change protected developer accounts or grant beyond their authority.
- The server rejects stale rule saves.
- Committee defaults require an active, non-expired assignment.

Do not “fix” denied actions by removing server checks or granting every admin full access.

### Booking and visitor services

- features/connected/OperationsDesk.tsx: actual protected booking/visitor workflows and facility configuration.
- features/connected/BookingDatePicker.tsx: desktop calendar/native date input.
- features/connected/BookingSlots.tsx: slot grid, range selection, reserved/past states and clear-time feedback.
- features/connected/BookingSchedule.module.css: wide booking dialog and responsive layout.
- packages/shared/src/operations.ts: schemas/time conversion.

Current booking behavior:

- Uses approved facilities from the server. No facilities are seeded from screenshots.
- No dead New booking form when no eligible active facilities exist.
- Authorized staff configure actual names, hours, slot duration, maximum duration, capacity and renter eligibility at Office → Bookings → Configure facility.
- Desktop pairs calendar and time picker; narrow screens use their native date input.
- Facility/date changes clear selected times. Reopening resets the form.
- Manual time entry remains available in a disclosure.
- Availability refreshes every five seconds while the form is open; record lists refresh every 30 seconds.
- Reserved selections disable submission; the server locks/checks conflicts again.
- Pending and approved bookings hold the interval; rejected/cancelled ones release it.
- Adjacent non-overlapping reservations are allowed.
- Other residents see reserved times only, not booker identity, unit, contacts or private purpose.
- Preview permits local selection but never a real save.

The owner's screenshot showed zero configured facilities. This remains an owner/staff operational setup step, not evidence that booking RPCs need reinstalling.

### Marketplace

- features/developer/ModuleMonitor.tsx: developer inspection of saved legacy/source sections.
- features/connected/Directory.tsx and LiveFeatureDirectory.tsx: actual workspace entry/section selection.
- features/connected/LiveFeature.tsx: protected submissions, owner edits, review and publication.
- features/connected/ListingMedia.tsx: optional links and processed cover upload/display.
- packages/shared/src/baseline.ts and feature-records.ts: structured field definitions/validation.

The monitor is not the posting screen. It now has Open marketplace workspace and Review marketplace submissions links. The booth-event selection is retained in the workspace URL. Do not hide these links with the legacy resultSummary CSS class, which is intentionally hidden on desktop; they use workspaceActions.

Six sections: businesses, buy/sell/services, jobs, garage sales, booth events, workshops.

- Submissions stay restricted until staff publish reviewed text, audience and expiry.
- Owners can add up to five optional labelled HTTPS links and one cover on an unreviewed, consented listing.
- JPEG/PNG/WebP input up to 8 MB is decoded, resized to at most 1200px, and re-encoded as WebP.
- The private bucket accepts WebP up to 1 MB. SVG is not accepted.
- Images cannot be overwritten. An unreviewed cover can be removed and replaced with a new path.
- Media changes invalidate stale reviews.
- Editing businesses, buy/sell listings, jobs and garage sales returns them to review and removes the published copy until approved again.
- Workshops/booth events retain their existing participant/capacity workflow; do not casually revise an activity with participants.
- Private fields and household addresses are not automatically published.
- Signed cover URLs last 60 seconds; an issued URL can survive withdrawal until expiry.
- Account preview authorizes media metadata through its audited gateway before the unchanged developer session signs the returned cover path. Writes stay disabled.

### Other connected work

- features/transport/Shuttle.tsx: authorized shuttle queue, availability, driver duty/readiness, lifecycle and history.
- features/services/RequestDesk.tsx: protected Helpdesk requests/messages/status.
- features/account/PayDues.tsx: Buyani external payment handoff and clear example/computed account.
- features/registry: private lot register and receipt entitlements.
- features/connected/ParticipationDesk.tsx: workshops, booths and private carpool applications.

Opening Buyani never marks a payment as received locally.

## 6. Database installation state

The owner reported running migrations 001–015 manually. Screenshots confirmed successful 014 and 015 transactions. The latest owner-provided verification was:

| Check | Result |
| --- | --- |
| assessment_only | true |
| private_tables | 3 |
| storage_guards | 5 |
| anonymous_blocked | true |
| cover_bucket_private | true |
| tab_access_installed | true |
| authenticated_endpoints | true |
| listing_media_installed | true |

This verifies installation metadata, not complete operational/production acceptance. The agent did not connect live.

Migration map:

| Number | File suffix / purpose |
| --- | --- |
| 001 | request_workflow — protected requests |
| 002 | module_monitoring — developer monitoring |
| 003 | access_permissions — committee grants |
| 004 | accounts_notifications_developer — profiles, private notifications, developer controls |
| 005 | lot_register — private registry, memberships and receipt entitlements |
| 006 | customer_workflows — Shuttle and Helpdesk improvements |
| 007 | feature_records — structured submissions and reviewed publications |
| 008 | facility_bookings — facility policy, reservations and conflicts |
| 009 | visitor_passes — verified-lot visitor approvals/entry/exit |
| 010 | workflow_history — restricted histories |
| 011 | activity_participation — capacity-controlled applications |
| 012 | member_inspection — audited support session foundation |
| 013 | account_interface_preview — actual portal read delegation |
| 014 | configurable_access — scoped tabs, defaults and delegated management |
| 015 | listing_media — private covers, optional links, re-review and preview media reads |

Exact filenames are under supabase/migrations. Installed files are historical: use an additive 016 or later if a future backend correction is needed. Never silently edit an installed migration and tell the owner it will update the database.

Read-only checks are under scripts:

- verify-feature-services.sql — 007–011.
- verify-member-inspection.sql — 012.
- verify-account-preview.sql — 013.
- verify-ui-access-media.sql — 014–015.

These are verification scripts, not feature installation migrations. Explain the exact file to open/copy if the user asks. SQL migrations do not need rerunning just to rerun a read-only verification.

Earlier owner-reported registry import: 921 lots and 4,314 receipts. Do not repeat the import. Treat real imported records as private; do not use them in fixtures or screenshots.

## 7. Known limitations and setup still needed

- Portal UI does not currently create/delete Supabase Auth accounts. Self-registration is closed.
- Developer controls change existing linked members' roles, permissions and Active/Suspended state.
- Full backend tests require real Auth test users and linked member records; local synthetic previews do not test actual server saves.
- Never promise a fake email/local role switch can authenticate against real Supabase.
- No credentials/test passwords should be written into source. No live account provisioning was authorized/performed by the agent.
- Actual facilities/hours and driver rosters require approved configuration.
- Actual Storage HTTP uploads/downloads still require an owner-run smoke test. SQL tests use a stub Storage schema; browser tests mock APIs.
- Restrictive policies protect the new cover bucket, including broad existing policy and anonymous-access cases. This does not certify every legacy table/policy.
- Removed cover objects need authorized orphan cleanup; no automatic retention/cleanup job, malware scanning or backup guarantee was added.
- Financial statements/accounting/reconciliation, certified elections and some legacy/specialized workflows are not all complete. Do not infer authoritative financial data or election results from sample screens.
- Synthetic role previews are separate from actual account preview.
- The latest UI fixes needed no migration beyond already installed 015.
- No commit, deployment or publication was performed.

## 8. Local test workflow

Use npm.cmd / npx.cmd in PowerShell; the npm.ps1 execution policy can block plain npm. Do not bypass machine policy unnecessarily.

From the workspace root:

    npm.cmd run typecheck
    npm.cmd run lint
    npm.cmd run test
    npm.cmd run build

Run meaningful checks appropriate to the change. Fix failures and do not repeatedly broaden/repeat successful tests without a reason. Format only affected files rather than rewriting the whole tree.

Configured authenticated browser tests:

    $env:BELLEFORT_TEST_AUTH='configured'
    npx.cmd playwright test --grep 'consistent workspace UI|facility and visitor|developer account interface preview'

The existing Playwright configuration supplies a synthetic .invalid Supabase URL/key and mocked routes. This is deliberately not a live connection.

Other modes:

    $env:BELLEFORT_TEST_AUTH='missing'
    npx.cmd playwright test

    Remove-Item Env:BELLEFORT_TEST_AUTH -ErrorAction SilentlyContinue
    npx.cmd playwright test

Ports:

- 5192: configured/mock authentication.
- 5193: missing configuration.
- 5191: local synthetic preview.
- Preserve the user's existing development server, commonly 5173.

Projects are Chromium and mobile WebKit. Use playwright.config.ts rather than inventing credentials or connecting tests to a live backend. Axe and overflow checks are already used in tests/e2e/auth.spec.ts.

On Windows the Playwright wrapper sometimes remains running after every test reports pass. Count expected/completed cases first. Only then stop that owned wrapper with Ctrl+C if needed; do not kill unrelated Node processes or the user's dev server. Do not claim a hung wrapper exited cleanly.

Vitest includes packages/**/*.test.ts and supabase/tests/**/*.test.ts. New app-local tests are not automatically discovered. Prefer meaningful shared tests or the existing browser suite.

Latest recorded baseline:

- 257 automated tests across 21 files passed.
- Focused browser follow-up: ten cases across Chrome/mobile WebKit passed for navigation, account preview, marketplace entry/media and booking/visitor behavior.
- The facility/visitor case then passed again in both engines with an explicit reserved manual-time check.
- Typecheck, ESLint and build passed. Existing third-party zod annotation warnings are nonfatal.
- All these browser/SQL tests use synthetic data; they do not prove the live environment works.
- Synthetic artifacts are under test-results/ui-review; they are review artifacts, not assets to copy into production.

Recheck what is relevant after future changes; these historical results do not prove new work passes.

## 9. Editing and verification habits

- Search with rg / rg --files first; scope searches to relevant source directories.
- Avoid wildcard path arguments that PowerShell/rg treats literally; use a directory plus -g filters.
- Read dependencies before editing state, permission or workflow logic.
- Preserve current changes; never reset the project, recreate the app, overwrite unrelated work or delete directories to fix a test.
- On Windows, verify resolved paths before any recursive removal/move. Do not mix shells for destructive operations.
- Do not mass-convert existing file encodings. Some historical vault notes have mixed encodings; append carefully with UTF-8 rather than rewriting them wholesale.
- Update affected vault notes and the running fix list after substantive work.
- Explain behavior and practical limits, not just a list of filenames.
- For auth/permissions, test direct endpoints and ownership boundaries, not only whether buttons are hidden.
- For booking, preserve server locks, idempotent references, version checks and final conflict validation.
- For listings, preserve consent, audience, expiry, moderation and upload/review concurrency protection.
- For preview, preserve target isolation and the real developer actor. Never expose a service-role key in the browser.

## 10. Immediate continuation

The last user request was to hand the project to Claude. Current screenshot issues have local fixes; the remaining practical user step is configuring approved facilities and testing actual operations using separately signed-in accounts.

Begin by acknowledging that you read AGENTS.md and this handoff. Inspect the current files related to the next requested task. Continue the existing architecture and workflow rather than proposing a rewrite or reinstalling the database.

## Addendum — 7 November 2026

A prioritized plan for the remaining work is in `docs/NEXT-WORK-PLAN.md`. Read it
after this handoff. Its Priority 1 (QA of authenticated mode) is the largest
unverified area in the project.
