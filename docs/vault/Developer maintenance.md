# Developer maintenance

**Observed** — The user explicitly requested developer-specific maintenance settings. `/developer` now provides local diagnostic metadata, a real session-storage probe, scoped synthetic fixture resets with confirmation, state-test links, shared component examples and a maintenance runbook. It is linked from resident preview settings and office administration, not added to the resident’s primary task navigation.

**Observed** — Safe diagnostic export uses an allowlist and excludes personal fields, record content and environment values. Reset affects one or both local fixture sets only. Damaged workspace data can be recovered independently of resident sample records. No tool executes SQL, grants access, settles a bill, changes hosting or exposes a credential.

**Risk** — This route is inspectable and has no real authentication. Before any real system ships, decide which development tools should be excluded and enforce approved maintenance capabilities server-side for sensitive operations. Developer maintenance is not an automatic seventh HOA role, a defined super-admin permission, or an exemption from RLS/audit.

**Planned** — Approved production identity/capability checks, environment isolation, monitored jobs, actual backup/restore/rollback evidence, controlled migrations and safe operational logging belong to future backend/release work. These tools are not claimed to implement those systems.

Read `docs/DEVELOPER-MAINTENANCE.md` for commands, reset behavior and the future production runbook. Read `docs/START-HERE.md` for user instructions, [[Security]] for boundaries and [[Verification]] for actual results.

**Observed** — `/developer/source` adds a searchable sanitized catalogue of the authorized repository snapshot. It exposes source identifiers/line numbers, feature families, field names and gaps—not code bodies, credentials, personal records or approved policy. The raw reference folder is read-only, ignored and blocked from HTTP serving. See [[Source coverage ledger]].
