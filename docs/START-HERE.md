# Current: customer workflows and imported registry

Business form restoration (11 November 2026): [setup, SQL 048-059 and owner verification](BUSINESS-FORM-RESTORATION-SETUP.md). [Coverage and remaining gaps](LEGACY-FORM-COVERAGE-ASSESSMENT.md). Prepared locally; not applied to the live database by the agent.

Current local follow-up: [Resident access and onboarding](RESIDENT-ACCESS-FOLLOWUP.md). Includes migration 023 preserving the owner-applied visitor/carpool permissions and a read-only registration-readiness script. Nothing here records a new live installation.

Latest UI and permissions update: [UI, access and listing media setup](UI-ACCESS-MEDIA-SETUP.md) covers new migrations 014–015, user/role/committee tab access, designated admin management, moderated listing photos/links, and improved booking slots. [Full screenshot/request checklist](UI-UX-FIX-LIST.md). Existing migrations and imports must not be rerun.

Latest correction: [Account interface preview](ACCOUNT-PREVIEW.md) replaces the inspection dashboard with the selected member's actual portal screens, navigation and connected reads. Install only new migration 013 after the already successful 012. The developer stays signed in; writes are blocked and no member notification is sent.

Developer support update: [Member inspection](MEMBER-INSPECTION.md) documents migration 012 and the new audited, ten-minute **View member — read-only** screen. It keeps the developer signed in and does not impersonate a member or issue a member login token. Existing role previews remain synthetic.

Latest wiring increment: [Feature services installation](FEATURE-SERVICES.md) covers migrations 007–011, protected submissions/publications, facility bookings, verified-lot visitor passes, history and capacity-controlled activity participation. It does not complete accounting, certified voting, files, or every source-system behavior. Earlier successful migrations and the lot import must not be rerun.

The owner confirmed the active import of 921 lots and 4,314 receipts. Do not repeat the import or successful migrations 001-005. See [Lot migration instructions](LOT-MIGRATION.md) for those records and their permission boundaries.

For the shuttle, Helpdesk, finance navigation and Buyani handoff changes, follow [Customer workflow instructions](CUSTOMER-WORKFLOWS.md). Migration **006** and its scheduled expiry job are prepared locally; neither was applied live by the agent. Configure approved drivers, capacities and operational contacts, verify Cron, then complete the authenticated pilot checks. Accounting statements remain unavailable pending approved records. No deployment was performed. Older sections below describe earlier releases.

Connected routes: `/office/lots`, `/office/finance/collections`, `/account` and `/more/lots`. Role previews remain synthetic. Incidents, announcements and gate operations are separate pending phases, not completed migrations.

# Start here — Bellefort local workspace

## Navigation and period financial reports

Sign-in now opens the primary assigned area automatically (developer tools take precedence for explicit developers). If an office landing page is not granted, the app chooses an available permitted area or My profile. `/workspaces` is a compatibility redirect, not a required picker. Desktop navigation includes all assigned areas; on mobile the familiar bottom bar and More page remain. There is no new Menu popup. More exposes assigned-role features through labelled expandable sections while keeping household content hidden from nonresidents. This changes navigation, not database roles or server permissions.

Security no longer repeats its Visitors/Vehicles/Incidents navigation in the page body. Gate desk remains in main navigation. Driver dispatch is available through navigation; the Board overview shows readiness information instead of repeating its page links. More, profile and help do not grant household/office access.

Open **Finance > Reports** at `/office/finance/reports`. Available filters are This month, Last 3 months, Last 6 months and This year. The report includes exact-value totals, monthly bars, an optional detailed table and CSV export with report metadata, period, source notes, summary, monthly breakdown, invoice detail and a total row. CSV uses Excel-friendly UTF-8/BOM, decimal PHP amounts and the existing formula-escaping helper. Authenticated staff need finance view; CSV UI additionally checks finance export. Preview export remains synthetic.

This report currently uses the six-household synthetic invoice snapshot, frozen as of 2026-11-04. Periods group invoice due dates; recorded payments are amounts against those invoices, not cash received during that month. Missing months and unbilled households are unavailable, not zero. Expenses, bank balances, reconciliation and receipt timestamps are not added or inferred. An actual financial report/export needs a protected backend endpoint and approved accounting/reporting rules. No new migration, live connection or deployment accompanies this UI work.


