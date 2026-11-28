# Workspace access editor

27 November 2026. Local implementation; no live SQL, deployment, commit or push performed.

## Behavior

Roles & permissions and Developer Access configuration now share the same editor:

- Individual editors show only workspaces matching assigned roles. Office alone shows Office; Office + Security + Board shows those three; a homeowner role adds the household workspace. One workspace's pages are shown at a time. Published-content viewing and saved scoped exceptions appear under collapsed Advanced permissions, with scope labels rather than role labels. Existing scoped exceptions appear under Additional access. Office-area roles use the Office group; committee defaults use the same module catalog.
- Each module has one mutually exclusive choice: No access, View only or Manage. Use defaults removes that subject's module override. Manage covers routine create/reply/status changes; it does not silently grant approval, publishing, export or other protected actions.
- Action permissions expose relevant approval, payment verification, publishing, work assignment and management choices separately: Use defaults, Allow or Block.
- Shared backend modules stay shared: for example, changing Security's property module also affects that same property permission in Office. The editor explains this instead of pretending each navigation link is an independent server permission. Review inbox is derived from its individual review modules. Access management is delegated separately.
- Saved current access and the role/committee/individual rules behind it are returned by the server. A draft does not pretend to be effective access. Review changes lists the requested changes, then Confirm and save persists them atomically and refreshes current permissions.
- Group defaults are separate from individual exceptions. Assigning a role inherits its configured defaults; assigning Office/admin does not automatically grant every action. No new defaults or people assignments are seeded by migration 105.

## Server protections

Migration 105 adds audited action rules and extends the existing permission resolver. No action rule may configure developer/technical recovery, account access delegation or protected profile services.

Inactive/unlinked accounts remain denied. Explicit existing committee deny grants win. No access and View only block changes even when an action is set to Allow. An allowed action also needs module viewing access; service-specific required roles, committee-category limits, receipt checks and independent workflow checks remain in force.

Individual action overrides take priority over role/committee action defaults. Among inherited action defaults, Block wins. Module-default precedence remains unchanged. Developer recovery access cannot be removed. Delegated access managers cannot change protected accounts or grant rights they do not hold. As in the existing tab editor, restoring a saved restriction to inherited defaults requires a developer; the UI explains and disables that reset for other managers.

The save RPC checks the complete expected rules/actions snapshot under locks, rejects stale edits, audits the change reason and returns refreshed server results. Role/committee assignment changes refresh the editor cache. Preview remains read-only. These are authorization controls, not client-side role simulation.

## Rollout

1. Finish the prior Excel rollout through 104 if not already applied. Do not rerun historical migrations blindly.
2. Review and run **`supabase/migrations/202611270105_workspace_access_editor.sql` once, after 104**. It creates `bfe_action_rules` and the new editor read/save RPCs. Existing grants/defaults are preserved. Deploying this frontend without 105 will show the service-unavailable error rather than guess access or save locally.
3. Deploy the frontend. **No BFE / `bfe-create-account` Edge Function redeployment is required.** Account creation/linking source was not changed.
4. Configure the desired defaults in Group defaults. Existing No access rules or committee blocks are deliberately not erased. Review each action before allowing it.

For the booking issue: in Office group defaults (or the relevant individual exception), grant appropriate module access to Facilities & calendar and Finance, then separately allow **Approve or reject bookings** and **Approve Finance entries / verify booking payments** for the staff who should do that work. This is an assignment decision for the HOA; no migration silently makes all admins Finance approvers. Security's pass approval still requires the Security role and checks. Board Helpdesk still follows its assigned categories.

## Checks performed

```powershell
npm.cmd run build
npx.cmd vitest run packages/shared/src/access-editor.test.ts supabase/tests/permissions.test.ts supabase/tests/excel-workflows.test.ts
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx apps/web/src/features/developer/AccessManager.tsx apps/web/src/data/access-control.ts packages/shared/src/access-editor.ts packages/shared/src/access-editor.test.ts supabase/tests/excel-workflows.test.ts tests/e2e/auth.spec.ts
git diff --check
```

