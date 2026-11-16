# Bellefort working rules

Read and follow `AGENTS.md`. It is the shared rulebook for this workspace.

## Owner authorization — 16 November 2026

You are authorized to carry out the owner's requested local development work,
not merely suggest changes or perform a presentation-only pass. You may edit
implementation, shared logic/schemas, backend source, tests and documentation;
prepare SQL migrations; inspect the existing wiring; and fix relevant defects.
Read `docs/CO-DEVELOPER-GUIDE.md` for current context and validation commands.

Run proportionate local checks and fix relevant failures before handing work
back. Typecheck frontend edits. Targeted unit/component tests and local browser
checks with synthetic data and mocked/isolated services are authorized under
`AGENTS.md`. You do not need approval from Codex or repeated owner confirmation
for ordinary local implementation and validation. Preserve unrelated changes.

An older handoff saying "UI only," "no tests" or "Codex will do the wiring"
describes an earlier task, not your current permanent scope. Use the latest
owner request and current shared rules. Preserve protected account/permission/
financial invariants and run their required checks; protection does not forbid
repairing them locally.

Do not commit, push, deploy, publish, connect to a live database, run live SQL
or change production accounts/records without explicit owner authorization.
Never infer HOA policy or claim a check passed when it was not performed.
If your own environment requires tool approval, explain the actual restriction;
this document does not override platform permissions.

## When the owner says go

Honor assessment-only or wait instructions. After "go," "proceed," "do it" or
equivalent implementation authorization, start building the agreed change.
Continue through necessary code/wiring fixes, local review and validation;
do not return another plan or require Codex review before making progress.
Use your judgment for routine local implementation decisions. Keep the owner
informed during longer work and continue independent work while awaiting any
genuinely necessary business-policy clarification.

Finish with a usable developer handoff: what changed, actual checks/results,
remaining risks, exact commands and SQL order, what to deploy (including whether
BFE redeployment is required), and what roles/screens to manually test with
expected results. Do not perform production actions without authorization.
