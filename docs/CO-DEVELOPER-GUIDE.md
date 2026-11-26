# Co-developer guide

Current owner authorization: 16 November 2026, Asia/Manila.

## Start here

Read root `AGENTS.md` and, when using Claude, root `CLAUDE.md`. They apply to
all assistants and co-developers equally. The owner authorizes implementation
and validation of requested work locally. Claude may finish wiring and fix
behavior as well as design; Codex approval is not a prerequisite.

Inspect the current Git branch/status, relevant implementation, shared contracts
and current vault notes before editing. Keep unrelated owner/co-developer edits.
Do not assume the active branch is main or that GitHub contains local changes.
Older dated handoffs are historical context, not a permanent UI-only restriction.

## Local workflow

1. Trace the actual route, component, data reader, mutation and server permission
   boundary involved in the request. Inspect existing behavior before replacing it.
2. Implement the requested result and related necessary fixes. Reuse shared UI,
   tokens, schemas and handlers. Preserve loading/error/empty states and dirty,
   pending, stale-version and idempotency protections.
3. Review substantive changes and run proportionate local validation. Fix relevant
   failures instead of ending at a suggestion to have another assistant finish.
4. Update the relevant docs/vault notes. Clearly distinguish local checks,
   owner-reported results and live behavior you have not verified.
5. State the rollout requirements: frontend deployment, exact new SQL migrations,
   and whether `bfe-create-account` needs redeployment. Do not perform rollout
   without explicit authorization.

Routine local development/checks are already authorized. Seek missing business
policy or data when it changes correctness, not generic permission to edit.
Continue independent work while a necessary clarification is pending.

### Assessment, then go

If the owner says "assessment only," "wait for my go signal" or "do not edit,"
inspect and explain without changing implementation. When the owner says "go,"
"proceed," "do it" or equivalent, that authorizes execution of the agreed scope.
Start the implementation; do not ask whether to begin again. Complete related
necessary fixes, wiring review and local validation instead of handing only a
plan to another assistant. A UI draft is a design direction, not an instruction
to remove existing features that the draft omitted. Fit existing authorized
controls into the design and keep permissions intact.

Claude has the same freedom as Codex to edit/refactor relevant components,
styles, shared logic, validation and prepared backend changes to fulfill the
task. It may fix a genuine discovered defect within scope rather than leave it
because it is "not just CSS." Avoid unrelated redesigns or policy inventions.
Explain material behavior changes and any uncertainty; a genuine live-operation
boundary still needs explicit authorization before crossing it.

## Validation on Windows / PowerShell

Use scripts in `package.json`; these are existing commands:

