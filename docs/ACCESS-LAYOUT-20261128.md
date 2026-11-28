# Permission editor layout fixes

28 November 2026, local only.

## Changes

- Checkbox/switch focus now uses one wrapper outline when keyboard focus is visible. Suppressed the native input's second outline; kept checked state, keyboard Space behavior and 48px targets. Pointer focus no longer forces the wrapper outline through `focus-within`.
- Extended the sticky member tabs/filter background to the dialog body's edges and top inset. Content scrolling behind it no longer appears through the body-padding gap. Added scroll padding to the drawer body for focused controls.
- Reserved desktop Office/Developer page-header space for the three header controls (theme, Help and notifications). Page actions, including Refresh access, no longer occupy that corner. Preview layouts with their own header keep their existing space.
- No RPCs, permissions, schemas, save handlers or financial behavior changed.

## Local checks

- Frontend TypeScript, production Vite/PWA build, targeted ESLint, formatting and diff check passed. Existing build chunk/third-party annotation warnings remain.
- Chromium layout regression cases at 390px and 1440px passed: header/action separation, single checkbox/switch outline, keyboard focus restoration, opaque pinned tabs and no permission/delegation saves. Header separation is checked on both Office and Developer access pages.
- Existing individual access review/save test passed, including toggling, action checkbox state, reset, review and confirmation, plus scoped accessibility checks at phone/desktop widths.
- Inspected synthetic phone/desktop screenshots of the scrolled Role & status section.
- Windows Playwright teardown remains stalled after cases report completion; interrupted the completed runner. These are completed test assertions, not a claim that the whole E2E suite exits cleanly.

## Rollout and owner checks

Frontend deployment required. No new SQL and no BFE redeployment. No commit, push, live database operation or deployment performed.

```powershell
npm.cmd run typecheck
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'access layout regression|workspace access groups modules'
```

After deployment, check Office and Developer Roles & permissions:

1. Refresh access must not overlap the theme, Help or notification controls on desktop.
2. Open an ordinary member. Toggle a page and tick an action: show the green selection without nested red boxes. Tab onto a checkbox/switch and press Space: show one clear keyboard focus outline and update the choice.
3. Discard test changes. Switch to Role & status and scroll: tabs stay pinned on an opaque surface with no text showing through the gap above them. Check phone/desktop and both themes.
4. Repeat on physical Android Chrome/iOS Safari and the GHL embed; these environments were not verified locally. Do not save changes to a real user's permissions merely to test the layout.


## Permission checkbox spacing follow-up

Owner reported a circular reset icon and rows jumping after a checkbox change. The circular icon meant reset-to-inherited defaults, not retry or simply reversing the checkbox. The per-action icon was removed from action rows. Visibility and action resets remain available in a consistently rendered, collapsed **Default settings** disclosure per module. This preserves the distinction between an explicit Allow/Block and inherited defaults, plus existing actor restrictions on resetting saved overrides.

Previously, checking an action could create a module override and insert a new 48px Reset visibility row above all actions. This no longer happens. Reset controls expand only when Default settings is opened. When saved access is unknown, its explanatory line remains stable while editing instead of vanishing when an override is added. No RPC, SQL, permission resolver or save contract changed.

Validation commands:

```powershell
npm.cmd run typecheck
npx.cmd vitest run packages/shared/src/access-editor.test.ts supabase/tests/permissions.test.ts
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx tests/e2e/auth.spec.ts
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'access layout regression|workspace access groups modules and saves explicit actions after review' --fully-parallel --workers=3
```

TypeScript, targeted lint, build/PWA and 20 permission/shared checks passed. The mocked review/reset/save case completed successfully after updating it to open Default settings before resetting. Initial layout runs also hit the older multi-page fixture's loading timing. Focused regression setup now opens the Developer editor directly with the same synthetic account used by the save regression. Geometry checks first bring the control into view, then compare group height, offset and checkbox x/y/width across repeated toggles. These checks exposed a second real shift: the first draft expanded the footer to show the reason form, shrinking the scroll area. The compact draft bar now shows the count, Discard and Review; reason plus change summary appear only after Review. Confirm and save remains disabled until the required reason is entered. Duplicate footer Unsaved changes/Cancel controls were removed; modal close still uses the existing dirty guard. The compact footer reserves its footprint before the first edit (desktop and phone).