- TypeScript/build/PWA passed; existing chunk-size/upstream annotation warnings remain.
- 31 targeted tests passed across three files. The isolated PGlite fixture loads the new migration with the previous Excel workflows. Added regressions cover role approval inheritance, individual blocks, legacy deny precedence, View only blocking approval, stale writes, unauthorized resident attempts, delegated escalation rollback, resetting defaults and developer recovery.
- Changed TS/TSX tests and source passed targeted ESLint and were formatted with Prettier.
- Three focused mocked Chromium cases reported `ok`: fail closed when the editor RPC is unavailable; module/action editing with review and explicit save; and group-default saves targeting the selected role. The editor was checked at desktop and 390px widths, including scoped axe WCAG checks with no violations. Windows Playwright server teardown hung after the cases completed and was interrupted; do not describe this as a clean full E2E run.
- No live account/production permissions, GHL embed session, physical-device or real approval acceptance checks were run.

## Owner/co-developer manual checks

Use synthetic accounts in a safe environment and sign in directly, not account preview.

1. **Developer → Group defaults:** open Office, set Facilities & calendar to Manage and allow booking approval. Enter a reason, review and confirm. A directly signed-in admin should inherit the permission. Finance payment verification still needs its separate permission.
2. **Individual exception:** block that admin's booking approval. The default remains unchanged; that admin is denied. Reset the individual action to defaults as a developer and confirm inheritance returns.
3. **View only / No access:** apply each while the approval action remains Allow. Reading/changes must follow the module restriction; direct RPC approval must also be denied.
4. **Security / Board / Transport:** verify their groups, relevant actions and intended modules. Security must not approve Office-only stages; Board must not bypass Helpdesk categories. An action grant does not add a missing role.
5. **Multiple roles:** Office + Security shows both groups. Shared module changes are consistent and the source list identifies role, committee and individual rules. Existing explicit committee blocks remain visible and effective.
6. **Delegated manager:** editing another ordinary account within the manager's authority works; granting an unheld Finance approval or changing a protected developer is denied. Resetting existing overrides requires a developer.
7. **Two editor sessions:** save in one, then attempt the older snapshot in the other. The second must fail as stale without overwriting the first change.
8. **UI:** keyboard-select the radio options, expand details, check mobile width, light/dark readability, dirty-state navigation locks, pending buttons, review list, error recovery and restored current access after saving. Check both Vercel and the GHL embed after deployment.

If approval still fails, capture the failed RPC response and inspect the saved current permissions/source list. Do not remove server checks or grant blanket access to hide a denial.


## Earlier workspace navigation refinement ? superseded below

The old role-filtered accordion could show only Office for an Office account, making the rest of the editor appear missing. Individual editors now show all four staff workspace buttons with icons and role-assignment status. Choosing one changes the displayed pages without saving, assigning a role or granting rights. Unassigned workspaces explain that the actual role must be assigned separately in Role & status. Group defaults still target the selected role or committee. Search can find matching pages across workspaces. Existing scoped exceptions remain visible.

The module rows use a compact shared layout with separate action/source disclosures; modules such as Overview no longer show an empty actions disclosure. Office gate approval is now an explicit action alongside the separate Security ID/plate check action. Developer accounts have a clear protected-access notice. Required service roles and server authorization are unchanged.

Local verification: TypeScript/Vite/PWA build passed, targeted ESLint passed. Permission/workflow/shared suites passed 37 checks, then the added gate-approval-label regression passed as part of all four shared editor checks. Three mocked Chromium cases reported ok, including workspace switching without a save, explicit action review/save, separate role defaults, desktop/390px overflow and scoped axe checks. The updated switching case was rerun with role-warning assertions and synthetic screenshots for visual inspection. Windows Playwright teardown still needed interruption after cases completed; this is not a clean full E2E run. Live role checks remain owner-run.

Rollout for this refinement: **frontend deployment only; no new SQL, do not rerun 105, no BFE/Edge redeployment**. Owner reported 099?105 already applied. Reproduce the build with `npm.cmd run build`; run `npx.cmd vitest run packages/shared/src/access-editor.test.ts supabase/tests/permissions.test.ts supabase/tests/excel-workflows.test.ts`.

Manual acceptance after deployment: Office admin target shows all four staff workspace buttons; Board/Security/Transport targets initially open their assigned workspace. Switch each button and confirm the right pages and current saved access, no unexpected save. An unassigned workspace displays its role warning. Change one non-protected account's page/action, review and save, then sign in directly as that account and verify permitted/blocked actions. Shared page permissions remain synchronized across workspaces. Check light/dark, keyboard, mobile, Vercel and GHL embed. Developer recovery accounts remain protected.


## Current assigned-role flow ? 27 November 2026

Owner clarification supersedes the earlier all-workspaces display. The main workspace picker follows actual assigned roles; adding/removing a role refreshes the editor through its existing invalidation. No unassigned Security/Board/Transport buttons are shown on Office-only accounts. Role/committee defaults remain separate. Existing Office-area role mapping and protected Developer recovery are preserved.