```powershell
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Target ESLint at files changed in the task. Run relevant Vitest files for logic
and regression changes after checking they use synthetic fixtures/mocked services.
Avoid treating a global lint/test failure unrelated to the task as a reason to
discard the owner's implementation or silently bypass checks.

Before browser/E2E/axe runs, inspect `playwright.config.ts`, fixtures, environment
handling and network setup. A localhost frontend can still use live Supabase.
Only run under standing authorization when the server is verified local and its
services are mocked or isolated, using synthetic data. Otherwise prepare the
check and report the remaining owner verification; do not enter live credentials,
create production accounts/bookings or mutate real records.

Account creation/linking changes have an additional mandatory gate:

```powershell
npm.cmd run check:account-integrity
```

Read `docs/ACCOUNT-CONNECTION-INTEGRITY.md`. Regenerate the manual Edge editor
artifact when its source changes, then validate it. Preserve atomic Auth/member
linking, explicit `member_linked` success, idempotent requests and independent
server permissions. Never claim an existing member solely by matching email.

Do not report browser/device/live authorization checks as passed based only on
typecheck/build. Do not run a full suite for a small documentation edit.

## Shared UI and authority

Keep React 19, TypeScript, React Router, TanStack Query, shared zod schemas,
Lucide icons and token-based CSS Modules. No Tailwind or component kits.
Keep mobile 16px body/input text, 14px minimum secondary text, 48px controls,
focus management, reduced motion and safe areas. Match the compact desktop
typography tokens and existing shared form/action patterns.

Protected workflows are editable locally, with their guarantees intact. Server
permission checks own approvals, roles, payments and tally authority. Preview
and client controls do not grant it. Use synthetic records for all local checks;
never copy real names, credentials, tokens or imported private data into source,
fixtures, logs or screenshots.

## Current context and open items

- `docs/BOOKING-APPROVAL-CHARGES.md`: approval/Other-balance behavior and 083-085.
  Owner reported applying 084/085 and seeing the charge on the homeowner account.
  Do not rerun migrations from an old pending checklist without checking status.
- Reservation fee credit versus an extra charge remains an HOA policy question.
  Do not silently default it into a duplicate charge or assume it is waived.
- Carpool admin notice, no approval (26 November 2026): owner runs prepared
  migration 099 after 098 (073 and 098 are live). Every carpool post notifies
  active admins (not the poster) with poster name/unit, offer or request,
  title and departure date, linking to `/office/review/carpools`; admins get
  this instead of the resident notice. A carpool can no longer wait for office
  approval: no consent or a date outside today to +1 year is refused with a
  message (previously left Submitted). The live readiness check found the 096
  triggers missing (096/097 never ran live; 098 only replaced functions), so
  carpools were still waiting for approval. 099 therefore (re)creates both
  triggers and publishes carpools still waiting with consent and a date from
  today to +1 year (homeowner+renter, no notifications), like 097. 096 and
  097 do not need to be run.
  Other homeowners/renters are told "A neighbour is offering a carpool" or
  "A neighbour needs a carpool" with title and departure date.
  Frontend: carpools are removed from the office approvals inbox and badge
  counts; the office carpool page is history only (no pending toggle, no
  "Review submission"; only "Withdraw carpool" on a published one); form
  limits the date range; notification allowlist adds `/office/review/carpools`. Deploy the
  frontend together with 099 (otherwise admin notices are skipped in the
  bell). No BFE redeployment.
- Carpools for renters (25 November 2026): owner runs prepared migration 098
  after 097. The live database was found not to have 073 (no `audiences`
  column), so 096's trigger made qualifying carpool posts fail; 098 fixes this
  and works with or without 073. New carpools get audiences {homeowner,renter}
  only where the column exists; renters are notified only where 073 is live.
  Where 073 is live, current 096/097 carpools still homeowner-only are widened
  to renters; office-published carpools keep their audience. Renters see
  carpools only once 073 is live. Owner applied 073 live (25 November 2026)
  after a read-only readiness check, then reran 098 (idempotent) to widen
  carpools posted while 073 was missing; checks all true. 073's functions are not
  redefined by any later migration. Form wording updated.
- Older pending carpools (25 November 2026): owner runs prepared one-time
  migration 097 after 096. Carpools still Submitted/In review/Reviewed with
  consent and a departure date from today up to a year ahead are published to
  homeowners (same rule as 096); no notifications are sent. Others are left
  unchanged. No frontend change.
- Carpool auto-publish (25 November 2026): owner runs prepared migration 096
  after 095. Carpools submitted with consent and a departure date from today
  up to a year ahead are published to homeowners immediately (no office
  review), expire at the end of the departure date, and every other active
  homeowner gets a bell notification opening `/directory/transport`. Home shows
  a "New carpools" card. Verify with
  `SELECT to_regprocedure('public.bfe_carpool_notify_homeowners()') IS NOT NULL;`
  (expect true) before deploying the matching frontend.
- Office area roles (24 November 2026): owner runs prepared migration 095
  after 094. Finance, Grievance and Maintenance become member roles (main or
  additional) limited to their area, alongside the 094 committees. Verify with
  `SELECT to_regprocedure('public.bfe_assigned_roles_for(uuid)') IS NOT NULL;`
  (expect true) before deploying the matching frontend. New accounts are still
  created with the original roles (no BFE change); change the role afterwards.
- Committee area access (24 November 2026): owner runs prepared migration 094
  after 093. Finance, Grievance and Maintenance stay access committees (not new
  roles): default committee rules give Finance the finance area and
  Grievance/Maintenance the Help desk, and Grievance/Maintenance members only
  handle their own categories unless given wider Help desk access personally.
  Verify with
  `SELECT to_regprocedure('public.bfe_request_category_allowed_for(uuid,text)') IS NOT NULL;`
  (expect true). People need the admin role plus the committee assignment.
- Document view and download requests (24 November 2026): owner runs prepared
  migration 093 after 092. It adds the `bfe_community_documents` reference
  list (17 documents), download requests with admin approval (7-day download
  window), `/more/documents` notifications, and renames "Member's Right to
  Inspect" to "Right to Inspect" (definition and saved documents). Verify with
  `SELECT to_regclass('public.bfe_document_download_requests') IS NOT NULL;`
  (expect true) before deploying the matching frontend; until then the
  documents page cannot load request status.
- Mandatory document downloads (23 November 2026): owner runs prepared
  migration 092 after 091 (download history table, admin notifications to
  `/office/documents`, history function). Verify with
  `SELECT to_regclass('public.bfe_document_downloads') IS NOT NULL;` (expect
  true) before deploying the matching frontend; until then downloads fail with
  "This service is not available yet". The PDFs in
  `public/documents/mandatory` are SAMPLE placeholders, regenerated with
  `node scripts/generate-mandatory-samples.mjs`; replace them with approved
  files of the same names.
- Pass approvals (21 November 2026): owner runs prepared migration 091 after
  090. Visitor and small delivery passes are approved automatically on
  submission; gate passes stay Pending for admin approval and appear for
  security staff without approve permission only once approved. Verify with
  `SELECT pg_get_functiondef('public.bfe_create_community_pass(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text,text,integer,text)'::regprocedure) ILIKE '%Approved automatically%';`
  (expect true) before deploying the matching frontend.
- Visitor passes (21 November 2026): owner runs prepared migration 090 after
  089. It removes the 24-hour maximum from the table rule and from
  `bfe_create_visitor_pass` so passes can span several days (start within 90
  days, end after start, unchanged). Deploy the matching frontend after 090;
  until then multi-day passes are rejected.
- Garage sales form (20 November 2026): owner runs prepared migration 089
  after 085 (independent of 086-088). It removes Proposed audience and
  Contact email, makes Items optional and sets Title Case labels. Deploy the
  matching frontend after 089; until then the server rejects the new form.
- Jobs & referrals (20 November 2026): owner runs prepared migration 088 after
  085 (independent of 086/087). It removes the One-off job type, makes pay
  optional, and caps each job listing's expiry at the end of its application
  deadline day (Asia/Manila), including already published listings. Deploy the
  matching frontend after 088.
- Buy & sell categories (19 November 2026): owner runs prepared migration 087
  after 085 (independent of 086) to replace the buy-sell Item category options;
  deploy the matching frontend after 087. Earlier listings keep their old
  category until edited.
- Community documents (19 November 2026): owner runs prepared migration 086
  after 085 to replace the board-records Record category options with
  "Mandatory Documents" and "Member's Right to Inspect"; deploy the matching
  frontend after 086. Earlier documents keep their old category until edited.
- `docs/DESKTOP-DENSITY-INBOX.md`: Inbox, Helpdesk and shared Announcements UI.
- `docs/LOADING-SKELETONS.md`: shared loading/image behavior.
- `docs/ACCOUNT-CONNECTION-INTEGRITY.md`: protected account workflow.
- Latest `docs/vault/Verification.md` and `Architecture.md`: actual checks/context.
- Owner supplied Vercel production screenshot for commit `3eee881` but reported
  an older UI in the browser. Cache was a hypothesis, not a confirmed diagnosis.
  Exact `/portal` iframe behavior still needs verification.

Read reference source only within the exception in `AGENTS.md`. Do not execute,
import, copy assets/design from, edit or connect to that reference application.

## Handoff checklist

Report changed behavior/files, checks actually run, unresolved issues/policies,
and exact remaining rollout actions. Note any actual permission/tool blocks.
Keep uncommitted work reviewable; do not commit, push, deploy, publish, send
external messages or change live database/hosting state without authorization.
Repository authorization does not override Claude/Codex tool permissions or
platform rules; explain those separately if they block a step.

Use this handoff structure, scaled to the task:

1. **Changed:** behavior and the relevant files, including any wiring changes.
2. **Checked locally:** exact commands and results; state skipped/unavailable
   checks accurately. Do not equate a successful build with a production test.
3. **Developer next steps:** commands ready for the intended shell, exact new
   migrations in order (only ones not already applied), required settings and
   frontend/BFE deployment needs. Give commit/push steps only when requested,
   using the actual current branch; never assume a stale local main is current.
4. **Manual verification:** role, screen, action and expected result. Include
   relevant loading/empty/error cases, permissions, repeated submission and
   stale/dirty states. For UI, include phone/desktop and both themes. For financial
   changes, verify exact amounts and no duplicate charge using authorized test
   data; production data changes remain owner-authorized actions.
5. **Still open:** bugs, missing policy decisions, tooling blocks and what has not
   been verified. Explain which next steps must wait for a decision.

Use concrete existing commands or real file names in copyable code blocks.
Do not put shell-invalid placeholders such as `git add <file-paths>` in commands
the owner may paste. Do not request credentials or include private data in the
handoff. For the public GHL portal, verify its updated iframe separately from a
direct Vercel page when that target is in scope; never claim both passed based
on a production deployment screenshot alone.
