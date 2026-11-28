# UI cleanup - 27 November 2026

## Implemented locally

This pass reduces repeated copy and nested decoration, keeping the existing workflows. It is a shared UI cleanup, not a claim that every route and form has been redesigned or functionally verified.

- Workspace access: action name and checkbox stay on one row. Explicit overrides have a quiet reset icon beside the checkbox, with a specific accessible name and tooltip. Removed repeated Custom/reset paragraphs. One Reset visibility link remains for a module override. Unknown inherited results remain marked Not reported. Visibility Off still hides actions and preserves their selections. Reason, review, save, discard, stale/pending checks and protected Developer references are unchanged.
- Shared Modal/Sheet content: DialogSection uses a heading and divider instead of another bordered card inside the dialog. Existing content cards remain. Staff Sheet headers use the same desktop padding as Modal headers. Focus, dismissal, forms and sticky actions are unchanged.
- Office, Board, Security, Developer and resident main screens: removed generic introductory descriptions from Overview, Announcements, Access configuration, Notifications, Search, Hotlines and Services. Calendar retains the Philippine-time guidance; Review inbox retains concise decision guidance; Connections has a short task description.
- OfficePage and DeveloperPage no longer render an empty intro wrapper. DeveloperPage permits omitted description, rather than forcing explanatory filler on every screen.

Existing design tokens, brand colors, 48px control targets, light/dark styling and responsive layout remain. No routes, fetching, RPCs, validation, schemas, roles, financial calculations or account-creation code changed. Existing unrelated working-tree work is preserved.

## Checks actually run

- npm.cmd run typecheck: passed. Initial required-description errors were fixed by making the shared DeveloperPage description optional and conditionally rendering its intro.
- npm.cmd run build: passed (TypeScript, Vite and PWA). Existing third-party annotation and large-chunk warnings remain.
- Targeted ESLint on changed TSX files and tests/e2e/auth.spec.ts: passed.
- git -c core.safecrlf=false diff --check: passed.
- Isolated mocked Chromium: all six focused workspace access cases reported success. They cover unknown data, Developer protection, staff/delegation search, workspace filtering, action/reset/review/save and role defaults. The save case includes 390px/desktop overflow and scoped axe checks. Synthetic screenshots visually inspected at both widths.
- Isolated preview Chromium: native dialog focus/Tab/Escape and request-dialog accessibility cases both reported success.
- Browser-server teardown stalls on this Windows setup and was interrupted after completed cases. Do not describe these as clean full E2E suite runs.

## Wider validation still unresolved

Five older authenticated smoke tests were attempted: announcement monitor, staff responsive records, member profile, homeowner/Board navigation and Security navigation. They failed on incomplete legacy session/request-count mocks and historical navigation expectations. A diagnostic mock update exposed further unsupported calls (business review inbox, private health note) and an obsolete Create announcement link expectation. The exploratory legacy mock changes were removed, retaining this task's permission regression assertions. These five checks are not passing and do not establish a new UI regression or end-to-end success. Update their fixtures and expectations against the actual current contracts in a separate focused validation pass; do not loosen product authorization to satisfy tests.

Physical Android/iOS, production Supabase authorization, real GHL embedding, all custom forms and every route remain unverified. A full-site UX acceptance sweep is still needed; shared component improvements are not a substitute for checking each workflow.

## Next steps for the owner/co-developer

No SQL, migration rerun or BFE/bfe-create-account deployment is needed. Frontend deployment is required to publish this UI, only when authorized. Nothing was committed, pushed, deployed or run against the live database.