Published community information is renamed View published content and moved to collapsed Advanced permissions along with saved exceptions. These are record scopes, not roles; they no longer say Role assigned. Their stored rules are preserved. The household note distinguishes submitting a request/listing from publishing it, and the viewing-scope note explicitly says it does not allow publishing. Carpool automatic publication is unchanged. Corrected apostrophes in the Office help text and singular module count.

Verification: 39 tests passed across shared editor, permission and isolated Excel workflow suites, including homeowner listing default submission remaining Submitted and self-publication denied. Four mocked Chromium cases reported ok: missing RPC fails closed; only assigned workspaces and advanced scopes are shown; three-role navigation plus explicit review/save; separate group defaults. Desktop/390px overflow and scoped axe checks passed in the review/save case. Targeted ESLint passed. Final build result is recorded in the verification vault note. Browser teardown hangs after assertions on Windows and was interrupted; no live production checks performed.

Rollout: frontend only. **No new SQL and no rerun of 099?105; no BFE/Edge redeployment.** Commands: `npm.cmd run build`; `npx.cmd vitest run packages/shared/src/access-editor.test.ts supabase/tests/permissions.test.ts supabase/tests/excel-workflows.test.ts`; `git diff --check`.

After deployment, use actual assigned accounts: Office-only shows Office; Office/Security/Board shows three; Homeowner/Office shows two. Add/remove a role through Role & status and reopen Page access to verify the picker refreshes. Expand Advanced permissions and confirm View published content / Saved exceptions have no role label. Review/save a permitted non-protected account change, then sign in as that account to check actual allowed/denied behavior. Homeowner business submissions await authorized review; Carpool retains its existing automatic publication. Repeat Vercel/GHL and mobile/light/dark checks.

## Protected Developer view - 27 November 2026

For individual accounts whose server-reported roles include Developer, Page access now opens on a first-position Developer / Protected system access card. It explains that recovery access cannot be edited here and must follow system recovery procedures. Other assigned workspaces (plus the existing Office recovery reference) remain selectable as read-only references. Module and action rows show server-reported current access and source details without disabled editing controls. The footer states the protected status; no review/save or Office access-management delegation form is offered for these targets. Existing dirty drafts can still be discarded. Ordinary account review/save, stale snapshot checks and pending protections are preserved.

Connected member search now displays all assigned roles, marks actual Developer accounts as protected, and exposes the existing role filter in the Developer view as well as Office. Search is debounced; stale results cannot be selected while a new lookup is pending. Ordinary Office delegation keeps its existing reason requirement and server mutation. Its help text distinguishes delegated access management from Developer access.

Scope: presentation and local frontend guards only. No RPC contract, Zod schema, SQL, permission evaluator, role defaults, finance or account-creation changes. This does not make Role & status or other account administration a read-only recovery tool. Formal recovery procedures and changes to role assignment/deletion policy are separate work, not implemented here.

Checks for this change:

```powershell
npm.cmd run build
npx.cmd vitest run packages/shared/src/access-editor.test.ts
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx apps/web/src/features/developer/AccessManager.tsx packages/shared/src/access-editor.ts packages/shared/src/access-editor.test.ts tests/e2e/auth.spec.ts
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'workspace access|workspace role defaults'
git diff --check
```

Build/type checking and targeted ESLint passed; five shared tests passed, including protected card ordering, Developer-only accounts, multiple assigned roles, saved exception preservation, and ordinary/group-default separation. Mocked browser validation uses the isolated localhost server and synthetic API responses, not production. See the verification vault note for the final browser results and teardown limitation.

Rollout: **frontend deployment only. No new SQL; do not rerun migration 105. No BFE / bfe-create-account redeployment.** Nothing committed, pushed, deployed or run against a live database by this change.

Manual acceptance after frontend deployment:

1. Sign in directly with an authorized access manager. Open a Developer + Office target: Developer is first and initially selected; recovery explanation is visible, no editable switches or delegation form. Repeat with Developer-only target.
2. Switch Office, Board or Security on a multi-role Developer target: read-only references, current access/source details, no save action. Confirm mobile scrolling reaches the explanation and footer, with visible keyboard focus in light/dark.
3. Search a synthetic staff name, clear it, try no match, and filter an additional role. All assigned roles should remain visible; only a linked sign-in account is offered.
4. Open an ordinary Office target: reason/review/save still work where authorized; an authorized Developer can allow/remove Office access management with a reason. Existing denied and stale-save responses must remain enforced.
5. Repeat on Vercel and the GHL embed. Live permissions, physical-device behavior and recovery operations remain owner-run checks.