## Current update: accounts, notifications, developer controls and mobile popups

This section supersedes older monitoring-only/profile-read-only statements below. Migration 004 is prepared and locally tested; the agent has not installed it or contacted the live database. The user reported installing 001-003. Those successful migrations must not be rerun.

Owner next steps:

1. Review `supabase/migrations/202611050004_accounts_notifications_developer.sql` and the intended project's backup/recovery arrangements. Apply the whole file once in Supabase SQL Editor, after 001-003. A successful transaction commits the new services together. No environment-variable changes or service-role browser keys are needed.
2. Refresh the app, sign out and back in if membership is stale. Check **My profile**, the notification bell, and **Developer / Roles & committee access**. Developer control requires exactly one Active linked member with an explicit developer role; admin alone does not inherit it.
3. Use an invented test request from a resident account, reply/change status through the office workspace, and verify the private notification arrives only for eligible recipients. Change profile preferences and verify another account cannot read/edit them. Marking notifications read must persist per account.
4. Test a narrowly approved committee grant and revocation using a test account and an approval reference. Verify requests:view does not imply reply/status. The new control screen supports member primary/additional roles, Active/Suspended state and explicit committee grants/revocation. Confirmation, stale-write checks, audit records and last-active-developer protection apply. Trusted owner recovery remains available through SQL; never disable guards to force an app action.
5. Complete actual-account and legacy API security acceptance with the owner before release. Local SQL/browser tests do not certify Supabase configuration, mail delivery or all legacy policies.

Profiles store only display name, contact preference and bio. Registered identity, login email, unit and roles remain separate official fields. No avatar upload is connected. Notifications cover new protected request activity, saved profile preferences and access changes; they do not backfill old portal_data events or provide push/email delivery. The bell shares private unread state with All/Unread and New/Today/Earlier views; refresh/polling is 30 seconds.

The developer workspace now exposes protected operations that are implemented: request replies/status, member access management and committee grants. Fifteen module monitors still inspect recorded sections; this does not implement every business edit, payment approval, invitation, property transfer or election operation. Six role previews remain isolated synthetic experiences, not real-account impersonation. General legacy members/portal_data policies still need coordinated hardening; a new trigger specifically prevents nondevelopers from using legacy admin writes to grant/tamper with developer membership.

Shared popups now use a fixed title/close region, scrolling content, safe-area spacing and keyboard-aware viewport limits. Mobile forms use at least 48px controls, 52px primary footer actions and bottom sheets; busy profile/request/access operations cannot be dismissed mid-save. Keyboard focus returns to the trigger. Real iOS/Android keyboard/device acceptance is still required.

Home-screen installation is suggested after the second signed-in device visit, delayed 10 seconds, with a seven-day dismissal. It stays off sign-in/role-preview screens and waits around open dialogs. Installation requires an explicit click. The profile provides a manual entry; unsupported native prompts use browser/iOS Add to Home Screen guidance. No push permission is requested.

QA follow-up: notification accessible names begin with visible ?Mark read?; service request samples now use Open / In progress / Resolved, including normalization of older local In review requests. Other document/registration review states retain their distinct vocabulary. The module screen has one responsive H1, expense submissions have their own section title, recovery uses H2, and My requests no longer links to itself. `/admin` redirects to `/office/finance`; legacy subroutes remain compatible.

Financial visuals show only the three supplied synthetic invoice periods, with exact amounts and a payment meter. No six-/twelve-month history, payment timestamps, opening balance or running account balance is invented. Expense amounts/categories sum supplied values only; missing amounts are unavailable. Calendar density counts sample requests, not confirmed occupancy. Coverage bars describe relative inventory size, not production completion. Reconciliation/Board charts remain absent until verified inputs exist. `/explore` shows six modules per page and source evidence four families per page. All entries remain searchable and accessible through their own routes.


## Developer desktop and mobile layouts

Desktop refinement: `/developer` now opens a branded system overview; `/developer/modules` is the searchable catalogue. The top-bar search finds module destinations. Each module, including Property, uses the shared desktop workspace with source summaries, current-page search/status filters, contextual columns and an Inspect drawer. The sidebar has one scrolling navigation area; the brand/account remain fixed. These refinements apply at 1024px and above and do not grant new permissions or require SQL. Phone layout stays in its mobile presentation.

