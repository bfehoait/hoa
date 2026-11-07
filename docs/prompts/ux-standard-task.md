# Task prompt — define and measure the UX standard

Paste the block below to Codex as a single task. Written 7 November 2026.

---

You are continuing an existing local rebuild at `D:\GHL\Bellefort Estate Portal`.

Read root `AGENTS.md` first, then `docs/CLAUDE-HANDOFF.md`, `docs/NEXT-WORK-PLAN.md`
and `docs/UX-IMPROVEMENTS.md`. Those boundaries bind this task: no commit, push,
deploy, live database connection or store submission; no reference code reuse from
`reference/upstream-hoa`; synthetic records stay labelled; preview mode is never
described as authentication; no credentials or real personal data in any output.

## What to produce

One new file, `docs/UX-STANDARD.md`. It has two halves and both are required.

**Half one defines the bar.** Not a list of current defects — a standard this app can
be measured against next month and next year.

1. **State matrix.** Enumerate every route. For each, define required behaviour for
   six states: loading, empty, error, partial, success, permission-denied. Say what
   the resident sees and what they can do in each. This is the spine of the document.
2. **Role journeys.** For each of the six roles, write the three tasks that role
   actually opens the app to do. For each task give the entry point, the steps, and a
   success criterion that is observable — not "the flow is clear" but "a first-time
   user completes it without leaving the screen or opening help".
3. **Accessibility bar.** Automated axe coverage is the floor, not the standard.
   Define the manual checks too: keyboard-only completion of each journey, tab order
   matching visual order, screen-reader labels that are meaningful rather than merely
   present, 200% zoom, and one-handed phone use. State which tool or method verifies
   each line.
4. **Performance budgets.** Numbers with a measurement method: time to interactive on
   a mid-range phone, list rendering at realistic record counts (not the small
   synthetic sets currently in fixtures), and behaviour on slow or intermittent
   connections.
5. **Content and voice guide.** Rules for button labels, error messages, confirmations,
   dates, currency and second-person address. Include how the mandatory synthetic and
   preview labelling is worded and where it is placed, since that labelling is
   required and cannot be dropped — only made less repetitive.

**Half two measures the current app against half one.** Produce real numbers: how
many cells of the state matrix are filled, how many journeys pass their criterion,
which accessibility lines are verified and which are unverified, which budgets are
unknown. A cell you did not check is recorded as unchecked, never as passing.

## Method rules

- **Measure, do not estimate.** Every number comes from a command that ran to
  completion. If you cannot measure something in this environment, record it as
  unmeasured and say what would be needed.
- `apps/web/src/data/auth-config.ts:34` splits the app into preview and authenticated
  modes, and 30 files branch on `auth.preview` across 71 sites. State which mode each
  measurement was taken in. Preview-only numbers do not describe the authenticated app.
- The app themes via `document.documentElement.dataset.theme`, not
  `prefers-color-scheme`. Emulating dark mode any other way silently renders light.
- Vite serves edits live. Do not edit source while a Playwright run is in flight; the
  run is invalidated. Finish edits, then run.
- `docs/vault/Verification.md` holds mixed encodings. Append as UTF-8; never rewrite
  it wholesale.
- Known stale: 14 Playwright specs fail against the current UI. They are stale specs,
  not regressions. Do not treat their failures as app defects without checking
  `docs/UI-UX-FIX-LIST.md` first.

## Scope boundary

**Do not fix anything in this task.** No remediation, no refactors, no spec rewrites.
The deliverable is the standard plus an honest measurement of the gap. Fixing is a
separate task with its own authorization, and mixing the two makes the measurement
untrustworthy.

If you find a defect serious enough that it should not wait, name it in the document
under a clearly marked section and leave it unfixed.

## Acceptance criteria

The task is done when:

- `docs/UX-STANDARD.md` exists with all five definition sections and the measurement half.
- Every claimed number can be reproduced from a command recorded in the document.
- Unmeasured items are labelled unmeasured, with the reason.
- The measurement states which app mode it covers.
- `docs/vault/Verification.md` has a dated UTF-8 append summarising what was measured.
- Nothing in the working tree changed except the new file and that append.

Report at the end: what you measured, what you could not, and the single number you
are least confident in.