## Permission disclosure styling - 27 November 2026

The two expandable sections within each workspace module now use neutral bordered disclosure rows: a shield/info icon, readable dark/light text, and a right-aligned chevron showing the open state. Expanded headers use the shared wash token, with inset permission controls/source details. Burgundy is reserved for existing selection/focus states rather than making these disclosures look like warnings. Both headers retain native details/summary keyboard behavior and 48px minimum targets. The longer Finance approval reminder now sits inside the expanded action section. Labels, saved values, approval rules and mutations are unchanged.

Validation commands: npm.cmd run typecheck; npm.cmd run build; npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx; git diff --check. Reuse the isolated configured-auth Chromium cases matching 'workspace access groups modules and saves explicit actions|workspace access presents Developer'. No new test or backend workflow is needed for this presentation change. Final outcomes are in the verification vault note.

Rollout: frontend deployment only; no new SQL, no migration rerun and no BFE redeployment. Manual check: open Page access from Office Roles & permissions and Developer Access configuration, expand both sections by click and keyboard, check labels/values, read-only Developer references, mobile/light/dark and ordinary review/save. Each disclosure should have neutral text, a visible focus ring and an obvious open/closed chevron. No commit, push, SQL or deployment performed.

## Compact permission control panel - 27 November 2026

Supersedes earlier per-module disclosure styling notes. Module summaries now count the actual actions reported by the server for that module, not unrelated actions: for example Custom (1 of 3 actions allowed) or View only (0 of 3 actions allowed). Missing action data is explicitly not reported. This is display logic, not an authorization evaluator; current values stay server-owned and pending choices are not presented as saved access.

All four module choices are one consistent native radio segment (No access / View only / Manage / Default). Actions use Default / Allow / Block native radio segments with neutral/green/burgundy selection colors and inline saved Allowed / Not allowed / Not reported status pills. Controls preserve disabled-reset restrictions, pending locks, draft handling and review-before-save. Radio names are unique per editor instance so hidden group-default controls cannot interfere with a member editor.

Rule precedence appears once in How access rules work (protected Developer recovery is described separately in its own wording). Module source information is a single saved-source line; a detailed source disclosure appears only for individual restrictions, committee blocks or multiple source groups. Actual permission sources are not invented from role names. Action sections remain collapsed initially. Light subheadings group Community & operations versus Administration & publishing. Inner cards are flattened to dividers. Member tabs and module search stay sticky; scroll margins keep focused module controls clear of them. Sticky footer displays a live unsaved-change count and retains Discard / Review / Confirm actions. Closing does not save changes.

