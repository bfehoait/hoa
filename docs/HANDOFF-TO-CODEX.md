# Handoff — 9 November 2026

> Current follow-up: [Resident access and onboarding](RESIDENT-ACCESS-FOLLOWUP.md) corrects stale claims below and documents migration 023, guarded synthetic configuration, and the registration schema check. Historical statements below are not live verification.

For the agent picking this up. Written by Claude after sessions on 7 and 9
November. Read `AGENTS.md` first, then this, then the documents it points to.

## Read this part before anything else

**The workspace is no longer a separate rebuild.** `git remote -v` is
`https://github.com/bfehoait/hoa.git`, branch `main`, 128 commits back to
10 September, with the rebuild committed in as "Replace legacy portal with
rebuilt Bellefort application". AGENTS.md lines 3–5 still describe a separate
local rebuild that must never touch Kate's repo and must not be committed to.
Those lines are stale. The owner made that change deliberately; **confirm the
current boundaries with them before committing or pushing anything.**

## How the owner wants to work right now

Stated on 9 November: **no automated test suites, no e2e, no axe sweeps.** They
test in the browser themselves for speed. They still want to be told what is
unverified. Typecheck after an edit is worth keeping — it is seconds and stops
them making a browser trip to discover a compile error.

They have found several real defects this way. Their reports are accurate; when
they say something is broken, investigate before explaining why it is fine.

## Where the system stands

- **5 routes** still show "Not available yet": `/office/registry`,
  `/office/history`, `/office/settings`, `/explore/imports`,
  `/explore/calculator`. None are resident-facing.
- 42,912 lines of TS/TSX/CSS across 177 files; 3,197 lines of SQL in 22
  migrations; 87 server functions.
- Confirmed working by the owner on real data: permits, vehicle requests,
  helpdesk, marketplace, the homeowner home summary.
- **Everything built after 7 November midday is unverified by anyone.** That
  includes record cards, modal fixes, Settings, the map, incidents, board
  reports, status strips, item rows, the dark-mode repair, the calendar
  day-picker, and all of the 9 November access-screen work.

## Pending, waiting on the owner

**SQL not confirmed run.** Migrations 017–019 were run (owner showed results).
These were not:

- `202611070020_incidents_and_board_reports.sql`
- `202611070021_retire_duplicate_modules.sql`
- `202611070022_board_summary_access.sql`
- `supabase/seed-test-configuration.sql` — three placeholder facilities. Until
  this runs, facility booking, the merged calendar and the office approval side
  cannot be tested at all.

**Decisions only the association can make**

- **Super admin.** Their matrix gives it profile, support and hotlines only.
  `bfe_legacy_can_for` returns true for everything when the developer role is
  present. See `docs/PERMISSION-MATRIX-CHECK.md`. Do not narrow this without an
  explicit instruction — it would withdraw access from the administering
  account.
- Dues rates and billing periods — billing does not exist without them.
- Whether a gate pass for materials is the same record as a visitor pass.
- The real shuttle station list (12 stations were requested; names unknown).
- A driver auth account, which unblocks both the resident shuttle screen and
  `/driver/dispatch`.

## What the assessments found

Four documents, all measured rather than estimated:

- **`docs/FIELD-GAP-ASSESSMENT.md`** — the reference asks 214 questions, this
  system asks 192, and they are not the same ones. Biggest gap: **resident
  self-registration does not exist.** The `public.registrations` table is
  already there with every column; nothing reads or writes it, so a new
  resident cannot apply and accounts are made by hand in SQL.
- **`docs/REDUNDANCY-ASSESSMENT.md`** — eleven feature modules duplicate a
  dedicated table's purpose; seven screens carry preview-only twins where a fix
  to one half does not reach the other.
- **`docs/ROLE-READINESS.md`** — per role, what is connected, preview-only or
  missing. Note the distinction: a screen reading `usePortal()` or
  `useWorkspace()` **throws** for a real account and can never work signed in.
- **`docs/PERMISSION-MATRIX-CHECK.md`** — the association's committee matrix is
  already implemented correctly: 12 committees, 204 workbook rows, base grants
  all matching.

## Mistakes worth not repeating

**A `CREATE OR REPLACE` is only safe against the newest definition.** I replaced
`bfe_can_for` with a body copied from migration 004 without noticing migration
**014** had redefined it as the tab-rule layer delegating to a new
`bfe_legacy_can_for`. That would have silently removed configurable tab access
from production. Four tests caught it. Always check which migration last
touched a function.

**Two gates, not one.** `resident_create` on a feature definition is necessary
but not sufficient; `bfe_can(capability,'create','own')` must also pass. I
reported vehicles and permits as working after flipping only the first.

**Verify by using, not by running.** 315 passing tests did not catch: a Save
button that looked broken because its required reason was off-screen, 26 of 28
empty states with no way forward, or a link that worked once and then never
again because `useState` reads a URL parameter only at mount. The owner found
all three in minutes.

**The monitor does not expose `user_id`** — only `has_auth_link`. That is
deliberate. Do not widen it to make a link convenient.

## The next things I would do

1. **Resident self-registration.** The table exists. This is the system's
   missing front door and everything else is downstream of it.
2. **Run the pending SQL**, then walk one booking end to end.
3. **Test a permission boundary.** Nothing in this project has ever confirmed
   that a resident is refused an office screen, or that one household cannot
   read another's records. Real residents are now onboarded.
4. The remaining field gaps in `FIELD-GAP-ASSESSMENT.md` section 2 — each is a
   few lines in `packages/shared/src/baseline.ts` plus a definition update.
5. The access screen still holds three permission editors speaking three
   different languages. `docs/UI-UX-FIX-LIST.md` UI-38 describes what replacing
   them with named tasks would mean.

A running record of every change, with what was verified and what was not, is in
`docs/UI-UX-FIX-LIST.md` (UI-18 through UI-38) and `docs/vault/Verification.md`.