Local commands:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd eslint apps/web/src/features/developer/TabAccess.tsx apps/web/src/features/developer/DeveloperPage.tsx apps/web/src/features/office/OfficePage.tsx tests/e2e/auth.spec.ts
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'workspace access|workspace role defaults'
Remove-Item Env:BELLEFORT_TEST_AUTH -ErrorAction SilentlyContinue
npx.cmd playwright test --project=chromium --grep 'native dialog keeps focus|request dialog has no automated'
```

Focused manual acceptance after local review, then authorized deployment:

1. Office Roles & permissions / Developer Access configuration: open an ordinary target. Toggle Off/On, change one action, reset it, review/save and discard another draft. Verify selections persist when hidden, reset restores inheritance, and the server-reported state updates only after save. Developer targets remain read-only. Check keyboard focus and mobile/light/dark layouts.
2. Office People: open details/properties/history and property-link/household forms. Dialog sections should have one clear hierarchy, usable labels and aligned actions. Fields, validation, cancel and submit behavior must match the existing flow.
3. Office/Board Announcements: browse, open create form, choose audience, preview an image and cancel a draft. Use synthetic/isolated records for submissions. Verify text and image controls remain available without repeated headings.
4. Resident Services/More: open a request form and profile dialog. Verify keyboard/close behavior, visible errors and unchanged loading/empty states. Check Home, Notifications, Hotlines and Search navigation.
5. Board/Security/Transport and Office Finance: verify each role's real allowed views/actions using authorized test accounts. Financial warnings, approval requirements and scope labels must remain visible. This pass did not change Finance/Transport logic or claim their full functional validation.
6. On actual Android Chrome and iOS Safari/PWA, check keyboard, safe areas, scrolling and dialog buttons. After authorized rollout, repeat on Vercel and the GHL portal.

Continue screen-specific cleanup from those results. Do not remove warnings or permission controls solely to make a screen shorter.


## Cross-system follow-up audit

The owner requested a wider check across the system. The new `system UI audit` cases in `tests/e2e/auth.spec.ts` exercise 64 routes across Homeowner (22), Office (20), Board (7), Security (5), Transport (3) and Developer (7). Each route is captured at 390px and 1440px (128 route/width checks). Overview shells also receive automated axe checks in light/dark at both widths. Announcement and visitor-pass forms are opened and closed without submitting; this does not test their mutation handlers.

The local Vite server is explicitly configured with the synthetic `bellefort-auth-test.invalid` API. External hosts are aborted. Fixtures use synthetic identities, explicit test capabilities, empty lists and deliberately unavailable services. They are not real role defaults, live data, or proof of production permission enforcement. Reports list unavailable RPCs and runtime errors; screenshots/reports are local ignored artifacts under `.artifacts/system-ui-audit`.

### Issues fixed in the follow-up

- Visitor-pass copy: removed the stale blanket Office-approval claim from the shared mobile header; form-specific approval guidance remains. Corrected two malformed visitor's ID labels; no pass validation or approval policy changed.
- Shared Office/Board/Security/Transport search: only supplies aria-controls while its results container exists. Also corrected its accessible search label. This fixes the shared invalid ARIA reference found by axe.
- Resident mobile bottom navigation: Team Helpdesk no longer creates a sixth cramped tab. It remains in the desktop navigation and is available in More on mobile, behind the existing role/path permission checks. Home, Account, Livelihood, Services and More remain the five main resident tabs. No permission grant or route was changed.
- Developer member support: shortened paging buttons to Previous/Next and allowed wrapping. Corrected CSS specificity so a search icon does not overlap the input text. The table retains its own horizontal scroll on narrow screens; the page itself should not overflow.

### Coverage limits and next steps

This is a route/layout and empty/error-state audit, not complete functional acceptance. Several financial, calendar, registry, metrics and document services are intentionally unavailable in these mocks. Their populated records, posting/approval flows and real data refresh still need isolated fixtures or authorized owner testing. Earlier legacy smoke failures remain unresolved; the new audit does not turn those tests into passes. Physical Android/iOS keyboard behavior, installed PWA, GHL embedding and production authorization remain unverified.

The existing visitor shortcut URL `?new=visitor` currently opens the pass list, not the composer automatically. The form audit uses the visible New pass button. Changing that shortcut behavior is a separate follow-up; its destination and existing form remain usable.

No new SQL files, SQL rerun, BFE or bfe-create-account redeployment is needed for these follow-up fixes. Only a frontend deployment publishes them. No commit, push or deployment was performed.

Reproduce the isolated audit:

```powershell
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'system UI audit'
npx.cmd playwright test --project=mobile-webkit --grep 'system UI audit homeowner'
npm.cmd run typecheck
npm.cmd run build
npx.cmd eslint apps/web/src/AppShell.tsx apps/web/src/features/office/OfficeSearch.tsx apps/web/src/features/more/MoreHub.tsx apps/web/src/features/developer/MemberAccountPicker.tsx tests/e2e/auth.spec.ts
git -c core.safecrlf=false diff --check
```

Owner/co-developer manual acceptance:

1. On a resident phone layout with Team Helpdesk access, verify five bottom tabs; More opens Team Helpdesk. Without permission, that link must be absent. Desktop retains its existing sidebar destination.
2. Office, Board, Security and Transport: search a permitted page, open it with Enter, clear with Escape, and check keyboard focus. Blank search must not reference a missing results panel.
3. Developer Account support at 390px and desktop: search text clears the icon, paging stays in the viewport, and the table scrolls locally. Verify next/previous still changes the real paginated directory when available.
4. Office Announcements and resident Visitor passes: open, scroll, tab through and cancel forms; check footer reachability and dirty-change confirmation using synthetic content. Posting/approving and fee effects require the separate authorized functional test plan.
5. Repeat on actual Android Chrome and iOS Safari, then on the authorized deployed Vercel/GHL portal. Keep screenshots free of real personal information.


### Follow-up local results

Final assertions from all six Chromium role cases passed: 128 route/width captures and 28 automated axe overview/form scans; no detected page overflow, broken images, runtime errors or audited mutation RPC attempts. Representative mobile/desktop and popup screenshots were visually inspected, not every screenshot. Initial runs found the real search ARIA and Developer overflow issues above. Additional visitor-form attempts initially failed because of a missing current community-pass mock and an incorrect assumption that its new query opens the form; the final fixture uses the existing New pass control. A test-only desktop assertion also incorrectly queried the hidden mobile navigation; it was restricted to phone widths. These diagnostic attempts are not counted as successful runs.

TypeScript, production build (Vite/PWA), targeted ESLint and diff-check passed. Existing third-party annotation and large-chunk build warnings remain. Browser server teardown stalls on this Windows setup; completed cases are interrupted afterward. This is not a clean full-suite result.


WebKit follow-up: Homeowner rendered 44 route/width captures plus six overview/form axe scans without detected page overflow, broken images or axe violations. The overall WebKit case FAILED its final runtime-error assertion: access-control errors were reported for the synthetic bfe_session_status and bfe_get_member endpoints. No live endpoint was accessed. This is not a passing WebKit/E2E result; investigate the isolated cross-origin fixture/request lifecycle before claiming browser parity. Actual iOS remains an owner acceptance requirement. Visitor-pass mobile header copy was also corrected to avoid claiming all passes need Office approval; form-specific guidance and server rules remain unchanged.


## Redundancy review across workspaces (second follow-up)

The owner requested a broader redundancy pass, not another wholesale redesign. A local static inventory indexed all 130 feature TSX files for descriptions and repeated static labels (`.artifacts/ui-redundancy-inventory.json`). Actual route composition, responsive CSS and related controls were checked before removing text or actions. An inventory is not evidence that every populated record and popup has been functionally verified.

### Changed in this pass

- Removed title-restating introductions from Office People/Registration inbox, Finance readers/workbench, Operations directory, resident property lists/details, Settings, ordinary Profile, preview Announcements, and Board/driver Shuttle headers. Existing role-preview/synthetic notices, scope, errors and substantive guidance stay visible. Shared components also apply to Board, Security and other authorized users of these pages; clean screens were not changed merely to touch every role.
- Helpdesk now renders one New request button at both widths, using the existing handler, permission/error gating and form. The former header/body duplicate was removed; the surviving button is available on desktop and full width on mobile. Resident guidance is one sentence. Office guidance no longer repeats the Helpdesk title and visible actions.
- Community documents uses the existing accessible DetailDisclosure for About document access. The full existing legal/category explanation is retained verbatim in the disclosure rather than occupying the page introduction. Search, category selection, view/download requests and permission checks are unchanged.
- Accounting keeps bank-clearance and automatic-late-fee warnings visible. Existing longer bill-setup instructions are available in Before creating bills. Business form is labelled Record type; values and queries are unchanged.
- Announcements search uses consistent naming. The Services color legend is shorter while retaining active/pending BOD approval meaning. No availability policy was changed.

No RPCs, SQL, schemas, roles/grants, rate calculations, record handlers or notification destinations changed in this follow-up. It does not repair missing backend data. Earlier uncommitted work remains intact.

### Verification and rollout

Commands used for this pass:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd eslint apps/web/src/features/office/RecordedFinance.tsx apps/web/src/features/office/AccountingWorkbench.tsx apps/web/src/features/office/People.tsx apps/web/src/features/registry/LotRegister.tsx apps/web/src/features/more/Settings.tsx apps/web/src/features/more/MemberProfile.tsx apps/web/src/features/connected/CommunityCalendar.tsx apps/web/src/features/connected/DocumentLibrary.tsx apps/web/src/features/connected/LiveFeatureDirectory.tsx apps/web/src/features/community/Community.tsx apps/web/src/features/transport/Shuttle.tsx apps/web/src/features/services/RequestDesk.tsx apps/web/src/features/home/ConnectedHome.tsx tests/e2e/auth.spec.ts
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'system UI audit'
```