Refresh the local app to see the updated developer workspace. At 1024px and above, System modules uses a compact dashboard header, visible section tabs, a record table and right-side Inspect drawer. The sidebar module list scrolls independently and keeps the active destination visible. Smaller screens retain cards, bottom navigation, expandable section controls and the existing mobile detail dialog. Both use the same source records and permissions; no new SQL or environment variables are required for this layout change. Developer monitoring is still read-only; this does not add user-management or business-operation powers.

## Committee permissions - installation and provisioning

Installation status update: the user reported successful owner execution of migrations 001, 002 and 003 on 5 November 2026 and supplied success screenshots. The agent has not connected to or independently verified that live installation. Do not rerun successful migrations. Staff assignments and real-account acceptance are separate next steps.

The access workbook was reviewed as planning evidence. Migration `supabase/migrations/202611050003_access_permissions.sql` follows 001 and 002. It records 12 committee names and 204 nonpersonal Committee Matrix cells. It imports no people, credentials, attendance entries or account assignments. The user confirmed on 5 November that each action needs explicit approval before writes are enabled. Unreadable cells, Super admin and All Access are ungranted; labels such as D/M/R never automatically grant operations.

The migration adds owner-provisioned committee assignments, exact module/action/scope allow/deny grants, expiry/revocation, a server-owned provisioning audit, and two protected permission functions. Any matching active deny overrides an allow for that exact capability. Own, approved-content, assigned-work and association scopes do not imply one another. Developer monitoring remains separate from operations; a committee cannot manufacture developer capability. Existing roles are preserved. No browser account can directly read/change the provisioning tables, including an admin or developer.

The authenticated office route and sidebar now require server-returned module permission. Missing setup, an unrecognized route or denied access closes the office view; role previews remain explicitly synthetic. People/registration queries wait for the corresponding view grant. The request RLS and protected create/reply/status functions enforce exact grants; office read does not imply reply/status. This is the implemented enforcement slice. General finance/publishing/approvals and legacy shared JSON are not thereby production-enforced. Existing members, registrations, portal_data and audit_log policies are unchanged and still require a coordinated legacy-backend security migration. Do not treat browser checks as protection for those direct APIs.

Owner installation and acceptance:

1. Review the workbook ambiguities and the intended project's recovery arrangements. Review all three migrations and apply each missing migration once, in order 001 → 002 → 003. Do not rerun successful migrations or remove RLS/guards to force installation. No migration has been run live by the agent.
2. Provision no blanket admin grant. For each approved person, resolve their Auth UUID and confirm exactly one Active linked member; select the committee ID from the migration. Record an approval reference and optionally an expiry. Add only specifically approved module/action/scope grants through owner-reviewed SQL. No names, emails or roster are embedded in the migration. Existing admin users need explicit office grants after 003; coordinate this change with the owner.
3. To open the office overview use `overview / summary / association`. Request staff additionally need `requests / view / association`; independently approve `requests / reply / association` and `requests / status / association` if needed. People and registration views are separate `people / view / association` and `registrations / view / association` grants. The existing Active admin role is also required for office endpoints. A summary grant does not unlock a private-record page. Assigned-scope request workflows are not implemented and do not substitute for association grants.
4. Refresh the app and open Developer → Roles & committee access (`/developer/access`) to inspect your own effective access and pending decisions. Module grants do not create a role or override suspension. Browser permissions refresh on focus/manual refresh and every 30 seconds; the server checks protected request operations on every call.
5. Use separate resident A/B, read-only staff, permitted staff, BOD and developer accounts to verify direct API denial, action separation, expiry, revocation and immutable provisioning audit. Local PGlite and mocked browser checks do not replace real Supabase acceptance. Finish legacy policy hardening before releasing private legacy records.

The Supabase browser URL/publishable-key configuration does not change for this migration. No secret/service-role key belongs in Vite or Vercel browser variables. No deployment or live assignment is performed by this work.

## Developer module monitoring and Board navigation

Developer console → System modules is now a direct read-only monitoring workspace, separate from role previews. Fifteen module categories expose permitted sections for accounts, property, requests, request replies, finance, amenities/calendar, security, community, hotlines, livelihood/training, transport, documents/governance, election setup, role assignments and audit history. Desktop has direct module links in the developer sidebar; mobile uses the Modules bottom-navigation destination and icon catalogue. These routes stay under `/developer/modules/...`, retain the signed-in developer identity and never enter a synthetic role identity or inherit operational write permissions.

