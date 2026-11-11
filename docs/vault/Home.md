# Bellefort project vault

Latest customer workflow work: authorized shuttle RPCs, private history, driver duty/presence, 60-minute expiry, capacity checks, notifications and developer roster controls are prepared in migration 006. Helpdesk adds Idea without replacing its protected thread. Finance uses two main tabs and a consolidated report selector; accounting calculations still require approved records. Buyani handoff/account-format help is connected locally. Follow docs/CUSTOMER-WORKFLOWS.md for installation and pilot checks. No SQL was applied or site deployed by the agent.

Current legacy migration decision: the user identified the saved bookings/complaints/requests/passes/dues as test records. Exclude those from real workflow migration; leave their source data untouched. The version 2 assessment recognizes 921 unit candidates and four unidentified units, but only one operational dues candidate; no links were created. The real workbook lot/receipt import remains in place. No further SQL is required to migrate the excluded test sections. See docs/LEGACY-MIGRATION.md; older pending-assessment entries below are historical.

Lot-link assessment follow-up: the operator's first query recognized no canonical candidates among 925 units under the strict numeric rules. This is a format/mapping limitation, not evidence the imported lots disappeared. The same script now emits assessment_version 2, recognizes anchored labels and exact admin references, and reports masked formats. No links were created; operator rerun is pending.

Legacy assessment received: the operator's aggregate result reconciles 921 lots and 4,314 receipts with zero source-count or active-lot-link discrepancies. Remaining sections and structural gaps are recorded in docs/LEGACY-MIGRATION.md. Next operator query: `scripts/assess-legacy-lot-links.sql`, which counts exact candidate matches and flags ambiguity without writing records or granting access.

Latest legacy migration work: the operator confirmed lot receipt wiring. Local receipt links now open canonical lot profiles; source-zero lots have clearer empty states. The next read-only metadata assessment is `scripts/assess-legacy-data.sql`; see docs/LEGACY-MIGRATION.md. Remaining operational records are not imported. No live connection or publication was performed by the agent.

Latest navigation/reporting update: sign-in opens the primary authorised area directly; all assigned areas stay available in navigation. The previous mobile bottom bar and More page are retained, with no new Menu popup. Repeated Security/Board/Driver navigation shortcuts were removed. Finance > Reports adds period filters, a labelled sample chart, exact totals/table and structured CSV export. See START-HERE and [[User experience]] for the sample-only financial boundaries.

Current work: migration 004 adds private account preferences/notifications and protected developer control. It is prepared locally, not installed by the agent. Read START-HERE for owner installation after the already-reported 001?003 and exact remaining legacy security gaps. Shared popups now support safe areas, bottom primary actions and keyboard-aware mobile layouts. QA refinements add guarded record visuals and paginated catalogues. Historical status entries below describe earlier stages.

Expanded desktop design: a Bellefort developer overview, module search header, one scrolling sidebar and a consistent source/filter/table workspace across all fifteen monitoring areas. Member/property columns now use their relevant recorded fields. Mobile presentation is retained; no new SQL or permissions accompany this visual work. See [[User experience]].

Developer desktop update: monitoring now uses compact section tabs, a record table and right-side detail drawer at 1024px and above. Smaller screens retain cards and mobile navigation. Access rights are unchanged. See [[User experience]] and [[Verification]].

Committee access foundation: migration 003 and `/developer/access` are prepared locally from nonpersonal workbook metadata. Explicit approved actions are required; no personal assignments or live grants were made. Request enforcement and office UI gates are implemented; legacy policy hardening remains a release prerequisite. See [[Permission planning matrix]] and [[Security]].

Latest navigation/monitoring update: Board documents/elections/updates/reports keep the Board shell. Developer console now includes System modules, a direct fifteen-category read-only monitoring workspace independent of role previews. Its second versioned migration is prepared locally and requires owner installation after migration 001. See START-HERE for boundaries; no live migration or deployment was executed by the agent.

Latest backend work: a versioned, locally tested request migration and matching resident/office request UI are prepared, **not installed in Supabase**. Developer role previews have five isolated invented request scenarios. The new workflow uses server-owned identity, audit and status transitions; no browser table writes. Read `docs/START-HERE.md` for owner installation/acceptance instructions and exact remaining scope. Other source feature families are not thereby fully wired.

