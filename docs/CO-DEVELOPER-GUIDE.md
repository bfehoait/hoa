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
- Garage sales form (20 November 2026): owner runs prepared migration 089
  after 085 (independent of 086-088). It removes Proposed audience and
  Contact email, makes Items optional and sets Title Case labels. Deploy the
  matching frontend after 089; until then the server rejects the new form.
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
