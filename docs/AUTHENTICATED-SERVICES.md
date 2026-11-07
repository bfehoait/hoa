# Account services without local sample fallbacks

Updated 7 November 2026, Asia/Manila. Changes are local; no publication, live database operation or account provisioning was performed.

## Normal account experience

Use VITE_APP_MODE=authenticated for normal local use; this is already the default. Supply only the owner's approved browser-safe backend settings through the existing private environment configuration. Missing settings leave sign-in unavailable; they never open a sample account.

Release builds select authenticated mode even if VITE_APP_MODE was set to preview. An explicitly requested local development preview remains available for isolated testing and keeps its required sample labels. Its fixtures are not deleted or renamed into real records.

The signed-in home and service pages use the member identity and permission-filtered destinations. They do not display sample balances, invented payment history, fake announcements counts or local sample activity. Account screens still require their existing verified-member and service permissions.

## Unfinished services

As requested, unfinished services remain visible where navigation permissions allow, with **Not available yet**, an explanation and allowed return/support links. They cannot create local records that look official.

This applies to the standalone community calendar, vehicle/sticker and permit screens, legacy administration, property/household change staging, office settings/activity placeholders, board financial reports, legacy security incident/vehicle pages, sample CSV staging and the demonstration billing calculator. Unknown child paths in these legacy workspaces cannot fall through to a local demonstration.

Authorization is checked first. A legacy URL without an applicable module permission mapping can still show **Module access required**, rather than the unavailable screen. No role or module grant was widened to make placeholders visible.

## Connected services retained

- Protected Helpdesk request and reply workflows; the resident inbox now opens that workflow.
- Facility bookings and visitor passes, with their existing server validation and approval states.
- Published announcements, board documents and election candidate information; publication is not a certified election or ballot service.
- Marketplace submissions, reviewed publication, optional cover and contact links.
- Private property/receipt access and external payment-provider navigation; a link never confirms payment.
- Shuttle requests, driver lifecycle and service history.
- Existing role/committee access management, member lookup, notifications and developer monitoring.
- Read-only actual-account support sessions under the developer's unchanged login.

These interfaces check their actual service when opened. The existence of an interface is not a global backend-health claim. Missing schemas, permissions, configuration or records remain unavailable/error/empty states as appropriate.

## Local data isolation

The local resident and workspace query hooks are disabled outside explicit sample contexts. Their query functions and mutation functions also reject normal account use, including a manually triggered refetch. Existing local sample stores are neither loaded nor silently replaced by account navigation.

The developer roles destination opens actual role/committee access management. Authenticated role-simulation URLs display an unavailable screen with an unscoped return to the developer console. Actual account preview remains read-only and continues to use the protected read gateway.

Existing database records were not deleted, filtered by guesswork or relabelled. Any test records already stored on the server require a separately authorized, identified cleanup; no live cleanup was attempted.

## Validation and remaining release work

- Typecheck, ESLint and production build passed. The build reports third-party zod annotation notices and a main-chunk size warning; these are not a performance-budget pass.
- All 304 unit tests across 22 files passed.
- Eighteen focused browser cases completed successfully across Chromium and mobile WebKit: normal home/services, sample-store isolation, unavailable legacy routes, board publication, developer access/simulation boundaries, marketplace navigation/media, role-default changes, actual account preview and booking/visitor flows. The owned Windows wrapper was stopped after all expected case results because it remained running.

Reproduction:

    npm.cmd run typecheck
    npm.cmd run lint
    npm.cmd test
    npm.cmd run build
    $env:BELLEFORT_TEST_AUTH='configured'
    npx.cmd playwright test --grep 'authenticated view without sample fallbacks|consistent workspace UI|facility and visitor|developer account interface preview' --reporter=list --output=.artifacts/production-view-regression

Browser tests use the configured synthetic .invalid API and mocks. They do not connect to a live backend. The full browser suite was not claimed green or rewritten in this change.

No new SQL migration is needed for this frontend change. Production acceptance still needs authorized live-service validation, real Storage delivery, physical-device/accessibility/performance work, monitoring/recovery evidence and approved operational policy. The dated measurement in UX-STANDARD.md remains historical; its unverified cells were not automatically promoted by this implementation.

## Working service entry points (7 November 2026)

Developer System modules is a record viewer. Its row action is now **View details**.
Each module links to its existing service rather than introducing another form or
copying legacy source records into a new record set. The service checks its own
permissions; a visible developer link does not grant operational authority.