For database-backed monitoring, the owner must review/apply `supabase/migrations/202611050002_module_monitoring.sql` after the first request migration below. If migration 001 has already succeeded, do not rerun it. Migration 002 adds one read-only function, bfe_monitor_module. It does not change original data, role helpers or existing policies. An active developer assignment is checked on the server; admin alone cannot call it. Missing setup/refused access is shown as an error without sample fallback. Absent JSON sections are distinguished from saved empty sections. Twenty records are returned per page; source availability is checked on open/refresh and polling is 30 seconds, not a claim of instantaneous global health.

The monitoring response uses a field allowlist. Credential fields, registration proofs, embedded assets and arbitrary nested objects are excluded. Election monitoring returns setup metadata only, never ballots, votes or eligibility lists. Recorded source data may contain old examples or unverified values; storage in Supabase alone does not certify authenticity. New request sections, their replies and audit history are distinct from legacy portal_data collections. Email/SMS delivery, storage health and a unified event stream remain unavailable. Developer inspection is not a replacement for the separately assigned admin workspace's protected business actions.

Board Documents, Elections, Updates and Reports now stay under `/board/...`; the Board menu remains visible. Update detail/back links retain that namespace too. Existing shared document/election/governance links preserve Board navigation for Board members. Report availability is explicit and does not expose confidential household finance through a resident/admin route. The office request inbox route now resolves to the protected request conversation desk in authenticated mode; explicit synthetic preview retains its earlier inbox walkthrough.

## Protected request workflow - prepared, not installed

The first transactional backend slice is implemented locally at `/services/requests` (resident) and `/office/requests` or `/office/inbox` (office request conversations). It covers resident submission, office/resident replies and office-owned Open/In progress/Resolved transitions. The existing member directory and registration inbox keep using the original tables. Other business modules are still synthetic; this is not a completed migration of all source features.

For synthetic visual review, use Developer console → Role previews → Homeowner or HOA administrator, then Requests. These paths use five invented scenarios, isolated per role and clearly labelled synthetic. They never call the live request tables/functions. Resident and admin role previews intentionally do not share each other's edits. The older explicit preview walkthrough remains available.

For real operation, the authorized owner must first review and apply `supabase/migrations/202611050001_request_workflow.sql` once in the intended Supabase project. This is a versioned application migration, not an assessment/audit query. It creates three new `bfe_` tables and five narrowly scoped functions. It does not import source values, alter the legacy portal_data/members policies, change existing role helpers or seed production records. If it fails, the transaction rolls back; do not remove RLS/guards or force a partial installation. A successful migration may show a command-success result without a row grid.

Owner steps:

1. Confirm the target project and recovery/backup arrangements, and review the migration's scope. It depends on the existing `auth.users`, `auth.uid()`, `members.user_id`, `members.role`, `members.extra_roles`, `members.status` and `members.unit` contract already used by sign-in.
2. Paste the entire migration into Supabase SQL Editor and run it as the authorized database owner. Apply it once; a second attempt intentionally fails on existing objects rather than silently accepting schema drift. No agent has run it against the live project.
3. Refresh the local app. An active homeowner/renter creates a clearly identified test request. An independently authorized admin opens the same request, replies and starts work. The resident refreshes and verifies the reply/status. Technical request polling is every 30 seconds plus focus/manual refresh; email, SMS, push and Realtime delivery are not implemented.
4. Use a second resident account to verify it cannot read/reply to the first account's records through direct API calls as well as the UI. Verify suspension/revocation, developer-only monitoring and forbidden direct table/audit writes. Do not treat the synthetic browser API mocks as live-project acceptance evidence.
5. Keep unrelated sample workflows labelled synthetic. Existing requests in portal_data are not automatically imported or shared with Kate's portal. A data migration requires validated identities, provenance and deduplication; unknown/n/a unit strings must not become verified property links.

New request ownership always comes from auth.uid(); no caller-supplied owner, role, status or unit is accepted on creation. Only an exactly-one Active membership is recognized. A developer-only role can monitor these new request/audit records but cannot reply or change status without a separate office/resident role. Replies and statuses write server-owned audit records in the same transaction. Submission/reply UUIDs make unchanged retries idempotent; different payloads cannot reuse the same reference. Status updates carry an expected version and reject stale edits. Direct authenticated/anonymous writes are revoked. Small server-side submission/reply throttles are technical limits, not HOA service-level promises.

