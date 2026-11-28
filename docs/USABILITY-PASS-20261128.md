# Usability pass — 28 November 2026

## Result and limits

The owner requested a whole-system pass for people unfamiliar with phones or computers. This continues the existing shared cleanup; it does not replace the app or discard the working tree. Shared request details now expose the information needed to make a decision, with clearer actions and fewer nested panels. The route audit covers every workspace listed below. A route rendering check is **not** a certification of every populated form, real server permissions or usability with older residents.

No SQL, RPC contracts, account creation, role grants, pricing, financial calculations or approval rules changed in this pass. No commit, push, deployment or live backend connection was performed.

## Changes in this pass

- Added a display-only `RecordFacts` component with readable labels/values, dividers and wrapping. Mobile facts stack; desktop facts use aligned columns. It uses the existing tokens and 16px values/14px labels.
- Added the shared `recordFacts` presenter. It respects existing conditional field visibility, omits blank optional answers, explicitly shows missing required answers, formats date/time fields and preserves identifiers. It never enumerates unknown raw fields. It is not an authorization or validation layer.
- `LiveFeature`: vehicle/permit and other generic request popups use the actual request title once. Request answers are visible immediately, including staff cards on phones and inline inbox detail views. History and the request number remain secondary. The primary **Review & decide** action opens the existing decision form with the request information still present. Decision labels explain the outcome without changing their stored values or permitted transitions.
- Review, creation/edit and issuance forms retain pending/error handling and now protect unsaved input when closed. Issuance distinguishes an approved request from a sticker/permit actually recorded as issued. Buttons say **Confirm sticker issued**, **Confirm permit issued** or **Record vehicle removal** as appropriate. Official reference/dates use the same facts layout.
- Shared workflow history uses a simple timeline with readable timestamps, an explicit empty state, and distinct loading/error states. It retains the notice that review reasons can be read by the requester. A failed load never becomes an empty successful history.
- Helpdesk request information uses the same facts layout. Assignment details now show a loading skeleton and a retry action on failure. “Untriaged” is displayed as “Not set” while the submitted value stays unchanged. Existing assignment, status and reply permissions remain separate. The current status is not repeated as an action; an Open action says **Mark as open** unless reopening a resolved request.
- Activity application details use the same facts layout. Buttons distinguish **Review application** from **Manage application**; decision choices say **Accept application**, **Reject application**, **Withdraw application**. Creation and decision forms preserve unsaved changes. Stored values, validation and RPCs remain unchanged.
- Accounting labels distinguish payments applied to bills from payments not applied to bills. Selected accounting records in the review surface show their facts by default; list cards retain their existing disclosure. Finance navigation uses “Receipts & unpaid bills” and “Check against bank records”. No balance or accounting behavior changed.
- Updated relevant browser fixtures to the current business-request/application RPC names, generated Helpdesk titles, active-request filter, current routes and inline Office conversation layout. These mocks do not assert production authorization.

## Coverage ledger

Static inventory: 130 feature TSX components, 58 forms, 65 dialog/sheet usages and 36 disclosures. Counts are component usages, not unique business workflows. The inventory identifies surfaces to review; it is not a test result.

| Workspace | Modules/routes inspected in the rendering audit                                                                                                                                                                                      | Additional populated checks / changes                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homeowner | Home, Account/Payments, Community, Services, Bookings, Visitor passes, Helpdesk, Calendar, Livelihood, Learning/Transport redirects, More, Profile, Settings, Notifications, Hotlines, Lots, Vehicles, Permits, Documents, Elections | Vehicle request facts/history at phone/desktop; Helpdesk create → Office reply/status → resident sees reply; activity application → withdrawal. Shared details/forms apply to other generic modules.                   |
| Renter    | Shared resident implementation and permission guards                                                                                                                                                                                 | Populated vehicle facts/history at phone/desktop. A separate full Renter route audit was not run.                                                                                                                      |
| Office    | Overview, Review inbox, People, Registrations, Finance, Accounting, Operations, Bookings, Visitors, Calendar, Announcements, Documents, Helpdesk, Lots, Vehicles, Permits, Shuttle, Settings, Hotlines, Access                       | Populated request details and decision context; view-only detail without review action; Helpdesk conversation. Accounting/issuance presentation reviewed statically; actual posting/issuance remains owner acceptance. |
| Board     | Overview, Documents, Elections, Announcements, Reports, Shuttle review, Helpdesk                                                                                                                                                     | Shared facts/history/Helpdesk changes apply where used. Render audit includes unavailable metrics; no election, financial or document totals are fabricated.                                                           |
| Security  | Overview, Visitors, Vehicles, Incidents, Gate desk                                                                                                                                                                                   | Populated vehicle review context at phone/desktop; shared pass and gate actions left intact. Live ID/plate checks remain owner acceptance.                                                                             |
| Transport | Shuttle, Driver profile, Settings                                                                                                                                                                                                    | Rendering/state/copy review; no fabricated location, ETA or rider count. Live dispatch remains owner acceptance.                                                                                                       |
| Developer | Overview, Account support, Connections, Access configuration, Audit, Module monitoring, Profile                                                                                                                                      | Rendering and shared component review. Protected Developer recovery access and delegation constraints are preserved. Earlier focused access tests are documented in `ACCESS-LAYOUT-20261128.md`.                       |

