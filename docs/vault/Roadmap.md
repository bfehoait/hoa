# Roadmap

**Observed** — Current work is a separately authorized local frontend preview. It is not a claim that the original M0–M3 production milestones have been completed.

Local implementation: modular React/TypeScript, owned design tokens/components, responsive resident and office views, validated local workflows, financial calculations, sample exports, PWA app assets, automation scripts, browser/unit checks and evidence notes. See [[Feature inventory]] and [[Verification]].

**Planned** — Answer [[Product questions]], approve a vertical backend slice, set up a separate dev project, add migrations and refusal tests, integrate real authentication, then implement registration and server-confirmed resident account records. Proceed feature by feature after rules are approved. No data migration, GHL integration, cutover or native store deployment is started.

**Unknown** — Resident acceptance. Before calling a flow ready for residents, 3–5 actual residents aged 60+ must use it unaided on their own phones.

## Full-system planning

**Observed** — The full proposed delivery sequence is now in [[Master implementation plan]], with screen treatments in [[Screen and interaction plan]], access proposals in [[Permission planning matrix]] and test/release gates in [[Release acceptance]]. P0–P9 are future planning phases, separate from the original milestone labels; none is a new completion claim.

**Planned** — First review scope, navigation/screen-state maps and the effective-permission proposal. A subsequent authorized local visual pass can design the missing authentication, registration review, office queues and detail screens using synthetic fixtures. This is distinct from implementing real auth or backend authority. The proposed first connected release is P1–P3: secure accounts, verified registry/registration, billing and recorded payments, concerns and notices. Optional modules follow only when included in approved scope.

No new implementation phase starts solely because this plan has been written. Dates and effort estimates remain unknown until release scope, business dependencies and staffing are confirmed.

## Expanded local implementation

**Observed** — After the plan, the user authorized implementation and requested developer-maintenance settings. The expanded local visual/workflow scope now includes preview access/exit, synthetic registration/review, office queues and property dossiers, local request assignment, sample expense review, draft-to-resident preview announcements, role-specific workspaces, calendar, extended services and developer tools. See [[Feature inventory]], [[Developer maintenance]], `docs/START-HERE.md` and [[Verification]].

**Unknown / still pending** — Production P1–P9 acceptance. A screen or local review does not complete real auth, atomic approval, memberships, RLS, financial verification, delivery, secure documents, backup/restore, resident pilot or release. The concrete next steps for the owner are in `docs/START-HERE.md`; no live connection or deployment occurred.

**Observed** — The later GitHub reference request added a read-only snapshot and [[Source coverage ledger]], including a browser-safe developer catalogue. Detailed livelihoods, dispatch/carpools, import/review mappings and messaging are now explicitly tracked gaps, not silently marked complete. No source values or real records were migrated.
