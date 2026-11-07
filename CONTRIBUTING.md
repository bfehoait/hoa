# Contributing

Read `AGENTS.md` and `docs/vault/Home.md` first. Keep work bounded to the authorized environment. Branch, commit and deployment actions require user approval.

Put shareable contracts and pure logic in `packages/shared/src`. UI belongs to route features or the owned component library. Keep CSS local with CSS Modules and reuse semantic tokens. Use synthetic fixtures only. An empty, unavailable, loading or failed state is part of a feature, not an optional follow-up.

Before handoff, run typecheck, lint, unit tests, relevant browser tests and production build. For visual changes, check phone and desktop widths in both themes. Record what ran in `docs/vault/Verification.md`. An automated accessibility scan does not replace keyboard, assistive technology or actual-resident testing.