Until installed, real request pages show unavailable states and cannot save locally as a fallback. Recorded unit text is a snapshot, not proof of ownership. This slice does not implement assignments, attachments, property/household membership, board confidentiality policy, invitation delivery, financial posting, bookings or elections. Existing legacy members/shared-data read policies remain a separate security review item.

## Staff data integration - 5 November 2026

Authenticated `/office` now opens a task-based staff home with six areas. Cards explicitly distinguish database reads from sample workflows. `/office/residents` reads a paginated, searchable member directory from `members`; `/office/registrations` reads submitted registration details from `registrations`. These reads use the current browser session and existing RLS, never a service key. Search is submitted explicitly, treats wildcard characters literally, and supports name/email/unit plus status. Only returned records and database-provided matching counts are displayed. An empty result is not proof the whole association has no records.

Member details show primary and extra roles, recorded unit, contact details and whether an Auth ID is recorded; the app does not query `auth.users` or claim the link proves account existence. Registration proofs are not fetched. No records are logged, downloaded, copied into sample storage or placed in a persistent query cache. Failed/unsupported responses show an error without synthetic fallback. Refresh rechecks the visible query; timestamps report that fetch, not a global health check.

Invitations, account changes, suspension/deletion, registration approval, property verification and combined homeowner dossiers still require protected server operations. Remaining operational pages continue using synthetic local data. Developer role previews retain their isolated samples and never fetch this real directory. No policy/function/table changes or deployment were performed by this local implementation. See [[Master implementation plan]] for the remaining feature integration map. Run the app normally and use an authorized admin account to review the two directory routes; database refusals must be resolved by reviewing policy, not disabling RLS.

## Developer console and role previews

The developer workspace is now separate from HOA administration. An active member must have `developer` in the existing primary/extra role assignment to open `/developer`; `admin` alone does not grant it. Keep any separately approved office or household roles. The owner-run assignment SQL is supplied in conversation rather than stored here. No account was granted developer access by this implementation.

After assignment, refresh `/workspaces` and choose Developer console. Connections shows the current verified identity/member lookup and its check time; it does not claim global Supabase/storage/mail health. Global activity monitoring remains unavailable until protected server endpoints exist.

Choose Role previews to inspect Homeowner, Renter, HOA administrator, BOD/Board, Security or Driver. Routes remain under `/developer/preview/<role>/...`; a persistent Previewing / Synthetic data banner provides Exit preview. The real developer gate remains outside the synthetic identity. Each role has a separate sample-storage namespace and query cache; preview account-changing Auth calls are blocked. Client route permissions and visible links follow the selected role. These previews do not verify RLS, model all unapproved department/tenant rules, impersonate real users or change actual assignments.

`/more/profile` now shows the signed-in member's actual linked name, title, phone, recorded unit, status, verified login email and recognized roles. It is read-only; no role or property editing is exposed. In role preview it shows invented details and hides real contact information. The mobile Auth wordmark is centered per the latest user request.

## Real sign-in setup - 5 November 2026

Real authentication is now the default. `/sign-in` accepts email/password through the official Supabase SDK, verifies the identity with Auth, then reads the member record by `members.user_id`. `/workspaces` lists only recognized active roles. Missing, duplicate, suspended, unsupported or unreadable memberships stay blocked. These frontend gates do not replace database RLS or protected server operations.

The user has configured the connection and reported successful sign-in. Automated verification uses mocked Auth and synthetic records rather than the live project. Bills, statements, requests and other operational records remain synthetic and locally stored, even after real sign-in; the staff directory and registration reads above are exceptions. Do not treat sample records as the signed-in member's actual financial or household records.

### What you need to do