| Need | Existing destination | What to expect |
| --- | --- | --- |
| Announcements | Office → Announcements; Create announcement from the monitor | Enter title, details, proposed audience/date and publication consent; submit for review. Authorized reviewers and publishers use Office review. Submission is not publication. |
| Marketplace | Marketplace workspace | Choose a section, submit a listing, follow review; staff use the existing review view. |
| Facilities | Office → Bookings | Review bookings using the dedicated booking service; events have a separate existing submission workflow. |
| Visitors | Office → Visitors | Manage visitor passes. Legacy security incidents, vehicle and roster editing remain unavailable. |
| Requests and replies | Office → Requests / Inbox | Use the existing Helpdesk and conversations. |
| People and access | Office → Residents / Roles & committee access | Look up accounts and open a member's name for permissions. This does not provision a new authentication account. |
| Finance | Office → Finance / expense evidence | Use supported finance views and evidence submissions. No generic control marks a payment as paid. |
| Documents and election information | Office → Documents / election setup proposals | Existing submission and review tools; these are not a certified voting system. |
| Shuttle and carpools | Shuttle service / Transport directory | Existing request lifecycle and separate private carpool submissions. |
| Contact directory | Announcements notice only | Direct contact-directory editing is not connected. A notice does not update the directory. |
| Audit | Recorded history | History is generated by supported operations, never added manually. |

The access page has one member picker. Opening a name shows scoped current
permissions, tab search and labelled rule choices: Use defaults, No access,
Read only and Read & edit. Current permissions come from the server, separately
from unsaved selections. Explicit save with a reason is required. Role/status and committee grants remain in the same
member view under a disclosure. Group defaults are a separate disclosure. Pending
tab changes must be saved or discarded before switching scope or returning to the
account list. Server refusal retains the draft. The optimistic-concurrency
baseline is captured at the first change, not replaced by a background refetch.
Approval, publication and permission-management authority remain separate grants.

The shuttle page uses Bellefort tokens, selectable real vehicle availability,
pickup/destination and a vertical timeline of existing request statuses. Browsing
a vehicle does not assign it to the request. No map, live location, ETA, timetable
or new booking service was introduced. Account preview remains read-only.

Validation for this follow-up: typecheck, lint, build and 304 unit tests passed.
Eight focused authenticated-mode browser cases passed across Chromium/mobile
WebKit with synthetic API mocks, including announcement submission and denied
posting. Permission/shuttle width-theme loops passed overflow and axe checks.
Two additional mobile record-viewer probes passed. Broader probes still have
unresolved desktop selector/drawer expectations and an older structured-listing
mock failure; the full suite is not claimed green. Exact commands and limits are
appended to docs/vault/Verification.md. No additional migration is needed.

## Permission clarity follow-up (7 November 2026)

This supersedes the earlier dash-style Read/Edit controls. The selected access
rule now has a visible label, checkmark and border, using native keyboard-operable
controls (now labelled On/Off toggles; see the follow-up below). Separate current-access labels say Can read / Cannot read and
Can edit / Cannot edit. Partial editing rights say Some changes allowed and name
the allowed/blocked create, reply and status actions. Unsaved choices never replace
the current server snapshot. Returning to the saved rule clears the draft, and
the sticky save bar is absent until there is a change.

Apply **202611070016_access_permission_summary.sql** once after the already installed
015. Do not rerun 014 or 015. It extends the existing manager-only bfe_tab_access
read with effective permissions resolved by bfe_can_for. It changes no member
rules, grants or authority semantics. Without this update, the frontend explicitly
says Not reported; it does not interpret a missing override as permission. Group
defaults show rules only, since effective access varies by member. The existing
verify-ui-access-media.sql now includes permission_summaries_installed.

Local validation: 309 unit tests across 22 files, typecheck, lint and production
build passed. Six focused browser cases passed across Chromium/mobile WebKit for
current versus draft access, labelled rules, keyboard selection, denial recovery,
older-endpoint fallback and group-default saves. Permission screenshot checks used
390/1440 widths, dataset.theme light/dark and axe; there was no page overflow or
WCAG 2.1 A/AA axe violation in those combinations. Physical devices and live-service
validation remain unverified. No live connection or deployment occurred.

## Labelled toggles and developer creation (7 November 2026)

As requested, the access levels now use three native checkbox switches with
visible On/Off text: No access, Read only, Read & edit. Enabling one disables the
others. Disabling it returns to defaults; a separate Use defaults button visibly
indicates that state. Current permissions, unknown-server handling, unsaved marks,
save reasons and server denial/concurrency checks are unchanged. No new migration
was added; the existing 016 summary update is still needed for current permissions.

An active developer can create through the existing connected workflows. The
developer overview now links directly to Create announcement and Create & review
submissions. Both use the existing forms and protected endpoints, without an admin
role workaround or a second posting implementation. Announcements still start as
Submitted; publication is a separate action. Unsupported legacy editing, payment
confirmation, authentication-account provisioning and certified voting were not
added or implied by these links.

Local SQL tests verify can_create for every connected feature definition using a
developer-only account and submit an announcement and business listing as that
developer. Browser tests open every connected submission form as developer-only,
and submit the announcement with mocked server confirmation. No live record was
created. Exact validation counts are in the latest Verification vault append.