Latest integration: authenticated staff home now groups six work areas and clearly labels database versus sample destinations. Member directory and registration inbox have read-only Supabase adapters with pagination, submitted search and explicit permission/network error states. Own profile and Auth remain connected; the other business modules remain synthetic. See `docs/START-HERE.md` and [[Master implementation plan]]. The owner reported assigning developer access to the two intended accounts manually; that is not a claim of verified database-wide security.

Current stage (5 November 2026): real sign-in implementation is complete locally, with connection settings still missing. Read `docs/START-HERE.md` for setup. Existing member roles drive frontend workspace gates only after Supabase verifies identity. Business workflows remain synthetic. No database migration, RLS changes or deployment occurred. The supplied Bellefort logo is now used on Auth screens and the desktop sidebar.


Latest usability work: [[User experience]] describes the visual Services launcher, grouped/searchable More catalogue, bordered icon navigation and expandable supporting details. Review these daily-user journeys before the later roles/permissions phase.

Latest workflow work: [[Connected workflows]] describes the 31-module connected preview. Start at `/directory` for the optional synthetic walkthrough, `/office/review` for shared review and `/coverage` for all 16 source families and remaining gates.

Latest visual update: the user-requested burgundy, rose and neutral palette is documented in [[Design system]]. Historical blue screenshots describe earlier visual work; current captures use the `palette-` prefix.

Start with the full [[Master implementation plan]]. Use [[Screen and interaction plan]] for the visual direction, [[Permission planning matrix]] for access decisions, and [[Release acceptance]] for future completion gates.

For the implemented local walkthrough and your next steps, open `docs/START-HERE.md`. Developer tools are summarized in [[Developer maintenance]] and documented in `docs/DEVELOPER-MAINTENANCE.md`.

The separately authorized GitHub reference snapshot is inventoried in [[Source coverage ledger]]. Use `/developer/source` for the safe catalogue of feature families, fields, function identifiers and remaining gaps. The raw reference is never served or imported.

For the expanded source-informed local workflows, open [[Feature baseline]] and `/explore`: 30 structured modules, CSV staging and an assessment calculator. The note records implemented behavior and the integrations/production authority that remain unavailable.

Then read [[Roadmap]], [[Architecture]], [[Feature inventory]], and [[Verification]] for the current implementation and evidence. Review [[Product questions]] before any real backend work.

**Observed** — The user authorized immediate local frontend implementation on 4 November 2026, deferred business answers, and explicitly deferred database and hosting. This supersedes the original planning-only gate for local preview work.

**Observed** — All application fixtures are synthetic. No original app code or visual design was reused. The old environment was not connected or modified.

**Observed** — On 4 November 2026 the user requested planning for the whole system and more visual, informative screens consistent with the approved mobile/desktop designs. The four planning notes above cover that request. They are proposals, not approved HOA policy, completed features or authorization to connect/deploy a backend.

**Observed** — The user subsequently requested implementation plus end instructions and long-term developer settings. The expanded synthetic local workspaces are now implemented for review; the production phases and their approval/security gates remain separate. No real backend, identity provider, institutional approval or release is implied by these screens.

Evidence labels used throughout: **Observed** means source or an actual check supports the statement; **Risk** means a consequence needing validation; **Unknown** means evidence is absent. Checkboxes describe proposed work, not proof of completion. Documentation is not functional verification.

This vault opens directly in Obsidian; no plugins are required. [[Decisions]] contains user-approved scope decisions only. There is no Handoff note because the local build is not being abandoned as an unfinished handover.


Current registry implementation and next steps: [Lot migration instructions](../LOT-MIGRATION.md). The user's SQL Editor result confirms the active 921-lot / 4,314-receipt import; their signed-in Lot Register shows imported records. Authenticated finance routes now use the receipt RPC in the local frontend. The agent has made no live database connection. The remaining incident, announcement, gate, Helpdesk and accounting additions are listed there as follow-up phases.

## 6 November 2026: protected feature services (007-011)

Prepared locally; not installed or deployed by the agent. See docs/FEATURE-SERVICES.md for exact installation order, role grants, acceptance checks and remaining work. Owner reported 006 and shuttle Cron job ID 1 installed; successful job executions are not independently verified.

- 007: protected structured submissions for 32 definitions / 149 fields, schema validation, identity/idempotency/version checks, private review and consent-bound curated publication. Generic Reviewed never applies payment, role, ownership, ballot, booking or entry authority.
- 008: facility policy configuration and non-overlapping Pending/Approved reservations, capacity/hours/alignment, approval/cancellation and private availability intervals.
- 009: verified active lot membership for visitor requests; explicit security permissions, valid-time entry/exit and immediate suspension/revocation checks.
- 010: restricted latest-100-event history; no raw table grants.
- 011: booth/workshop/private-carpool participation, serialized capacity confirmation, withdrawal and activity cancellation notifications.
- Source code/design/assets and source personal data were not imported or executed. Legacy test records remain excluded. Accounting statements, certified ballots, uploads, household authority, remaining security workflows and specialized livelihood actions remain incomplete; the new guide lists these explicitly.

