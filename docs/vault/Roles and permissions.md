# Roles and permissions

**Implemented locally, 5 November 2026** - Authenticated mode now verifies Supabase identity and looks up exactly one member by `user_id`; role claims in editable user metadata or email matching are not trusted. Active known main/extra roles determine frontend workspace choices. Unsupported/missing/duplicate/inactive memberships and policy errors deny entry. Developer capability, staff mapping, individual overrides, view-only semantics and operation-level authority remain unapproved/unimplemented. Existing source database RLS has not been verified. Explicit preview mode retains unrestricted synthetic inspection.


**Observed** — The supplied brief identifies admin/staff, homeowner, renter, board, security and driver; main plus extra roles, individual page overrides, and view-only behavior are requirements.

**Observed** — Explicit preview mode exposes resident and office screens for inspection without authentication. It grants no real authority. The Roles & access screen describes roles; it cannot change them.

**Unknown** — Super-admin definition, precedence of denies and grants, separation of duties, delegated access, household membership changes, export permissions and staff approval boundaries.

**Risk** — Browser navigation is never a security boundary. RLS, protected RPCs and refusal tests must enforce all actual policies before real data is introduced. See [[Security]].

**Planned** — [[Permission planning matrix]] proposes operation-level scopes and identifies unknown role powers for approval. It covers household, assigned-work, association, export, file, financial and protected-administration boundaries. Proposed role cells are not production grants. Review the combination/deny/view-only policy and its refusal cases before implementation; use [[Release acceptance]] to define evidence.


## Developer assignment and role views - 5 November 2026

The user approved a separate developer workspace and all-role synthetic previews for the two-person development team. `developer` is recognized as a distinct member role; existing `admin` membership and IT/job titles do not imply it. Owner assignment is a separate SQL action, supplied only in conversation. No source email allowlist, self-grant control, service key or database alteration was introduced.

Developer alone can open developer/profile/help/notification/workspace screens, but not office, board, driver, security or household operations as a real role. Additional approved member roles retain their own real workspace rights. The preview prefix is available only through the outer active-developer gate in authenticated mode. It supplies a synthetic inner identity with no extra roles; route checks and role-aware links use that selected role. Account changes are blocked; real identity/member refresh remains owned by the outer provider. Preview mode remains a synthetic inspection configuration rather than authentication.

Department capabilities, view-only/individual overrides, tenant financial responsibilities, protected operational monitoring APIs and database enforcement remain separate unapproved work. Current previews describe these limitations rather than inventing policy.

- 2026-11-26 HOA.xlsx: Helpdesk server routing is category plus capability based (Maintenance, Grievance, Board, Livelihood/IT). Team Helpdesk permits committee handlers without admin-role escalation; no people assignments are seeded. Board Concern/Idea and Support-only committee regressions passed locally. Booking payment confirmation requires calendar approval plus Finance approval; Security ID/plate and move checks require actual Security access. Follow-up scheduling and official payment configuration remain owner-run. See ../EXCEL-HOA-IMPLEMENTATION.md.

- 2026-11-27 workspace access redesign: shared Office/Board/Security/Transport/household module groups; radio access levels; explicit action permissions; server-reported effective access and rule sources; review then atomic save. Prepared migration 105 after 104; no automatic role/default grants, no BFE redeployment. Existing explicit denies, developer recovery, delegated authority limits and required workflow roles remain enforced. See ../WORKSPACE-ACCESS-EDITOR.md for exact rollout and role tests.

27 November 2026: Page access now shows all staff workspace buttons (Office, Board of Directors, Security, Transport), with assigned-role indicators and one page group visible at a time. Search spans groups. Role-only defaults remain role-specific. Switching workspace never assigns roles or saves permissions. Added explicit Office gate-pass approval action, distinct from Security ID/plate checks. Compact shared editor layout; server policy unchanged. This refinement needs frontend deployment only, no SQL rerun and no BFE redeployment. See docs/WORKSPACE-ACCESS-EDITOR.md for verification and manual checks.