Final validation: all four mocked Chromium cases completed successfully: desktop/390px row geometry and keyboard/sticky-toolbar checks, individual review/reset/save with scoped axe scans, and role-default review/save. The review/save tests now explicitly assert Confirm and save is disabled before entering the reason. Build/PWA, targeted lint and diff-check passed. The Windows runner was stopped after all four completed cases; no clean whole-suite exit or production verification is claimed.

Owner next steps: no new SQL, no BFE redeployment; frontend deployment only when separately authorized. On Office Roles & permissions and Developer Access configuration, open an ordinary account, turn a page on, then repeatedly check/uncheck actions: action rows should retain their height, position and checkbox alignment. Open Default settings and reset an override; review the change and save. Reopen to verify persistence. Also check keyboard Space/Tab, mobile width and protected Developer read-only behavior. Checkbox toggling explicitly allows/blocks; it does not automatically restore inheritance. Discard changes remains the way to undo the entire unsaved draft.


Manual check for the new review step: choose permissions first, press Review changes, enter the required reason, inspect the summary, then Confirm and save. Until confirmation, changes remain a draft. Cancelling/closing still invokes existing unsaved-change protections.

## Single reset section - 28 November 2026

Supersedes the per-module Default settings disclosures above. One collapsed Reset custom access section now follows the workspace modules, grouping existing custom visibility/action settings by module and scope. Protected Developer targets receive no reset controls. Existing actor restrictions, draft review, required reason, stale/pending guards and server authorization remain unchanged.

Office admin is not automatically an access manager. A Developer enables Manage other users' access for an eligible Office admin. That admin can then manage ordinary accounts through Office > Roles & permissions within their own authority, without granting rights they do not hold or changing protected Developer access. No backend policy changed.

Validation: TypeScript, targeted ESLint, production/PWA build and diff-check passed; 20 shared/access permission tests passed. Four isolated Chromium cases completed successfully: 390px/1440px geometry and keyboard checks, individual reset/review/save with scoped accessibility checks, and staff search/delegation. Windows runner stopped after all four reported success; no clean whole-suite exit or live verification claimed.

Commands: npm.cmd run typecheck; npx.cmd vitest run packages/shared/src/access-editor.test.ts supabase/tests/permissions.test.ts; npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx tests/e2e/auth.spec.ts; npm.cmd run build; git -c core.safecrlf=false diff --check.

Browser command (isolated synthetic services):

```powershell
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'access layout regression|workspace access groups modules and saves explicit actions after review|workspace access staff search' --fully-parallel --workers=4
```

Next: frontend deployment only when authorized; no SQL or BFE redeployment. In Office Roles & permissions / Developer Access configuration, check no repeated Default settings, one reset section at the end, and stable checkbox rows. Reset a synthetic custom setting, review, enter a reason, save and reopen. Confirm delegated Office admins can manage permitted ordinary accounts and Developer references remain protected. Physical phones, GHL embed and production persistence remain owner checks.

## Access-management toggle - 28 November 2026

Replaced the oversized delegation disclosure with one compact setting row: Manage other users' access, a short explanation, and the same accessible 48px On/Off control used for page visibility. Only the existing eligible Developer-to-Office-admin flow shows this setting; protected Developer targets remain read-only.

Changing the switch creates a local draft. Reason for this change, Not saved feedback, Cancel change and Confirm change appear only while a change exists. Switching back or cancelling restores the saved state without an RPC. Confirmation requires a trimmed 3-character reason and sends the explicit desired value through the existing bfe_set_access_manager RPC. A changed refreshed baseline blocks confirmation locally. There is no new server-side concurrency contract: the existing RPC remains authoritative. A failed save retains the draft/reason and shows its error next to the form. Successful confirmation refreshes server data before clearing the draft. Dirty-close and pending protections now include this draft; page edits and delegation are kept separate to prevent mixed saves. No permission defaults, RPCs or SQL were changed.