## 6 November 2026: developer member inspection

Migration 012 adds audited read-only member support inspection at /developer/members. Search uses existing developer-only member lookup. Starting requires an active developer, a unique target, support reason and idempotency reference. Every section read rechecks developer identity, session ownership/expiry and target capabilities; sessions expire after ten minutes and a new inspection ends previous ones. The developer stays authenticated as themselves. No member token is issued, auth.uid/JWT claims are not replaced, and no member mutation controls are exposed. Existing role previews remain synthetic; links use the correct role landing page. See docs/MEMBER-INSPECTION.md for installation, verification and supported/excluded data. User reported migrations 007-011 installed; the agent did not connect or apply SQL.

## 6 November 2026: corrected account-interface preview

The user clarified that View as means the account's actual portal interface, not an inspection dashboard. /developer/members now provides a one-click Preview account picker, with no support-reason modal. It opens the normal portal components, navigation, roles and connected read functions for the selected member under an opaque session-prefixed router. The old MemberInspection UI component was removed. A persistent read-only account banner and Exit button remain visible, including when an inner module permission is denied.

Migration 013 prepares an explicitly allowlisted STABLE-read gateway. The original developer JWT/login remains unchanged. Transaction-local database member context is delegated only for a permitted read and restored on success/errors; audit records retain the original developer actor. Both the browser proxy and server gateway refuse mutations. Request table reads are adapted through protected request/thread functions; driver heartbeats and auth/password actions are suppressed. Payments/contact links and form submissions are blocked. Normal non-preview clients are unchanged. No member is notified. See docs/ACCOUNT-PREVIEW.md for new installation and the viewport/sample-page limitations. 012 is already owner-installed and must not be rerun.

## 10 November 2026: staff desktop refresh

Added a staff-only desktop layout pass at 1024px and above: consistent shell, panels, filters, lists and maintenance cards. Customer and homeowner/renter visuals are excluded. People filters/pagination use browser history; Office booking actions refresh related booking summaries. Typecheck/build passed; isolated synthetic Chromium checks covered 22 staff routes at three widths plus focused People history/detail checks. See docs/STAFF-DESKTOP-REFRESH.md for evidence and remaining live workflow verification.

## 10 November 2026: Office review inbox wiring

Added an authorized Office review inbox over existing submission stores, with pending-only feature, booking, pass and activity projections, paginated lot-link discovery and capability-specific review routes. Helpdesk and shuttle remain follow-up/dispatch workflows. Fixed permit route capability to Property and preserved direct staff announcement publishing. Migration 038 is prepared for owner installation; no live database accessed or approvals performed. Eight isolated aggregation/route tests passed and eight synthetic Office browser routes checked. Customer layout and normal submission flows are unchanged. See docs/OFFICE-REVIEW-INBOX.md for installation and live verification.

## 10 November 2026: Office facility calendar

Added a staff-only month calendar at /office/calendar with all-facility/status filters, reservation details and daily pagination. Prepared migration 039 for association-authorized reads using Philippine time; no PDF reservations imported or live data changed. Resident views unchanged. Four isolated SQL tests and two synthetic desktop viewport checks passed. See docs/OFFICE-FACILITY-CALENDAR.md for setup and remaining owner verification.

## 10 November 2026: calendar navigation

Added Facilities & calendar directly to the Office sidebar, permission-filtered through the existing calendar association-view requirement. Calendar and booking-list routes highlight this entry rather than Operations. Customer navigation unchanged.

## 10 November 2026: Office QA follow-up

Verified Claude's assessment before changing UI. Overview now emphasizes queues; secondary tools are collapsed and deduplicated. Simplified People/Finance navigation, corrected Helpdesk breadcrumbs and Office access labels, reduced the calendar empty state and compacted staff receipt rows. Confirmed existing receipt pagination and full-row inbox links rather than replacing them. Customer layout and server approval/permission logic unchanged. Typecheck/build and 12 synthetic staff render checks plus two dark renders passed. See docs/OFFICE-QA-FOLLOWUP.md for dispositions and live-verification limits. No SQL required for this pass.