27 November 2026 owner clarification supersedes earlier all-workspace buttons: Page access shows assigned workspaces only. Office-only -> Office; Office/Security/Board -> those three; homeowner adds household workspace. Published viewing and saved scoped exceptions are under collapsed Advanced permissions and never labelled as roles. Existing grants/role assignment/server checks unchanged. Homeowner business submission remains pending review; Carpool auto-publication unchanged. Frontend deployment only; no SQL/BFE redeployment. Updated acceptance guide: docs/WORKSPACE-ACCESS-EDITOR.md.

### 27 November 2026 - Protected Developer workspace reference

Added first-position protected Developer card for server-reported Developer user accounts; other workspaces are read-only references with current permission/source details. Removed misleading disabled edit controls and irrelevant Office delegation editor for protected targets. Footer communicates Page access protection. Staff search shows all assigned roles and the existing role filter on both entry points. Ordinary Office delegation and review/stale/pending protections retained. Frontend only; no new SQL or BFE redeployment. Full rollout/manual checklist: docs/WORKSPACE-ACCESS-EDITOR.md, Protected Developer view section. Recovery runbook and Role & status policy changes are separate scope.

### 27 November 2026 - Neutral permission disclosures

Workspace module Action permissions and Where this access comes from now share compact neutral bordered rows with shield/info icons and right-aligned open-state chevrons. Expanded content spacing, theme tokens, 48px targets and native keyboard interaction preserved. Finance approval reminder moved from summary into expanded content. Presentation only: no authority, RPC, SQL or schema change. Frontend rollout only; manual acceptance/commands in docs/WORKSPACE-ACCESS-EDITOR.md.

### 27 November 2026 - Compact access control panel

Shared editor now uses effective per-module action summaries, four-way module segments and three-way action radio segments with inline saved-status pills. General rule precedence appears once; module-specific source line and exceptional-source details replace repeated boilerplate. Grouped sections, flat action dividers, sticky tabs/search and unsaved footer count improve scanning. Editor-unique radio names fixed interference between concurrently mounted hidden defaults and member editors. No server permission/schema/RPC changes. Commands, rollout and manual checklist: docs/WORKSPACE-ACCESS-EDITOR.md, Compact permission control panel section.

### 27 November 2026 - Owner reference-style correction

Corrected independently sticky tabs/filter overlap using one toolbar with a portalled accessible filter. Compact module heading now carries saved current/source information; subordinate actions use mutually exclusive segmented toggles with no radio circles. Native full-sized input hit areas retain keyboard and pointer support. Six mocked browser cases reported ok, including normal review/save, protected references, role defaults, staff search and accessibility/overflow. Frontend only; rollout and manual checklist in docs/WORKSPACE-ACCESS-EDITOR.md, Reference-style refinement section.

### 27 November 2026 - Owner-selected checkbox permissions

Replaced segmented access/action controls with simple labelled checkbox rows and immediately visible subordinate actions. View and Allow changes preserve hidden/view/edit semantics; individual action checkboxes preserve allow/deny rules. Defaults and reset links, unknown-result indeterminate state, protected references, server authorization and review/save protections retained. Removed obsolete segment styles. Full commands, rollout and manual checklist: docs/WORKSPACE-ACCESS-EDITOR.md, Checkbox permission list section. Frontend only; no SQL/BFE redeployment.


## Visibility switch and action checkboxes - 27 November 2026

Current owner-approved control pattern supersedes the earlier two base checkboxes: one Tab visibility switch per module, action checkboxes below. Checking an action uses existing edit/allow rule values automatically and preserves other known unchecked actions. Visibility Off disables action editing but retains selections. Shared across assigned workspaces; Developer targets remain protected/read-only. No server/RPC/SQL or role-default changes. Review, reason, save, discard, stale/pending safeguards retained. See docs/WORKSPACE-ACCESS-EDITOR.md for mapping, checks and acceptance steps. Frontend rollout only; no SQL or BFE deployment.


## Hide actions while visibility is Off - 27 November 2026