1. Copy `.env.example` to an ignored `.env.local` in this workspace. Set `VITE_APP_MODE=authenticated`, `VITE_SUPABASE_URL` to the owner-approved existing project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its publishable key (or legacy anon key). Never use a secret/service-role key or database password. Do not paste actual values into chat or commit them.
2. Restart `npm.cmd run dev` so Vite reloads the configuration. Open `/sign-in`. The email/password inputs stay disabled while connection settings are missing or invalid.
3. In Supabase Auth URL Configuration, add the exact recovery callback URLs for this app to the existing redirect allowlist: `http://localhost:5173/reset-password`, `http://127.0.0.1:5173/reset-password` and the intended HTTPS deployment's `/reset-password`. Preserve Kate's existing URLs and Site URL. Recovery uses the current origin explicitly; no shared Site URL change is needed for this implementation. PKCE recovery should be completed in the browser/tab that requested it.
4. Add the same three environment variables to the intended Vercel environment for this React app. `vercel.json` provides the SPA deep-link fallback. Variables take effect on a new deployment. No push or deployment has been performed or authorized by this setup guide.
5. Test an owner-approved account manually. It must have a valid Supabase Auth identity and exactly one linked `members` row with status `Active`. Known roles are `admin`, `homeowner`, `renter`, `board`, `security`, `driver` and the separately assigned `developer`. Extra recognized roles add corresponding workspace choices. A title such as IT volunteer or staff does not automatically grant a role. There is no email-based fallback or self-grant.
6. If membership is blocked, have the authorized owner review the existing account link and policies. Do not disable RLS to make login work. Review the actual RLS/functions before introducing real business records or treating the app as production ready.

Sessions are held in browser-tab storage and restored after refresh; sign-out closes the current browser session and clears local sample drafts/query caches. Membership is refreshed on focus/reconnection and every 60 seconds when online. Server policies must enforce access on every actual operation. MFA challenge/enrollment and privileged server capabilities are not implemented in this step.

### Continue synthetic UI review

Use `VITE_APP_MODE=preview` only for explicit synthetic inspection, then restart Vite. That mode has no real authentication and exposes the existing workspace chooser. The walkthrough below describes this preview mode. Do not use preview mode to evaluate real permissions or enter real resident data.


For the latest usability review, start with `/more/vehicles`, `/more/permits`, `/more/documents`, `/services/calendar` and `/directory`. The resident screens now use icon headings, clear task actions and visual empty states. Request requirements, document review tools and simulated audience controls expand below the main content. Calendar agenda items follow the displayed month. Directory has visual category filters; sample loading is below the results. Authentication implementation is described above; business-data integration remains deferred.

Also review `/services` and `/more`. Services now has searchable icon tiles and a separate tracking section; More groups home, community and account features. Preview tools are in an expandable section. Longer navigation groups offer More sections; Escape closes the expanded choices. Supporting sample explanations and simulated audience controls expand when needed. Read `docs/vault/User experience.md` for the interaction patterns and review tasks before roles/permissions work.

Updated 5 November 2026: begin at `/directory` (**More → Connected community directory**). Choose **Load synthetic walkthrough** once to add 31 invented structured records without replacing your existing edits. This is optional, local sample data. Use `/coverage` to compare all 16 source areas and their remaining gates.

Try the connected flows:

1. **Content:** prepare a business, session, notice or document at `/explore`; submit locally with a reason. Open `/office/review`, start local review, then publish supported content to local sample views. Check `/directory`, `/community` or `/more/documents`. Archive the sample to withdraw it. Audience selectors demonstrate display behavior only.
2. **Support:** open `/services/inbox`, prepare a conversation and save a synthetic local reply. Open `/office/inbox` to inspect the same thread, unread marker and Office reply view. Nothing is sent externally.
3. **Participation:** open a sample session, booth event or carpool in the directory and use its linked interest/application action. The parent reference is preselected. No actual place is reserved.
4. **Operations:** inspect `/office/registry`, `/driver/dispatch` and `/security/gate`. Driver pairings and gate/trip steps are non-authoritative simulations.
5. **Finance:** `/account/statement` prints or saves a visibly synthetic statement through your browser. Evidence drafts never mark invoices paid.
6. **Reset:** Developer tools → Workspace only resets workspace samples, messages and local read markers; resident records remain separate. Do not reload a scenario over edits or enter actual resident information.

Read `docs/vault/Connected workflows.md` for exact limits. Real backend connections, approvals, permissions, financial authority, private delivery and voting remain later work under the existing authorization boundary.

Date: 4 November 2026. This is a synthetic local application preview, not a production HOA service. Kate’s code, backend and hosting were not connected or modified.

## 1. Run it

