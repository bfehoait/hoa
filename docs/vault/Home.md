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