The shared workspace access editor now renders action checkboxes only when the module visibility switch is On. Off removes the action group from the visible and keyboard-accessible UI; switching On restores it with the existing draft selections. Hiding does not delete or reset action rules. Protected Developer reference workspaces keep their read-only saved-access display. No RPC, schema, permission evaluator or SQL changed. All reason/review/save/discard/stale protections are preserved.

Validation commands: `npm.cmd run typecheck`; `npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx tests/e2e/auth.spec.ts`; `git -c core.safecrlf=false diff --check`. Focused isolated browser command: set `BELLEFORT_TEST_AUTH=configured`, `CI=1`, then `npx.cmd playwright test --project=chromium --grep 'workspace access groups modules|workspace access presents Developer|workspace role defaults'`. Results are recorded in the verification note.

Next steps: frontend deployment only when authorized; no SQL/migration rerun or BFE redeployment. No commit/push/deploy/live database changes. Manual check from Office Roles & permissions and Developer Access configuration: open an ordinary target, turn a module Off (no actions shown), On (actions shown), select an action, Off then On (selection retained), then review/save or discard. Check other assigned workspaces and mobile/light/dark. Developer targets must remain read-only. Production/physical-device acceptance is not locally verified.


## Quieter action source labels - 27 November 2026

Removed repeated From defaults text beneath every action in the shared access editor. The existing module-level saved-source line remains. Only an explicit action override shows Custom and its existing Reset to defaults link. Unknown inherited results still show Not reported; protected references and all permission/save behavior are unchanged. This is a presentation-only change, with no RPC, schema, SQL or permission changes.

Validation commands: npm.cmd run typecheck; npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx; git -c core.safecrlf=false diff --check. No additional browser/E2E run for this text-only cleanup. Manual acceptance: in Office Roles & permissions or Developer Access configuration, open an ordinary account/module with visibility On. Inherited actions should show just the action name and checkbox; customized actions show Custom and reset. Reset restores inheritance and removes Custom. Unreported values must remain clearly marked. Frontend deployment only when authorized; no SQL/migration rerun or BFE deployment. No commit, push, deployment or live database changes.


## 28 November 2026 ? stable permission checkboxes

Removed per-row circular reset controls; inherited-default resets remain inside a stable Default settings disclosure with existing authorization restrictions. Reset visibility no longer inserts a row above actions on first check. Unknown saved-access wording stays stable. Draft footer is compact, with reason/summary shown at the explicit Review step; final save still requires a reason. Duplicate footer Cancel/Unsaved labels removed; dirty-close/pending/stale protections remain. Four mocked Chromium cases completed successfully (390/1440 geometry including x/y/height, keyboard/sticky toolbar, individual reset/review/save plus axe, role-default save); 20 shared/permission tests, TypeScript/build, lint and diff-check passed. Windows runner stopped after completed cases; no live checks. No SQL/BFE redeployment; frontend only. Full commands and owner checklist: [Access layout follow-up](../ACCESS-LAYOUT-20261128.md).

## 28 November 2026 - single custom-access reset section

Removed repeated per-module Default settings; one collapsed Reset custom access section now groups existing overrides by module/scope. Permission and delegation rules unchanged. Office admins require Developer-granted access management and remain limited to their own authority. TypeScript, build/PWA, lint, diff-check and 20 permission tests passed; four mocked Chromium cases completed successfully (runner interrupted after completed cases). No live verification. No SQL or BFE redeployment; frontend only. Commands and focused owner checks: [Access layout follow-up](../ACCESS-LAYOUT-20261128.md).

## 28 November 2026 - access-management toggle

Shared Office/Developer access editor now uses a compact On/Off delegation setting. Reason and explicit confirmation appear only for a draft; cancel/toggle-back makes no request. Drafts participate in dirty/pending guards; failed confirmation retains input and shows an inline error. Existing Developer-only delegation authority and protected targets remain unchanged. Typecheck, lint, build, 20 permission tests, six focused Chromium cases and six role rendering audits passed (completed-case evidence; runners interrupted afterward). No SQL/BFE redeployment; frontend only. Commands and manual role checks: [Access layout follow-up](../ACCESS-LAYOUT-20261128.md).
