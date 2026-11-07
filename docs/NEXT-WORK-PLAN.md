# Next work plan — Bellefort Estate Portal

Written 7 November 2026, Asia/Manila, for the agent continuing this rebuild.

This is a recommendation, not authorization. The boundaries in root `AGENTS.md` and
`docs/CLAUDE-HANDOFF.md` still govern every item below: no deploy, no push, no live
database connection, no reference code reuse, synthetic data stays labelled synthetic.

Read `AGENTS.md`, then `docs/CLAUDE-HANDOFF.md`, then `docs/UI-UX-FIX-LIST.md`
(UI-09 … UI-17 are the most recent pass) before starting any item.

## State as of this writing

Measured, not estimated:

- 67 `.tsx` files, 39 CSS modules, ~28,600 lines across `apps/web/src` + `packages`.
- Vitest 257/257 across 21 files. `tsc -b` clean. ESLint clean. `vite build` clean.
- Playwright: **62 passed / 14 failed**. The 14 are stale specs, not regressions —
  a set diff against the prior run showed 5 fixed and 0 newly broken.
- Action vocabulary now exists: `Button` (`tone` = primary | secondary | danger | quiet,
  `size`, `block`) and `ButtonLink` in `apps/web/src/components/UI.tsx`.
  214 `<Button>`, 12 `<ButtonLink>`, **48 raw `<button>` remaining**.
- Route-level code splitting is already in place (26 `lazy()` routes); the main chunk
  is 484 KB raw, Supabase 224 KB. No action needed here.

## Priority 1 — QA authenticated mode

**This is the largest blind spot in the project and nothing else should jump it.**

`apps/web/src/data/auth-config.ts:34` resolves the app into one of two modes, and
**30 files branch on `auth.preview` across 71 call sites**. Every visual check, axe
run and screenshot in the recent UI pass ran against *preview*. For the routes that
branch, the authenticated build renders different components, so those screens have
been verified by typecheck and lint only — including the developer console the owner
sends screenshots from.

What to do:

1. Enumerate the branch sites (`grep -rn "auth.preview" apps/web/src --include=*.tsx`)
   and reduce them to a list of *screens* that differ, not call sites.
2. For each differing screen, verify in authenticated mode at 390px and 1440px, in
   both themes, that the Priority 3 button work and the dialog chrome actually landed.
3. Run axe (`wcag2a, wcag2aa, wcag21a, wcag21aa`) on the same set.
4. Record counts in `docs/vault/Verification.md`. Append as UTF-8 — do not rewrite
   that file wholesale, it holds mixed encodings.

Two traps, both hit during the last pass:

- The app themes via `document.documentElement.dataset.theme`, **not**
  `prefers-color-scheme`. A tooling dark-mode emulation will silently render light.
- Vite serves edits live. Editing CSS while a Playwright run is in flight invalidates
  the whole run. Finish edits, then run.

## Priority 2 — the 14 stale specs

They were left failing deliberately. Making them green by rewriting assertions to
match current behaviour is exactly how a real regression gets buried, so each rewrite
must be justified in the commit note or fix list, not just made to pass.

Known causes, already traced:

- The largest cluster follows from `apps/web/src/features/services/Services.tsx:96`
  returning the connected `RequestDesk` for `/services/requests`, which makes the
  older fixture strings unreachable on that route.
- `"Report a concern"`, `"Synthetic old review"` and `"Sample community ride requests"`
  do not exist anywhere in source. Confirm the feature was intentionally renamed or
  removed before deleting the assertion.
- `/explore` renders two `role="status"` elements, so a strict single-match locator
  fails. That one is arguably an app bug, not a spec bug — decide which.

Rule of thumb: if the behaviour changed on purpose, rewrite the spec and say why.
If you cannot find the decision that changed it, the spec is reporting a real defect.

## Priority 3 — finish the action vocabulary

48 raw `<button>` elements remain. Not all are wrong — filter chips (`className="filter"`)
and icon-only controls are legitimately raw and already carry their own 48px sizing.
Triage rather than mass-convert:

| File | Count |
|---|---|
| `features/community/CommunityModules.tsx` | 4 |
| `features/more/Notifications.tsx` | 3 |
| `features/connected/BookingDatePicker.tsx` | 3 |
| `features/admin/Admin.tsx` | 3 |
| `features/account/Account.tsx` | 3 |

Convert anything that reads as a committed action; leave chips, toggles and
`aria-pressed` controls alone. The two in `components/UI.tsx` are the primitives
themselves and must stay raw.

Then sweep the dialogs for the `footer` prop — the sticky-actions CSS covers every
dialog, but dialogs that still render their actions inside `children` get the
fallback treatment rather than the proper footer.

## Priority 4 — data visualization on the request/issue workflow

This is the one genuine *feature* gap against the upstream reference. The reference
marks its `issues` surface with `icon:'chart'` for admin, board and homeowner roles;
the rebuild has no equivalent. `/services/requests` and `/office/requests` are the
emptiest desktop surfaces in the app.

Constraints that apply here specifically:

- Plain CSS and inline SVG. No chart library, no Tailwind, no component kit.
- One y-axis. Never a dual-axis chart.
- Sequential magnitude = **one hue, light → dark**. The four `--chart-aging-*` tokens
  in `styles/tokens.css` already follow this and should be reused rather than replaced.
- Status colors (`--green`, `--amber`, `--red`) are reserved for state and must not
  double as series colors.
- A legend is present for two or more series; identity is never color-alone.
- Validate any new categorical palette rather than eyeballing it.

Also queued from the last review: the two-slice donut should be a meter — a donut
with two segments is a worse bar chart.

## Priority 5 — surfaces that need layout work

- **`/explore` is 11,692px tall on mobile**, roughly 14 screens of scroll. It is the
  worst UX surface in the app by a wide margin. Needs sectioning or progressive
  disclosure, not more styling.
- **`/admin` and `/office/finance` render byte-identically.** Decide whether that is
  intentional consolidation or an unnoticed duplicate, then make the answer explicit
  in `docs/vault/Decisions.md`.

## Priority 6 — only if you are already in the file

Four files are large enough to slow down every future change:
`features/baseline/FeatureBaseline.tsx` (1,120), `packages/shared/src/baseline.ts`
(1,027), `features/registry/LotRegister.tsx` (973), `features/transport/Shuttle.tsx` (922).

Do **not** open a decomposition task. Split only what you are already editing for
another reason. A refactor with no behavioural goal is how a working rebuild acquires
new bugs.

## What "gold standard" means for this codebase

Concretely, and in the order they bind:

1. **Verify before asserting.** Counts come from a command that ran to completion,
   not from a log still being written. If a number is unverified, say so.
2. **No rewrite, no reinstall, no deploy.** Continue the existing architecture.
3. **Mobile first**, 16px body, ≥14px secondary, 48px controls, visible focus,
   reduced-motion and safe-area support. These are not preferences.
4. **WCAG 1.4.11** for control boundaries (3:1), not just 1.4.3 for text (4.5:1).
   A danger button whose border is a soft tint has no perceivable edge.
5. **Preview mode is not authentication.** Never describe it as enforcement, and
   never let a resident-side control set payment status, role, approval or tally.
6. **Report limits honestly**, including what was not checked. The useful half of a
   handoff is the part that says where the holes are.

A resident-facing UX review with the same evidence discipline is in
`docs/UX-IMPROVEMENTS.md`. Its first three items (empty-state actions, error-vs-empty,
mobile input attributes) are low effort and high impact.
