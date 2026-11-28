# Plain-language feature help

Local implementation, 28 November 2026 (Asia/Manila). No deployment or live database access.

## What changed

- Added a question-mark Help button next to notifications in the shared app header. It opens guidance for the current page in the existing Sheet; Escape/Close returns focus to the button without navigating away.
- Added 31 searchable feature guides to the existing Help & support page. Signed-in and preview Help use the same content. Fixed the explicit preview Help route's missing wildcard parameter so it opens Help instead of More.
- Covered Office, Board, Security, Transport, Developer and resident features: permissions, review inbox, people, registration, finance, balances, bookings, passes, Helpdesk, announcements, property links, vehicles, permits, Livelihood, applications, documents, elections, reports, shuttle/carpool, profile, notifications and settings.
- Explained the permission editor's page switch, action checkboxes, unknown state, defaults and save behavior. Clarified what delegating access management allows. Existing permission calculations, grants, RPCs, forms and financial rules are unchanged.
- Guidance is static explanation, never authorization. No invented official rates, statuses, health checks or business decisions were added. Existing financial distinctions and emergency guidance remain.

The content is in `packages/shared/src/feature-help.ts`; UI is `components/FeatureHelp.tsx` and its CSS Module. Keep route aliases in sync when adding features. Reuse existing topics rather than duplicating instructions in every card.

## Checks actually performed

- Frontend TypeScript check passed.
- 24 route-to-help regression assertions passed. Nested account, staff, Board, Security, Developer and transport routes resolve to the correct guide, including query strings and unknown-route fallback.
- Two Chromium help integration cases passed (Office admin and homeowner), each at 390px and 1440px. Tested correct content, Escape/focus restoration, unchanged URL, searchable guides and empty results. Eight scoped light/dark accessibility scans passed. No access saves or delegation calls occurred.
- Existing browser tests for individual permission review/save and separate role defaults also passed after the wording change.
- Targeted ESLint and `git diff --check` passed. Production build passed; existing third-party annotation and large-chunk warnings remain.
- Inspected synthetic mobile help screenshots. Physical iOS/Android and GHL embedding were not checked.
- Playwright prints each completed case but its Windows teardown stays running in this environment. Only the completed assertion results above are claimed; the stalled runner was interrupted afterward.

## Earlier wiring review in this working session

The preceding full local unit/embedded-PostgreSQL run passed 430 tests across 39 files. The account-integrity check initially found an editor artifact mismatch; regenerating it produced no substantive Git diff, and its source comparison plus all ten account-integrity tests passed afterward. No new BFE implementation change resulted.

Older browser workflow tests are not a clean full-suite result: six initially failed before reaching their intended assertions. Updated the shared synthetic API fixture to handle session checks and navigation badges, and to return an explicit unavailable response for unknown RPCs rather than treating every RPC as a Helpdesk write. The profile save/notification-read integration test subsequently passed. Older participation, structured submission, booking/pass, transport and request-permission browser cases still require migration to current RPCs, forms and inline detail views; they are not reported as passing. This help change does not certify every production workflow.

## Co-developer next steps

No new SQL and no `bfe-create-account` redeployment are required for this change. Deploy the frontend through the normal reviewed process to make the guides available live. No commit, push or deployment was performed.

Reproduce focused checks in PowerShell:

```powershell
npm.cmd run typecheck
npx.cmd vitest run packages/shared/src/feature-help.test.ts
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'plain-language feature help|workspace access groups modules|workspace role defaults'
```

Owner acceptance after frontend deployment:

1. Office: open Roles & permissions. Use the question-mark button; confirm the guidance explains visibility separately from actions. Close it and check that no permission changed. Open a member's editor and check the inline explanation.
2. Homeowner: open Account, Amenities and Visitor passes. Each Help button should explain that feature and preserve entered form values and the current page when closed. Confirm that estimates, confirmed charges and payment receipts are described separately.
3. Board, Security and Transport: open Announcements, Gate desk and Shuttle respectively. Help should describe the correct workflow without granting new actions.
4. Any role: open Help & support, search `permissions`, expand the topic, then try a nonexistent word. Clear search to restore all topics.
5. Check light/dark and a narrow phone in Safari/Chrome and the GHL embed. Help and notifications must remain reachable, with readable text, scrollable content and no horizontal overflow.

Open follow-up: finish updating the legacy functional browser fixtures, then run their workflow assertions against the current screens. Live role grants, migrations and backend deployment versions still need owner-run acceptance; a local mocked UI test cannot verify those.