Local checks and exact commands:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd vitest run packages/shared/src/access-editor.test.ts
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx packages/shared/src/access-editor.ts packages/shared/src/access-editor.test.ts tests/e2e/auth.spec.ts
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'workspace access|workspace role defaults'
git -c core.safecrlf=false diff --check
```

Build/typecheck/lint passed; shared suite 6/6 passed. Six mocked Chromium cases reported ok; normal review/save was rerun after final visual changes with native radio arrow-key checks, unsaved counter and single rule-guide assertions. Desktop/390px overflow and scoped axe checks passed; protected view also checked in dark. Browser teardown hangs on Windows and was interrupted after case completion, so no clean full E2E claim. No production/physical-device checks.

Rollout: frontend only, no SQL or migration rerun, no BFE / bfe-create-account redeployment. No commit/push/deploy performed. Owner checks: Office Roles & permissions and Developer Access configuration, ordinary and protected targets; verify saved action summaries, single precedence guidance, Default/Allow/Block by mouse and keyboard, module search while scrolled, real saved source details, unsaved counter/discard/review/save and stale-response handling. Check light/dark, narrow/desktop and Vercel/GHL after authorized frontend rollout. No role defaults or permissions changed by this redesign.

## Reference-style refinement after owner review - 27 November 2026

Owner rejected the independently sticky tabs/filter and tall repeated action/source rows. Replaced them with one shared sticky toolbar in MemberEditor: Page access / Role & status and the portalled module search sit side by side on desktop, stack on mobile, and move together. Group-default editor keeps its local filter. Search state, dirty guards, pending locks and protected Developer hiding remain owned by the existing editor. Search is still accessibly labelled Find a module.

Module rows are compact: current saved status plus source metadata beside the module title, quiet four-choice access toggles, and smaller subordinate Action permissions disclosure. Action toggles below the module retain Default / Allow / Block as mutually exclusive native radios, styled without radio circles; full label-sized invisible input hit areas retain pointer, keyboard and focus behavior. Selected Allow is green, Block burgundy and Default neutral. Action rows keep thin dividers/left inset instead of nested cards. No role/permission/RPC/schema changes.

Local checks: typecheck and targeted lint passed. All six isolated mocked Chromium cases reported ok after the toolbar and toggle changes, including keyboard selection, protected references, filtering, review/save and role defaults; desktop/390px overflow + scoped axe passed. Synthetic desktop/mobile layouts visually inspected. Browser teardown still hangs after completed assertions and was interrupted; no clean full E2E claim. Build outcome recorded in verification note. No live or physical-device checks.

Rollout remains frontend-only: no SQL or migration rerun, no BFE redeployment, no commit/push/deploy performed. Owner manual check: open Office Roles & permissions and Developer Access configuration, scroll module list and confirm toolbar does not cover its own controls, click/keyboard-select access/action toggles, expand subordinate actions, review/save/discard a permitted ordinary target change and confirm protected Developer targets remain read-only. Repeat mobile/light/dark and Vercel/GHL after authorized rollout. Previous commands apply; browser tests now locate the visible searchbox through its accessible name because the filter is in the toolbar.

## Checkbox permission list - 27 November 2026 (superseded below)

Owner chose checkboxes instead of switches, dropdowns or segmented controls. This is now the current interface. Each module lists View this module and Allow changes, with its specific action checkboxes directly underneath. Checking module access maps to the existing hidden/view/edit rule values; action checkboxes map to the existing allow/deny rules. No policy or server evaluator was changed. View and Allow changes must be selected before actions can be edited, preserving the existing view-only restriction. Role/committee defaults remain inherited until explicitly changed, with From defaults labels and separate Reset to defaults links. Unknown default results use an indeterminate native checkbox rather than being invented as allowed or denied.

Protected Developer references show saved statuses without editable checkboxes. Parent view-only/no-access restrictions still block actions; the checkboxes do not bypass required service roles, committee blocks or server validation. Module/action resets retain the existing developer-only restrictions on removing saved overrides. Dirty/pending/stale safeguards, change reason, review, confirmation and discard remain. The footer clarifies closing does not save. Removed unused styles from the superseded segmented-control designs.

Local validation commands:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd vitest run packages/shared/src/access-editor.test.ts
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx packages/shared/src/access-editor.ts packages/shared/src/access-editor.test.ts tests/e2e/auth.spec.ts
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'workspace access|workspace role defaults'
git -c core.safecrlf=false diff --check
```

Typecheck and targeted lint passed; 7 shared tests passed. All six isolated mocked Chromium cases reported ok with checkbox controls. The normal-save case was rerun after the CSS cleanup and reset assertions: view/edit gating, Space-key on/off, inherited action reset, unsaved count, review/save and server current-status refresh passed. Desktop/390px overflow and scoped axe passed; synthetic screenshots inspected. Browser teardown hangs on Windows and was interrupted after case completion; no clean full E2E claim. Final build details are in the verification note.

Next steps: frontend rollout only when authorized. No SQL/migration rerun and no BFE or bfe-create-account redeployment. No commit/push/deploy performed. Manual test ordinary Office target from both Office Roles & permissions and Developer Access configuration: select View, select Allow changes, tick one action, review all listed changes and save; sign in directly as target to check actual allowed/denied actions. Untick View or Allow changes and confirm action editing is unavailable; saved action rules are retained but server restrictions apply. Reset an action to defaults and confirm custom indicator clears, then check discard and stale-write handling. Check protected Developer targets have no editable checkboxes. Repeat mobile/light/dark and Vercel/GHL. Real server/physical-device acceptance remains owner-run.


## Current UI: one visibility switch, then action checkboxes - 27 November 2026

This supersedes the earlier base-checkbox/segmented designs. The owner's final instruction is one Tab visibility switch beside each module title (On/Off), followed directly by checkboxes for the actions in that module. There is no View this module checkbox, Allow changes step, access-level picker or action dropdown. The same shared editor serves assigned Office, Board, Security, Transport and resident scopes. A protected Developer target remains read-only; its protected card and reference workspaces do not expose editable switches or checkboxes.