## 10 November 2026: Overview workload visuals

Added current-workload summary tiles, a stacked queue comparison chart and separate follow-up links to Office Overview. Uses existing authorized inbox data only; no historical trend or invented completion rate. Full review inbox/customer layouts unchanged. TypeScript and populated/empty/denied synthetic desktop checks passed, plus a dark render. See docs/OFFICE-OVERVIEW-VISUALS.md. No SQL needed.

## 10 November 2026: Office design QA second pass

Added a proper staff receipt table and month drill-down, moved Office receipt/lot pagination above records, grouped Operations by area, compacted staff announcement rows and hid absent chart legend states. Prepared read-only migration 040 for full-set primary/extra-role filtering; All roles retains the old lookup RPC. Customer UI and protected decision/export functions unchanged. Typecheck/build, four isolated role-filter tests and 18 synthetic light renders plus three dark renders passed. See docs/OFFICE-DESIGN-QA-PASS-2.md for installation and limits.

## 10 November 2026: submission outcome assessment

Assessment only: mapped customer submissions to publication, private approval, account links and service fulfillment. Confirmed generic Reviewed is displayed as Approved despite updating only the request record; Reviewed listings cannot currently transition to Published. Also found vehicle route Security vs migration 018 Property capability mismatch, action-specific publishing-button gaps and customer calendar first-page/refresh limitations. No code or database changes made. See docs/SUBMISSION-APPROVAL-ASSESSMENT.md before follow-up wiring; queue visibility alone does not prove fulfillment.


## 10 November 2026: Livelihood and submission outcomes

Prepared migrations 041-044 and local UI: all six categories in Livelihood; explicit approve/publish including legacy Reviewed recovery; private issuance with references/dates; verified household relationships via the established independent account-lot service; complete own-month calendar reads. Issuance and household follow-up queues stay visible until fulfilled. Direct staff announcements and existing booking/pass/capacity safeguards remain. No live SQL or deployment. See docs/SUBMISSION-OUTCOMES-SETUP.md for installation, verification and accounting/ownership boundaries.


## 10 November 2026: resident Property request defaults

Customer vehicle and permit access errors reproduced from the default policy: 018 uses Property, but 023 omits resident own Property view/create. Prepared 045 to add only that baseline, retaining tab restrictions and explicit denials; customized base policies fail closed. Five isolated permission-stack checks passed. Owner applies 045 after 044 and refreshes; no live change was made. See docs/SUBMISSION-OUTCOMES-SETUP.md.


## 10 November 2026: reviewed installed policy variant for 045

The owner supplied the installed base function after the original guard rejected it. Updated 045 to recognize that exact variant and patch only its calendar own view/create clause to include Property, preserving other clauses and metadata. Repeated installation is a no-op; unknown policies remain rejected. Six isolated checks cover the supplied policy, permissions, denials, isolation and exact definition preservation. Owner must copy and run the updated complete 045; no live change was made.


## 10 November 2026: Office record-management assessment

Assessment only: People member details lacks direct individual property linking and general staff corrections; profile preferences and directory member fields are separate stores. Mapped property relationships, issuance correction gaps, booking/pass amendments, listing/publication revisions, access and accounting boundaries. Recommend one member workspace with contextual actions, before/after review, reasons, history and affected-view refresh. Owner reported 045 installed successfully. No application or live database changes; see docs/OFFICE-RECORD-MANAGEMENT-ASSESSMENT.md.


## 10 November 2026: Office member management implementation

Prepared 046 for recorded-detail corrections, before/after confirmation, direct Office property linking through 037, current relationships and scoped history. Linking is bound to the selected member snapshot and independently reviewed; login email, roles/status, profile preferences, registered ownership and receipt access remain separate. Prepared 047 after an actual-constraint test caught invalid notification destinations in earlier 042/044. Seven member-service and four household/notification checks pass. Owner installs 046 then 047; no live records changed. See docs/OFFICE-MEMBER-MANAGEMENT-SETUP.md.


## 10 November 2026: inline member correction and property lookup guidance

Simplified Office member Edit details to direct Save changes/Cancel in the existing window; removed the separate review screen while preserving reason, audit and stale-snapshot protection. Clarified that property checking searches active imported lots and does not create records. Added a scoped Lot register link and owner-run counts-only diagnostic script for missing/withdrawn/mismatched candidates. No backend migration or live change for this UI adjustment.