The shared editor serves Office and Developer access screens. Reused the existing tokens, toggle styling, buttons and feedback instead of introducing another control style. A source search found no other duplicate delegation control. Broader system consistency was checked using the existing six-role UI audit (Homeowner, Office, Board, Security, Transport, Developer), phone/desktop and light/dark. All six audit cases completed successfully with no recorded runtime errors or writes. This audit covers route rendering and shared UI, not all populated forms or live workflows; unavailable mock services remain explicitly unavailable.

Validation actually run: typecheck, targeted ESLint, production/PWA build, 20 shared/permission tests and diff-check passed. Six focused Chromium cases completed successfully, including delegation enable/disable/cancel, phone/desktop keyboard/axe/error retention, protected Developer references, ordinary staff search, individual reset/review/save, and stable checkbox geometry. The initial protected test run hit a loading timeout under four workers; the initial new failure-path test incorrectly searched inside a region while the error was portalled into the footer. Error feedback now appears inline; final focused rerun with two workers passed all six. Windows runners remained active after case output and were interrupted; no clean full-suite exit claimed.

Commands:

```powershell
npm.cmd run typecheck
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx tests/e2e/auth.spec.ts
npx.cmd vitest run packages/shared/src/access-editor.test.ts supabase/tests/permissions.test.ts
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'access management toggle fits|workspace access presents Developer|workspace access staff search|access layout regression|workspace access groups modules and saves explicit actions after review' --fully-parallel --workers=2
npx.cmd playwright test --project=chromium --grep 'system UI audit' --fully-parallel --workers=4
```

Rollout: no new SQL, no BFE or bfe-create-account redeployment. Frontend deployment only after authorization; no commit/push/deploy/live checks performed.

Owner/co-developer manual checks:

1. Developer > Access configuration > ordinary Office admin: saved On/Off appears without a reason field. Toggle it; reason and confirmation appear. Cancel or toggle back: no save. Enter a reason and confirm with an authorized test account: reopen to check persistence.
2. Repeat turning delegation off. Confirm page-access edits cannot mix with delegation drafts, tabs/close retain unsaved guards, and pending saves disable controls.
3. Delegated Office admin > Roles & permissions: existing allowed actions remain available; no ability to grant rights beyond their own authority. Developer target has no editable delegation switch.
4. Physical Android/iOS and GHL embed: check keyboard, footer, wrapping and focus. Live persistence/authorization and all populated feature forms remain owner verification; the six-role synthetic audit does not certify them.

## 28 November 2026 - header overlap with read-only notices

Owner screenshot exposed a state missing from the previous all-granted route audit: desktop header controls were absolutely positioned above the page; page headings reserved their corner but read-only banners did not. The buttons therefore visually sat on the yellow notice. Added explicit shell-notice markers to read-only and offline notices. When a notice is present, the shared desktop staff shell places the header in normal flow and removes the now-unneeded title corner reservation. Other page layouts retain their compact title/header. Read-only notice has bottom spacing and token-based rounded corners. No permission enforcement or notice visibility logic changed.

Validation: TypeScript, targeted ESLint (AppShell/auth tests), production/PWA build and diff-check passed. Seven isolated Chromium cases completed successfully: five notice cases (Review inbox, Helpdesk, Board shuttle review, Security, Transport) and both existing access-layout regressions. New notice checks assert controls are above banners, in viewport and at least 48px tall at 390/1024/1440/1920px in light/dark, with offline plus read-only banners together. No access save/delegation calls occurred. The final Review inbox case used the actual /office/approvals route; /office/inbox is Helpdesk and was retained as separate coverage. A first attempt to start the extra case encountered the previous local runner's occupied port; that runner was stopped and the extra case passed. Windows runners were interrupted after completed case output; no clean whole-suite exit claimed.

Commands:

```powershell
npm.cmd run typecheck
npx.cmd eslint apps/web/src/AppShell.tsx tests/e2e/auth.spec.ts
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'shell notice layout|access layout regression' --fully-parallel --workers=2
```

No new SQL, no BFE redeployment. Frontend deployment only when authorized. Owner/co-developer: use a view-only Office account and open Review inbox and Helpdesk; header buttons must sit above the notice, not on it. Check Board/Security/Transport, narrow/desktop, light/dark and offline/reconnect. Verify editable pages still retain their compact header. Actual phones/GHL embed and live permissions remain owner checks. This fixes the demonstrated shared-layout defect, not a claim that all UI states across the application have been certified.