The visibility switch maps to the existing hidden/view/edit modes. Checking an action prepares its existing allow rule and enables the existing edit gate automatically. Known unchecked peer actions are retained as deny rules when lifting a view-only gate, so ticking one action does not silently tick others. All prepared changes appear in the review before saving. Turning visibility off retains action settings and disables their controls; turning it back on restores configured/known allowed actions. Required roles, committee blocks, delegation restrictions and server authorization remain authoritative. No schema, migration, RPC, financial or account-creation workflow changed.

Saved Current summaries and action-status pills describe server-reported access; checkboxes represent the current draft. Unknown inherited action results remain indeterminate, not invented. Reset links restore inheritance within the existing authorization limits. Dirty counts, reason, review/confirm, stale-save protection, pending locks and discard remain. Closing does not save.

Validation: 8 shared unit tests passed; targeted ESLint and TypeScript passed. All 6 isolated synthetic Chromium cases reported success (protected Developer references, staff/delegation search, assigned workspace visibility, unavailable-data handling, action review/save, role defaults). The normal-save case additionally tests visibility Off/On retaining a checked action, Space-key selection, reset, pending counts and server-status refresh. Desktop and 390px screenshots were visually inspected; scoped axe and overflow assertions passed. Playwright's Windows teardown stalls after successful cases and was interrupted; this is not a clean full-suite E2E completion. Build and final diff-check results are recorded in the verification note. No live or physical-device checks.

Commands: use the local validation block above (8 tests now). Frontend deployment is required for live users to receive this UI. No new SQL, no migration 105 rerun and no BFE/bfe-create-account redeployment. No commit, push, deployment or live database action performed.

Focused owner/co-developer acceptance after authorized rollout:

1. Office Roles & permissions and Developer Access configuration: select an ordinary target, choose an assigned workspace and locate a module. One visibility switch and its action checkboxes should appear.
2. Turn visibility On, tick only the intended action, inspect every prepared change, give a reason and confirm. Sign in directly as that target to verify actual allowed/denied actions; preview is not enforcement.
3. Turn visibility Off: checkboxes disable but retain selections. Turn it On: selections remain. Test action reset, discard and stale/pending protection.
4. Open a Developer target: protected explanation first; other workspaces are reference-only, with no editable permission controls. Ordinary delegated access-management controls retain their existing server checks.
5. Repeat light/dark, narrow/desktop, deployed Vercel and GHL portal. Confirm focus and keyboard behavior. Live server and physical phone acceptance remain owner-run.


## Hide actions while visibility is Off - 27 November 2026

The shared workspace access editor now renders action checkboxes only when the module visibility switch is On. Off removes the action group from the visible and keyboard-accessible UI; switching On restores it with the existing draft selections. Hiding does not delete or reset action rules. Protected Developer reference workspaces keep their read-only saved-access display. No RPC, schema, permission evaluator or SQL changed. All reason/review/save/discard/stale protections are preserved.

Validation commands: `npm.cmd run typecheck`; `npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx tests/e2e/auth.spec.ts`; `git -c core.safecrlf=false diff --check`. Focused isolated browser command: set `BELLEFORT_TEST_AUTH=configured`, `CI=1`, then `npx.cmd playwright test --project=chromium --grep 'workspace access groups modules|workspace access presents Developer|workspace role defaults'`. Results are recorded in the verification note.

Next steps: frontend deployment only when authorized; no SQL/migration rerun or BFE redeployment. No commit/push/deploy/live database changes. Manual check from Office Roles & permissions and Developer Access configuration: open an ordinary target, turn a module Off (no actions shown), On (actions shown), select an action, Off then On (selection retained), then review/save or discard. Check other assigned workspaces and mobile/light/dark. Developer targets must remain read-only. Production/physical-device acceptance is not locally verified.


## Quieter action source labels - 27 November 2026

Removed repeated From defaults text beneath every action in the shared access editor. The existing module-level saved-source line remains. Only an explicit action override shows Custom and its existing Reset to defaults link. Unknown inherited results still show Not reported; protected references and all permission/save behavior are unchanged. This is a presentation-only change, with no RPC, schema, SQL or permission changes.

Validation commands: npm.cmd run typecheck; npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx; git -c core.safecrlf=false diff --check. No additional browser/E2E run for this text-only cleanup. Manual acceptance: in Office Roles & permissions or Developer Access configuration, open an ordinary account/module with visibility On. Inherited actions should show just the action name and checkbox; customized actions show Custom and reset. Reset restores inheritance and removes Custom. Unreported values must remain clearly marked. Frontend deployment only when authorized; no SQL/migration rerun or BFE deployment. No commit, push, deployment or live database changes.