### 11 November 2026: business form restoration through 059
The previous production forms are treated as real business requirements. Local implementation restores category-specific Helpdesk answers and Office assignment/priority/resolution, named household occupants, association/contact management, reviewed property attributes, structured booth vendor applications, additive listing/report/candidate questions, and candidate photos. Finance gains draft -> independent review -> post/reverse forms for rates, invoice-generating billing runs, explicit payment allocations, expense categories, expenses and monthly reported totals. New invoices are not yet connected to resident balances; no rates, payments, accounts or entitlements are seeded on install.

Connected carpool forms now sit alongside a separately labelled map demo. Shuttle adds private pickup notes and assigned-driver arrival estimates without extending its immediate-service deadline. Office can record Pending bookings for selected eligible residents without impersonating them. Garage sales have individual item publication/rejection/withdrawal; changing a public item sends it back to review. New accounting and item queues appear in the existing Office review inbox.

Prepared SQL: 048 through 059, in numeric order after 047. Owner instructions and browser checks: docs/BUSINESS-FORM-RESTORATION-SETUP.md. Current business coverage and remaining gaps: docs/LEGACY-FORM-COVERAGE-ASSESSMENT.md. This is a substantial restoration, not a claim of full business parity: bulk import management, some identity/delivery preferences, security hold/scheduling policy, association-rule maintenance, resident ledger integration and certified elections/disclosures remain explicitly tracked.

Checks: TypeScript/production build passed. Targeted ESLint passed for new restoration components/shared files and the metadata inventory script. An isolated synthetic in-memory SQL check compiled 048-059 and exercised selected actual service calls, protected refusal cases, public item privacy and the combined business inbox. Build retains dependency annotation and large-chunk warnings. No automated test suite, end-to-end browser run, axe sweep, live database connection, SQL application or deployment occurred. Owner mobile/desktop/Storage/real-role verification remains required.
### 11 November 2026: approved links, dev-module crash and customer address display
Owner confirmed the property link was saved as an approved household relationship. The supplied Console error identified a missing default export from PropertyBusinessDetails. Its disk source had the export, but a direct local Vite HTTP check returned an empty JavaScript module. The watch configuration now waits for file-write stability; the server restarted its transform cache and subsequent checks served expected exports for all four affected property/account modules. Office property attributes are now lazy-loaded only on Office screens. The error fallback no longer claims every session is a preview or that a preceding save made no change.

Customer Home and My account now prefer current approved linked-property addresses instead of reading only recorded member.unit text. Prepared migration 060 adds the caller-only read and the narrowly extended authorized preview read. It does not rewrite recorded addresses, create memberships, grant ownership/receipts or calculate balances. Multiple relationships to the same lot are grouped; staff customer summaries do not show association-wide lots. Hard-refresh both tabs after the owner applies 060; do not recreate the already saved link.

TypeScript/production build and targeted lint passed; existing build warnings remain. Isolated synthetic SQL checks passed for caller scope, revoked links, preview target and caller identity restoration. Local module HTTP checks passed; no browser automation, automated test suite, live database connection or deployment occurred. Setup and owner checks: docs/ACCOUNT-LINK-DISPLAY-RECOVERY.md.
### 11 November 2026: owner-approved household receipt policy and complaint form fix
Owner explicitly selected automatic visibility of all existing and future receipts for each current approved household link. Prepared migration 061 adds household-linked Finance view/own eligibility and extends the receipt predicate and optimized 036 history query. Active imports, active account, started/unexpired approved household membership, property visibility, configured access and explicit denials remain binding. Owner entitlements, approvals, exports and balance calculations remain separate. Overlapping owner entitlement/household access does not duplicate rows or totals. New history access is read dynamically; no receipts or memberships are seeded or modified on installation.

Customer Properties now labels the action Link another property when an approved own link exists. The complaint-screen crash was independently identified in the shared Field helper: a child array containing input/help text was cast to one element and child.props.id dereferenced. Field now locates the control safely, generates an ID where needed and associates labels/error descriptions while retaining helper children.

Checks: migration 061 compiled in isolated synthetic SQL; selected checks passed for past/new receipt visibility, unrelated lots, single-receipt/history agreement, export refusal, revoked/expired/future links, explicit Finance denial and duplicate-free overlapping paths. The actual Field function rendered locally with input/helper/error and generated-ID cases. No automated test suites, E2E browser runs or live database changes occurred. See docs/HOUSEHOLD-RECEIPT-ACCESS.md for rollout and owner verification. Owner must run 061 after installed 060, then refresh and verify live outcomes.