From `D:\GHL\Bellefort Estate Portal`:

```powershell
npm.cmd install
npm.cmd run dev
```

If dependencies are already installed, only the second command is needed. On shells without PowerShell’s script-execution restriction, `npm install` and `npm run dev` are equivalent. Open the URL Vite prints, normally http://127.0.0.1:5173. If that port already serves this workspace, refresh that browser tab; do not start another server on the same port. Stop a server you started with Ctrl+C.

Use Node 22.14 or a compatible newer supported Node 22 release for the checked tooling. The lockfile records exact dependency versions. For repeatable dependency setup in a clean checkout, use `npm.cmd ci` instead of install.

Do not enter real resident names, contact details, credentials, financial records or confidential incident details. Everything is a sample. Local changes are stored in this browser tab and may disappear when it closes.

## 2. Open the workspaces

Start the expanded source-informed walkthrough at `/explore` (**More → Full feature baseline**). Pick a module, choose **Prepare sample → Fill synthetic example → Save local draft**, then open the record to edit, submit locally, add notes and inspect review history. Create booth events, training sessions or carpools before their linked applications/interests. Try `/explore/imports` for validated sample CSV staging and `/explore/calculator` for illustrative assessments. See `docs/vault/Feature baseline.md` for the exact coverage and integration limits.

For your review: compare each source family in `/developer/source` with its existing workspace and new `/explore` forms. Record desired changes and unresolved rules in `docs/vault/Product questions.md`. Keep using synthetic examples while your boss reviews the system. Backend provisioning, approved policy, protected authority and release work remain later steps; completing this local walkthrough does not approve or connect them.

| URL path | What to inspect |
| --- | --- |
| `/explore` | Thirty structured local workflow modules, filterable by area and field |
| `/explore/imports` | Synthetic unit/payment-evidence/expense CSV mapping and local draft staging |
| `/explore/calculator` | Supplied-rate sample assessment math; no invoice generation |
| `/` | Approved resident home design, balance visibility and service shortcuts |
| `/sign-in` | Preview workspace chooser; no real password or identity provider |
| `/register` | Validated synthetic registration using an `@example.invalid` email |
| `/recover` | Explicit unavailable recovery screen; no email is sent |
| `/sign-out` | Clear in-memory Query state and return to the entry screen; synthetic tab records remain |
| `/office` | Office queues, financial summary and administration entry points |
| `/office/registrations` | The same local applications submitted from the registration screen |
| `/office/residents` | Synthetic ledger-unit lookup and verification dossier |
| `/office/finance` | Reconciled sample collection/aging report and CSV export |
| `/office/finance/expenses` | Sample expense review; missing amounts stay unspecified |
| `/office/finance/reconciliation` | Visual reconciliation stages with unavailable bank data |
| `/office/requests` | Local concern review, synthetic assignment, resolution and history |
| `/office/community` | Announcement/document publishing entry points |
| `/office/announcements` | Local drafts and explicitly labelled preview publication |
| `/office/access` | Proposed access matrix and review notes; no grants are changed |
| `/office/settings` | Administration, local history, developer tools and workspace navigation |
| `/security` | Local visitor requests; no valid passes or entry/exit authority |
| `/driver` | Sample route interests; no confirmed drivers, fares or trips |
| `/board` | Proposed oversight workspace; no real board permissions |
| `/services/calendar` | Navigable sample month and local booking list; not live availability |
| `/more` | Vehicles, permits, documents, learning, rides, listings and elections |
| `/more/notifications` | Local activity and a local inbox preference; no push/email subscription |
| `/developer` | Scoped fixture resets, storage probe and safe diagnostic export |
| `/developer/scenarios` | Due/overdue/paid/unbilled/loading/failure presentations and workflow links |
| `/developer/components` | Shared visual component and feedback examples |
| `/developer/runbook` | Maintenance guidance inside the app |
| `/developer/source` | Safe source-feature/data catalogue and implementation gaps; never raw legacy code or values |

The workspace chooser is a demonstration tool, not login, role switching, or a permission boundary. Direct preview routes are inspectable. There are no admin passwords or hidden developer credentials to share.

## 3. Demonstrate complete local workflows