The audit now asserts exactly one New request control on phone/desktop, checks that the full document explanation remains expandable, and verifies accounting setup help can expand while the bank-clearance warning stays visible. It retains the existing 64-route/six-workspace, 390px/1440px sweep and overview/form axe checks. Tests use only mocked synthetic services; several real data panels remain intentionally unavailable. Prior WebKit synthetic access-control failures and old legacy smoke failures are not resolved or counted as passed by this presentation pass.

No new SQL, migration rerun, BFE or bfe-create-account deployment is needed. Frontend deployment is required to publish this pass; no commit, push, deployment or live database action was performed.

Focused owner/co-developer acceptance after review:

1. Resident Helpdesk at phone/desktop widths: one New request button, same form opens, loading/error disables it as before, cancel and dirty-change protections remain.
2. Resident/Board Documents: expand About document access by mouse/keyboard, inspect retained text; close it and use search/category/view/download-request actions as allowed.
3. Office Finance Accounting: bank-clearance warning stays visible, expand Before creating bills, select Record type, inspect existing forms without posting real records. Independent review remains required.
4. Office People/Registrations, Lot register, Profile/Settings, Calendar, Board/Transport Shuttle: verify the screen is identifiable without filler introductions; existing actions, state and scope remain clear. Check narrow/desktop, light/dark, keyboard focus and actual Android/iOS.
5. Verify populated approval/payment and private-document workflows separately with authorized test accounts and data. Route rendering and an empty/error-state audit do not prove these live workflows work.


Second follow-up results: TypeScript, production Vite/PWA build, targeted ESLint and diff-check passed. Formatting initially flagged Community, ConnectedHome and the new audit assertions; they were formatted and the focused format check passed. All six isolated Chromium role cases reported success after the changes: 128 route/width captures and 28 overview/form axe scans, zero detected page overflow/broken images/runtime errors/audited mutation attempts. New request uniqueness, retained document guidance and visible accounting warning assertions passed at both widths. Representative screenshots inspected. Windows teardown was interrupted only after all six cases completed; no clean full-suite exit is claimed. No new WebKit or physical-device validation in this second follow-up; previously documented failures/limitations remain.