The six-workspace audit visits 64 distinct routes at 390px/1440px (128 route/width captures), plus 28 light/dark overview/form accessibility scans. The fixtures intentionally include empty and unavailable services. Their reports retain the unavailable RPC names; an unavailable panel is not a working populated workflow.

Disclosures retained deliberately: technical request/import identifiers, audit/history, filter/sort, detailed amenity rules and legal/copyright information, advanced access information and diagnostic limitations. Essential request answers are visible; secondary/legal/technical material is not indiscriminately expanded.

## Local verification

- `npm.cmd test`: **456 passed across 41 files**. The first run failed only the new date-format expectation; the expected `en-PH` output was corrected and the full suite rerun successfully.
- Production/PWA build and TypeScript: passed. Existing Rollup dependency-annotation and chunk-size warnings remain.
- Targeted ESLint for changed TS/TSX and the browser tests: passed.
- `git -c core.safecrlf=false diff --check`: passed.
- Chromium six-workspace rendering audit: all six cases completed successfully, with zero recorded runtime errors, attempted audited write RPCs, page overflow or axe violations in the generated reports.
- Chromium populated request checks: five cases completed successfully (Homeowner, Renter, Office, Security and Office view-only), at 390px/1440px. They assert visible facts, no duplicated request heading, no unknown/inactive field leakage, correct presence/absence of review actions, preserved review context, history empty state and no mutation request merely from inspection.
- Chromium activity application and Helpdesk create/reply/status cases completed successfully after updating stale test routes/fixtures/selectors. Earlier failed runs are not counted as passing. These exercise mocked operations, not live server enforcement.
- A further Helpdesk regression completed successfully: view-only cannot reply/change status; adding those grants exposes the existing controls; removing grants closes module access. Its old login-destination expectation was updated to allow the workspace chooser. This is mocked UI permission behavior, not a substitute for server authorization testing.
- Synthetic screenshots of resident mobile and Office desktop request details were inspected. Screenshots run with reduced motion to avoid capturing the opening animation halfway through.

The Windows Playwright process can remain active after reporting all cases complete. Completed cases are reported separately; no clean full legacy-suite exit is claimed. The entire historical E2E suite and the earlier WebKit fixture issue were not certified by this pass.

## Repeat locally

Use the inspected Playwright configuration: local Vite on port 5192, synthetic identity and `bellefort-auth-test.invalid` services. Do not substitute production credentials or reuse a live-connected server.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'readable populated request details|request workflow saves through protected operations|activity applications save pending'
npx.cmd playwright test --project=chromium --grep 'system UI audit' --fully-parallel --workers=2
```

Relevant source: `components/RecordFacts.*`, shared `record-presentation.*`, connected `LiveFeature`, `WorkflowHistory`, `RequestIssuance`, `ParticipationDesk`, services `RequestDesk`/`RequestBusinessDetails`, Office `AccountingWorkbench`/`StaffHome`, and `tests/e2e/auth.spec.ts`.

## Owner/co-developer acceptance and next steps

1. **Homeowner/Renter → Vehicles or Permits:** open a populated request. Read the request type, plate/property and other applicable answers without expanding a disclosure. Blank optional and irrelevant conditional questions should be absent. Check History, Back/Escape and long text.
2. **Office/Security → Vehicles / Office → Review inbox:** inspect a request, select Review & decide, and check the request information stays visible. Use an authorized test account for a real decision. A view-only account must see facts but cannot approve. The server must still enforce the action independently.
3. **Office → issued vehicle/permit:** approval and actual issuance remain distinct. Check the official reference/date form, required fields, saved result, errors and unsaved-close confirmation. Do not assume this pass issued or printed a real document.
4. **Resident → Helpdesk; Office/Board → Helpdesk:** create a permitted test request, reply from authorized staff, change status and return to the resident conversation. Verify permission restrictions and refresh/polling without losing a typed reply. Missing assignment service must show an error/retry, not fake assignment details.
5. **Livelihood → activity → Applications:** verify participant/contact facts, application submission, confirmation by authorized staff and resident withdrawal. No payment or confirmed place is created by opening a form.
6. **Office → Finance/Accounting:** confirm payments applied/not applied remain the same amounts. Selected review facts should be visible. Bank-clearance, fee and imported-receipt limitations must remain accurate.
7. **Each role:** check the listed modules with long populated records, empty/error/read-only states, light/dark, keyboard-only navigation and unsaved input. Check real Android Chrome/iOS Safari, installed PWA and GHL `/portal`; mocked Chromium cannot certify their keyboards, downloads, scrolling or iframe behavior.
8. **Usability acceptance:** ask someone unfamiliar with the app to find a request, read its status, submit a request and locate a payment history without coaching. Record where they pause or choose the wrong action. This human check has not been performed by the assistant and is required before calling the system easy for older/nontechnical users.

Rollout for **this pass**: frontend deployment only after review/authorization. **No new SQL files. No BFE / `bfe-create-account` redeployment.** Previously prepared migrations 099–105 belong to earlier work; do not rerun them just because they remain uncommitted. Review the full working tree separately before any commit or merge.