1. **Registration:** open `/register`, use a made-up name and `sample@example.invalid`, enter a sample unit, then save. Open the office review queue and inspect that record. Mark it In review locally with a reason. No account, approval, invitation or membership is created.
2. **Resident concern:** create a request under Services, then open `/office/requests`. Assign it to a synthetic staff label and mark a sample review/resolution. Inspect `/office/history`, then return to the resident request list. No real staff notification is sent.
3. **Announcement:** create a draft in `/office/announcements`, open it, add a reason and choose Publish in preview. It appears under `/community` as local synthetic content. This is not real publication or delivery to residents.
4. **Booking:** create and inspect a local request under `/services/bookings`; see its marker/list in the sample calendar and cancel it. It never reserves a real slot.
5. **Other resident services:** create sample vehicle, permit, workshop or ride-interest records from More. Review their local timeline and the missing verification requirements.
6. **Developer maintenance:** run the storage probe and export diagnostics. The report includes version/mode/status/counts only, not names, contacts, record bodies or environment secrets. Use Review reset when you want to restore selected synthetic fixtures.
7. **Preview exit:** choose Leave preview under More. The entry screen explicitly explains the lack of real auth. Reopening a workspace does not authenticate a user.

## 4. Give your boss a bounded review

Compare the approved resident/desktop design, office workflow clarity and required feature scope. Record which version the association wants to pursue, which features belong in the first release, and which workflow changes need review. The current preview does not replace or interfere with Kate’s live app.

Review `docs/vault/Master implementation plan.md`, `Screen and interaction plan.md`, `Permission planning matrix.md` and `Release acceptance.md`. Local screen coverage does not mean those production phases have passed their gates. Actual test results are in `docs/vault/Verification.md`.

## 5. What you need to supply before real backend implementation

1. **Selection and authorization:** boss/project-owner decision, first-release scope, responsible technical owner and explicit authorization for a separate development backend. Do not reuse Kate’s projects or credentials.
2. **Approved access decisions:** who may review registrations, change membership, issue bills, verify/reverse receipts, publish files/notices, operate gates, inspect incidents, export data and administer permissions. Resolve extra roles, overrides and view-only behavior.
3. **Trusted information:** verified unit/membership source, approved dues/payment/reporting rules, booking/security/permit requirements, official contacts, approved documents, branding and any reviewed translations. Elections require a separate approved eligibility/secrecy design.
4. **Separate dev setup:** the authorized owner creates or provisions the new development project. Keep configuration in ignored local environment files and secret management as appropriate. Do not paste secret keys or production credentials into chat or documents. The current preview does not read Supabase configuration or establish a connection.
5. **Implementation and verification:** replace preview adapters with approved authenticated row-level operations; implement transactional approval/outbox, server-owned financial/audit operations, storage policies, RLS and actual refusal tests. Start with synthetic test identities and local/test mail.
6. **Acceptance and release:** test both authorized and refused operations, exercise backup/restore and rollback, perform real-device/accessibility checks and have 3–5 residents aged 60+ complete supported tasks unaided. Deploy only after explicit authorization and the relevant acceptance gates.

The current preview cannot prove that real login/logout, RLS, secret ballots, payment verification, protected files, backups or email delivery work. No production migration, GHL connection, cutover, hosting or store release was performed.

## Reference feature coverage

The separately requested `bfehoait/hoa` code is in `reference/upstream-hoa/` as read-only information. Do not execute it, open its HTML through a server, apply its SQL, copy its credentials/data or reuse its design. The new app deliberately blocks reference URLs. Inspect `/developer/source` and `docs/vault/Source coverage ledger.md` instead.

The catalogue accounts for 16 feature families, 50 root source-state properties and 591 named functions. It also exposes gaps beyond the current preview, including detailed business/job/garage-sale/booth flows, full ride dispatch/carpools, imports, messaging and production authority. These are not claimed complete. Source values and empty/seeded arrays do not prove real records or approved rules. Use the coverage ledger to choose the next bounded implementation slices after the boss’s scope decision.

## 6. Native release is a separate stage

Keep shared contracts/logic portable. Decide whether to implement Expo/React Native or another approved distribution approach before packaging work. Signed Android/iOS builds, publisher accounts, appropriate build environments, privacy disclosures, actual-device testing and store review still remain. A Vite production build and PWA manifest are not store approval.

For ongoing development, use [DEVELOPER-MAINTENANCE.md](DEVELOPER-MAINTENANCE.md).

