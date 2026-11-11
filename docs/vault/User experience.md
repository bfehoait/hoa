# User experience

## Expanded desktop developer design - 5 November 2026

The developer desktop shell now has one scrolling navigation area between a fixed brand and account footer. The sticky top bar provides module search and a profile link. Module search navigates to the catalogue using a query parameter and filters module destinations only, not resident records. The repeated desktop data-status bar and mobile heading/banner are replaced by one desktop breadcrumb/title/action header. Mobile keeps its original heading, status bar, cards and bottom navigation.

All fifteen module destinations use the same desktop section strip, source summary cards, labelled current-page search/status filter and semantic table. The loaded-page scope is explicitly stated; this is not a global database search. Member sources show the primary role and supplied email; unit sources show the recorded owner. Unknown fields stay unavailable. Status colors accompany text. Inspect continues to use the protected read response and modal detail drawer. No live record or policy is changed by search/filtering.

The desktop overview uses Bellefort branding and an abstract decorative estate illustration, three factual metrics (defined module count, synthetic role-preview count, own effective permission count), grouped module shortcuts and an account-connection summary. No association-wide health, revenue, collection or historical chart is invented. Role previews and all phone views remain separate. The desktop catalogue and module screens have exactly one visible page heading and one refresh action where applicable.

## Developer desktop workspace - 5 November 2026

At 1024px and above, developer monitoring uses a compact heading/status strip, fully visible wrapping section links, and a semantic table for record/reference, unit, status and recorded date. Inspect opens a right-side modal drawer with the same permitted fields. The developer sidebar keeps its main destinations/account visible while scrolling the module list independently, and brings the active module into view. Short desktop windows retain whole-sidebar scrolling so controls remain reachable. Interactive targets remain at least 48px; secondary text remains at least 14px.

Below 1024px, monitoring retains its card list, progressive section navigation and existing mobile dialog/bottom navigation. Hidden desktop/table and mobile/card presentations use the same records and selection; CSS removes the inactive presentation from the accessibility tree. Native modal keyboard dismissal, focus trapping and return to the Inspect trigger remain available; the trigger is explicitly focused for Safari pointer interaction. Color tokens, reduced-motion behavior and safe-area support remain shared. No role grants, database objects, operational writes or hosting changes accompany this visual update.

## Explicit office access and workbook review

Authenticated office navigation now waits for verified server capabilities. Unassigned modules are hidden, direct links show Module access required, and missing permission setup has a retry/workspace route rather than synthetic fallback. Request viewing, replies and status controls are independent; read-only staff see an explicit read-only explanation. Synthetic role previews remain separate and do not simulate real permission enforcement.

Developer → Roles & committee access shows the signed-in developer's exact effective capabilities and twelve committee scopes with unresolved decisions. It offers no browser grant/approval controls. Workbook action labels need owner approval before provisioning. Current browser checks cover 320px/1280px, keyboard-accessible native controls and automated accessibility; actual user acceptance remains outstanding.

## Persistent Board shell and direct developer tabs

Board menu destinations now use Board-scoped URLs, including update detail/back links. Shared document/election/governance pages also retain Board context instead of receiving a filtered resident menu. Role visibility and navigation context remain separate checks. Board report placeholders state availability rather than revealing office-only finance or fabricating totals.

Developer module monitoring is distinct from role previews: fifteen icon categories, direct desktop sidebar links, a five-destination mobile navigation, module subsection controls, paginated recorded rows and read-only field inspection. Identity is unchanged. Setup failure, permission refusal, absent source section, empty page and loaded records have different states. Data is not relabelled live merely because it exists in a JSON section. No approve, role-change or financial-write controls appear in this monitor.

## Request desk and staff calendar - 5 November 2026

The new request desk uses icon-backed request cards, category/status selectors, an explicit New request action, dated conversations and office-only status buttons. Phone filters fit two columns at narrow widths; desktop request rows align status and action. Modals retain input on failed/unconfirmed sends, use stable submission references for retries and never turn a failed live write into a local success. The concern shortcut preselects Concern after the backend read succeeds. The office calendar now stays at `/office/calendar`, with office-specific back/operations links rather than a resident booking destination.

Developer Homeowner/Admin previews use the same request UI with five clearly invented maintenance/concern/complaint/document/support records and a sample office reply. Role namespaces and caches remain isolated; sample replies and status changes are explicitly local. Actual request tables/functions must be installed before live saves are possible. Staff overview summaries distinguish unavailable counts from zero; sample totals never become live finance, billing or election indicators.

Date: 5 November 2026. The user requested a more visual, familiar app experience before roles and permissions work, specifically identifying the wrapped text-only Services navigation as confusing. This phase changes presentation, navigation and discovery within the existing synthetic local preview.

## Everyday entry points

`/services` is a task launcher with six large icon tiles: report a concern, book an amenity, invite a visitor, vehicles/stickers, permits and messages. Search narrows these choices; “gate” also finds visitor requests. Request and visitor shortcuts open the matching local form directly. Tracking and planning have their own section, followed by recent local activity. Active request counts derive only from sample request records and remain unspecified while unavailable.

Request, amenity and visitor pages have short, literal headings and an explicit All services back control. The form-opening route remounts its local screen state on path/query changes so a shortcut opens the intended form during client navigation. Record rows have clear card boundaries, icons, status labels and a trailing arrow. Amenity actions use bordered buttons.

`/more` groups home, community and account/support features. Search scans the catalogue and resets the category filter to All, preventing a previous category from hiding matching results. Category controls let users reduce the visible choices. Marketplace, training and transport entry points lead to their connected directories. Preview/source/maintenance tools are grouped in an expandable section and remain discoverable through search. This organization does not enforce roles or access.

## Shared interaction patterns

| Pattern | Meaning |
| --- | --- |
| Large icon tile | The entire card opens a named service or destination |
| Burgundy button | Primary action, such as opening a form or saving a local sample |
| Bordered secondary button | A secondary on-page action |
| Bordered icon navigation card | Opens another named section; active route remains highlighted |
| Outlined link with icon/arrow | Secondary navigation with a visible touch boundary |
| Category/filter control | Changes which items are displayed |
| Chevron disclosure | Expands supporting explanation or preview controls |

Owned components in `components/Navigation.tsx` provide destination grids, action/back links, navigation groups and supporting disclosures. Long groups initially show a few destinations, preserving the current destination when a deep link opens an otherwise hidden option. More sections expands the remaining choices; Escape collapses them and returns focus to the toggle. Links retain navigation semantics and buttons retain action semantics; these are not ARIA application menus.

The fixed five-destination app navigation is retained. Directory/workbench/source/maintenance pages keep More selected. Connected registry, review, inbox, dispatch and gate pages retain their corresponding visual workspace section. This is a location cue, not authentication or permission enforcement.

## Reduce competing information

Supporting preview explanations use expandable Preview details & limits sections. The persistent Local preview / Sample data banner, synthetic record labels, disabled actual-authority controls and critical form/gate warnings remain. Simulated audience controls for notices and documents have a named preview-options disclosure and an explicit explanation that they do not grant access.

Directory cards show a short summary and compact facts; full descriptions and fields remain in the detail view. Labels such as Services, My requests, Messages and Review desk replace less direct headings on the affected surfaces. The burgundy palette, shared type system, visible keyboard focus, safe-area spacing, reduced-motion behavior and existing financial/workflow boundaries are retained.

## Review before roles and permissions

Walk through these local tasks with the user/boss, then with actual resident testers when authorized:

1. Find a service without reading a long page; report a concern and prepare a visitor request.
2. Return to Services and find My requests or the calendar.
3. Use More categories/search to find a vehicle request, training session and help.
4. Identify the current section after opening a directory or deep link.
5. Expand additional finance/developer sections and use keyboard navigation/Escape.
6. Distinguish a local draft/request from real approval, payment, booking or gate authority.

Automated layout/accessibility and functional checks are recorded in [[Verification]]. They do not prove resident comprehension or usability. No measurable claim of reduced confusion, GCash equivalence, actual-device acceptance or production readiness is made. No GCash/provider code, assets or branding was copied.

All existing direct workflow routes remain available. No schema, payment state, role grant, real identity, server policy, backend connection or deployment is introduced by this phase. Roles/permissions remain later work under the existing rules. See [[Connected workflows]], [[Design system]] and [[Product questions]].


## Account and Updates review ? 5 November 2026

The account statement shortcut is a full icon card below the balance, with one clear view/print/PDF destination. CSV export remains in the account header. The statement uses summary tiles and compact invoice cards on small screens; print retains the complete five-column table and hides app navigation and actions. Financial records remain explicitly synthetic.

Updates now prioritizes announcements, with category icons, shorter summaries and save controls. Directory and conversations shortcuts were removed from this page: directory stays under More, messages under Services. Simulated audience options remain collapsed below the feed for workflow inspection. The duplicate desktop Local preview badge was removed and the shared status strip now says Sample data. These are presentation changes, not authentication or production activation.


## Resident feature pages - 5 November 2026

Vehicles and permits use icon headings, a short introduction, one full-width create action on small screens, searchable request cards and a collapsed requirements/review section. Queue cards keep their icons on phones and place status below the record title to avoid squeezing the text. Counts reflect filtered synthetic records only; they do not verify registration, approval or issuance.

Documents puts search, available records and a clear file-unavailable state ahead of maintenance tools. Document inspection links and simulated audience controls remain expandable. Calendar now filters the agenda to its displayed month, provides dated cards, a marker legend, a month reset and a bookings shortcut. Day cells remain read-only. Directory uses visual category buttons, search, contextual empty states and a clear-filters action. Scenario loading remains opt-in below the results; directory inspection/audience tools expand separately. Opening another directory route resets its category context.

Shared page headings accept a contextual icon and shared empty states use an icon with an optional next action. Messages, profile, notifications, learning, market, elections and transport reuse this hierarchy; cross-workspace inspection links and implementation requirements sit in expandable sections. No real contacts, transactions, files, permissions or confirmations were introduced.


## Developer oversight and actual profile

Developer has a dedicated five-item navigation: overview, connections, role previews, activity and profile. Duplicate in-page console navigation is omitted in authenticated mode so mobile users reach the content first. The role catalogue uses six icon cards with concrete visible/hidden boundaries. Preview banner stays visible on all preview routes, including mobile, and provides a root Exit preview control. Links outside the selected role are hidden; direct URL attempts show a restricted-role screen. Previews do not sign out or change the developer's real account. Printed sample statements hide the preview banner and preserve the full table.

The profile now reads linked member fields rather than editing a fictional resident in authenticated mode. Contact values wrap safely on narrow screens; roles/status are readable badges, account recovery is separate, and no membership/role edit control is offered. Mobile Auth logo alignment is now centered, following the user's latest preference.


## Accounts and QA follow-up

Popups use a title/close header, scrolling body, focus containment/restoration, safe areas and busy-state protection for account/access/request saves. Mobile primary form actions are bottom-positioned, full-width and 52px high; controls remain at least 48px with 16px input text. visualViewport adjusts sheet height; real-device keyboard acceptance remains necessary. Notifications provide private unread badges, All/Unread and New/Today/Earlier. Install suggestions wait until the second signed-in visit, delay 10 seconds and respect a seven-day dismissal. Module/source pagination reduces mobile length. Visuals retain exact labels and missing-data guards.


## Direct navigation and financial reporting

Sign-in opens the assigned primary area directly; the compatibility /workspaces address redirects automatically. All assigned areas remain in desktop navigation and the original mobile More page. No Menu popup is used. Only authorised-role destinations are listed; More never grants a household role. Security/Board/Driver duplicate navigation shortcuts were removed where main navigation already supplies them. Finance now has a Reports tab, four period filters, compact mobile totals, monthly bars, an optional exact-value table and a structured sample CSV.


## UI and connected workflow polish ? 6 November 2026

The developer shell now persists across its authorized Office/Community/transport destinations, preserving sidebar group ordering and scroll. Member preview uses compact account rows. Dues uses an explicit example/account card and a clear Buyani CTA. Shuttle has selected tabs, status visuals, compact metrics, request cards and empty states. Shared workflow tools have grouped section controls and disclosure of technical caveats. Booking offers a native date picker plus selectable Philippine-time slots, disabling reserved/past intervals while retaining typed input. Other residents see occupied intervals only.

Tabs & permissions provides scoped user overrides and editable role/committee defaults, with explicit admin delegation. Marketplace listing covers/optional HTTPS links stay private through review; listing changes return to review. Follow docs/UI-ACCESS-MEDIA-SETUP.md and docs/UI-UX-FIX-LIST.md. No live changes were performed.

## Preview overlap and booking/marketplace follow-up — 6 November 2026

Account preview measures its own banner height with ResizeObserver and offsets the fixed sidebar, preserving the logo/navigation across wrapping and viewport changes. Connected operations/marketplace pages receive the account-record label. Booking is now a wide calendar/time composition on desktop, with native date input on narrow screens, explicit reset/clear behavior, reserved-range feedback, typed-time fallback and clear unavailable-facility setup guidance. No dead New booking form is offered without eligible facilities. Live preview remains read-only and explains why submissions require direct sign-in.

The developer marketplace monitor now links to actual posting/review tools. The root blocker was a role-based route filter excluding admins/developers from /directory/market; only marketplace/learning workspace routes were added for these roles, retaining server-owned create/review/publish checks and keeping household finance routes restricted. Query-string section selection preserves the booth-event context. No SQL or live database changes were made.

## Member-first permissions and operational navigation - 7 November 2026

AccessManager is the sole member picker. Selecting a name opens the existing TabAccess matrix, with 48px Read/Edit controls and an explicit inherited state. Scoped individual rules and role/committee defaults remain distinct; reasons, optimistic concurrency, save/discard and server rejection are visible. Existing role/status/committee forms are in the same selected-member screen. Phone save controls clear bottom navigation. The existing shuttle screen uses vehicle availability selection and an honest pickup-stage timeline, without invented maps, location or ETA. Record-monitor actions say View details and point to existing working services, especially announcement creation and review. No duplicate forms or new operational backend were introduced. See AUTHENTICATED-SERVICES.md and Verification for test scope and remaining limitations.

## Permission clarity correction - 7 November 2026

Supersedes the previous Read/Edit dashes. Current permissions now have explicit text badges separate from a visibly selected rule. Use defaults is a labelled choice; it never implies permission. No access, Read only and Read & edit have visible text/checkmarks and native radio keyboard behavior. Some changes allowed is explained with individual action rights. The existing manager-only read needs prepared 016 to supply effective permissions; older installations show Not reported. Current labels do not change while a draft is unsaved, and the save bar is absent without changes. Local synthetic checks are recorded in Verification; no live installation occurred.

## Labelled access switches and developer posting - 7 November 2026

The owner prefers visible toggles. TabAccess now uses No access / Read only / Read & edit switches with On/Off text, one custom level at a time, and a separate selected Use defaults button. Switching off a custom level returns to inheritance; current server-permission badges are unchanged until a save succeeds. This supersedes the preceding radio appearance without changing the backend rule model. Desktop and mobile developer overviews expose the same existing announcement and submission/review workflows. Developer-only tests validate the routes without assuming an admin role; the first mobile gap was fixed and retested. See the latest Verification entry for 310 unit tests and ten focused browser cases. No additional migration beyond the prepared 016 summary update.


### 10 November 2026: member details edit in place
Office member Details now keeps the same label/value rows during editing. Editable values become inputs in their existing rows; recorded email, roles/status, sign-in information and profile preferences stay visible. Save changes and Cancel replace Edit details; correction reason, snapshot checks and server audit remain. Customer screens and backend migrations unchanged. TypeScript checking performed; owner browser verification remains for this row-layout revision.


### 10 November 2026: persistent Office member actions
Moved member edit/save/cancel/refresh actions into the existing Modal footer outside its scroll container. Save uses the original form ID so required fields and correction reason retain native validation. Error feedback stays with the persistent actions. Footer wraps on smaller screens and inherits safe-area padding. Scoped to the Office member workspace; no shared dialog or backend changes. TypeScript passed; owner browser checks remain for scrolling, save validation and mobile keyboard behavior.


### 10 November 2026: compact staff focus outlines
Staff workspace keyboard focus outlines now use 2px width and 2px offset, replacing the 3px/4px global appearance. Search focus follows the same compact treatment. Standard input borders remain 1px and keyboard focus remains visible. Customer workspace focus styling unchanged. CSS-only adjustment reviewed in source; browser appearance remains for owner verification.


### 10 November 2026: staff dashboard density standard
Added docs/STAFF-DASHBOARD-DESIGN-STANDARD.md with spacing rules, source findings and remaining acceptance checks. Staff desktop shell now uses a shorter top bar, 24px content gutters and up to 1760px work area. Shared introductions, navigation, queues, operations cards, registry toolbars and finance reports use tighter spacing with 48px controls retained. People merges counts into its result heading and removes the redundant success card; Finance places its selector beside its availability note and removes nested filter framing. No backend/query/approval changes; shared visual rules are staff-gated. TypeScript passed. Owner browser checks remain; no automated suites or live database work performed.


### 10 November 2026: accepted Office audit refinements
Finance month buttons now display localized short month/year labels while filtering retains ISO values. The chart explanation correctly describes amounts relative to the largest displayed month, without implying unpaid balances. Operations retains grouped choices and now explains Area/Workflow selection; empty staff review searches offer Clear search and recovery guidance. Staff workflow filter labels align above controls. Announcement desktop rows use tighter spacing and staff navigation an explicit 4px gap. Existing unpublish confirmation, publication permissions and customer layouts are preserved. TypeScript passed; build and owner visual acceptance tracked separately. No automated suites or live database calls.

### 11 November 2026: business form restoration through 059
The previous production forms are treated as real business requirements. Local implementation restores category-specific Helpdesk answers and Office assignment/priority/resolution, named household occupants, association/contact management, reviewed property attributes, structured booth vendor applications, additive listing/report/candidate questions, and candidate photos. Finance gains draft -> independent review -> post/reverse forms for rates, invoice-generating billing runs, explicit payment allocations, expense categories, expenses and monthly reported totals. New invoices are not yet connected to resident balances; no rates, payments, accounts or entitlements are seeded on install.

Connected carpool forms now sit alongside a separately labelled map demo. Shuttle adds private pickup notes and assigned-driver arrival estimates without extending its immediate-service deadline. Office can record Pending bookings for selected eligible residents without impersonating them. Garage sales have individual item publication/rejection/withdrawal; changing a public item sends it back to review. New accounting and item queues appear in the existing Office review inbox.

Prepared SQL: 048 through 059, in numeric order after 047. Owner instructions and browser checks: docs/BUSINESS-FORM-RESTORATION-SETUP.md. Current business coverage and remaining gaps: docs/LEGACY-FORM-COVERAGE-ASSESSMENT.md. This is a substantial restoration, not a claim of full business parity: bulk import management, some identity/delivery preferences, security hold/scheduling policy, association-rule maintenance, resident ledger integration and certified elections/disclosures remain explicitly tracked.

Checks: TypeScript/production build passed. Targeted ESLint passed for new restoration components/shared files and the metadata inventory script. An isolated synthetic in-memory SQL check compiled 048-059 and exercised selected actual service calls, protected refusal cases, public item privacy and the combined business inbox. Build retains dependency annotation and large-chunk warnings. No automated test suite, end-to-end browser run, axe sweep, live database connection, SQL application or deployment occurred. Owner mobile/desktop/Storage/real-role verification remains required.
### 11 November 2026: capture form values before pending state
Owner reported that the checked relationship and reference were rejected by property linking. Source review identified that PropertyLink passed its live HTML form to an asynchronous mutation, which read FormData after the pending render could disable its fieldset. Disabled controls are excluded, producing missing relationship/reference values despite visible input. Submission now snapshots FormData synchronously before onBusy/mutateAsync. Editing a linking field also clears the previous validation error.

The same live-form mutation pattern was corrected in accounting save/decision, household occupant, association/contact settings, property attributes, shuttle estimate, Helpdesk handling and garage-item save/decision forms. Server relationship validation, independent review, stale-record checks and permissions remain intact. Member expiry labels use the last query-refresh timestamp rather than Date.now during render.

Targeted ESLint and TypeScript checks passed. No automated test suite, browser run or live mutation was performed; owner should refresh and retry the existing property-link form. No new SQL migration is needed. Owner-supplied readiness output already reported all 25 checked service functions ready and all four metadata checks true; that metadata result does not establish browser workflow success.
### 11 November 2026: approved links, dev-module crash and customer address display
Owner confirmed the property link was saved as an approved household relationship. The supplied Console error identified a missing default export from PropertyBusinessDetails. Its disk source had the export, but a direct local Vite HTTP check returned an empty JavaScript module. The watch configuration now waits for file-write stability; the server restarted its transform cache and subsequent checks served expected exports for all four affected property/account modules. Office property attributes are now lazy-loaded only on Office screens. The error fallback no longer claims every session is a preview or that a preceding save made no change.

Customer Home and My account now prefer current approved linked-property addresses instead of reading only recorded member.unit text. Prepared migration 060 adds the caller-only read and the narrowly extended authorized preview read. It does not rewrite recorded addresses, create memberships, grant ownership/receipts or calculate balances. Multiple relationships to the same lot are grouped; staff customer summaries do not show association-wide lots. Hard-refresh both tabs after the owner applies 060; do not recreate the already saved link.

TypeScript/production build and targeted lint passed; existing build warnings remain. Isolated synthetic SQL checks passed for caller scope, revoked links, preview target and caller identity restoration. Local module HTTP checks passed; no browser automation, automated test suite, live database connection or deployment occurred. Setup and owner checks: docs/ACCOUNT-LINK-DISPLAY-RECOVERY.md.
### 11 November 2026: owner-approved household receipt policy and complaint form fix
Owner explicitly selected automatic visibility of all existing and future receipts for each current approved household link. Prepared migration 061 adds household-linked Finance view/own eligibility and extends the receipt predicate and optimized 036 history query. Active imports, active account, started/unexpired approved household membership, property visibility, configured access and explicit denials remain binding. Owner entitlements, approvals, exports and balance calculations remain separate. Overlapping owner entitlement/household access does not duplicate rows or totals. New history access is read dynamically; no receipts or memberships are seeded or modified on installation.

Customer Properties now labels the action Link another property when an approved own link exists. The complaint-screen crash was independently identified in the shared Field helper: a child array containing input/help text was cast to one element and child.props.id dereferenced. Field now locates the control safely, generates an ID where needed and associates labels/error descriptions while retaining helper children.

Checks: migration 061 compiled in isolated synthetic SQL; selected checks passed for past/new receipt visibility, unrelated lots, single-receipt/history agreement, export refusal, revoked/expired/future links, explicit Finance denial and duplicate-free overlapping paths. The actual Field function rendered locally with input/helper/error and generated-ID cases. No automated test suites, E2E browser runs or live database changes occurred. See docs/HOUSEHOLD-RECEIPT-ACCESS.md for rollout and owner verification. Owner must run 061 after installed 060, then refresh and verify live outcomes.
### 11 November 2026 - form action sizing assessment and correction

Static inventory: 54 native form declarations in 37 rebuilt TSX files, including search/sample templates; shared field helpers also reviewed. See docs/FORM-ACTION-LAYOUT-ASSESSMENT.md for the full scope, evidence and browser acceptance list. Registration repeat-member removal moved into its own action row. Six shared grid-form styles now use content-sized direct actions on desktop and retain full-width mobile submissions. Repeat-item/link helpers are compact; flex actions align vertically. Focus outlines are consistently 2px, with input-wrapper focus adjusted to avoid double rings on search/password buttons. Explicit block actions, 48px targets, mobile stacking, submitted fields, pending states and server authority remain intact.

TypeScript/production build, targeted ESLint and formatting passed; bundle-size warning remains. No automated suites or browser runs. Owner still needs rendered-size, zoom, keyboard and workflow verification. No SQL or environment-file changes.
### 11 November 2026 - linked directory, recurring dues, Helpdesk and health notes

Prepared migrations 062 (bounded staff linked-address lookup and own linked-lot monthly rate) and 063 (optional private health notes, registration proof/reference no longer required, approved-registration note transfer). See docs/MEMBER-DUES-HELPDESK-UPDATE.md for installation, privacy boundaries and owner browser acceptance. Workbook inspection used headers and aggregate counts only: 675 Linear Park YES/PHP900, 240 NO/PHP800, six N/A; Verified Monthly Rate blank throughout. Owner confirmed the monthly policy. Unknown classification remains unavailable; no balance, invoice or recurring posting is inferred.

Office People shows approved linked addresses separately from recorded address text, with refresh and unavailable states; member workspace labels the additional-link action clearly. My account offers linked-lot HOA rate and Buyani payment access without sample account substitution. Helpdesk replaces manual Title/topic entry with category-specific type/specific-type selectors and Other paths, generating the existing server title. Registration removes proof/reference fields and includes optional private health note. Settings/My profile can edit the resident's own note; authorized Office managers can read it in member Details. Health data stays out of bios, directories, audit payloads and notification content. Preview modes do not read/edit it.

TypeScript, targeted ESLint and formatting passed. Production build passed with the existing chunk-size warning; final copy/conflict-recovery edits were typechecked and linted. Migrations 062/063 compiled in an isolated empty synthetic PGlite schema, including read SQL and the guarded 028 registration patch. This is not live policy validation. No automated suites, browser submissions, live database connection, SQL application, deployment or .env.local read/change occurred. Owner must install 062 then 063 and verify the flows, privacy permissions, expiring links, Other paths, old/new registrations, monthly-rate classifications and Buyani reference externally. Optional read-only metadata script: scripts/verify-member-request-updates.sql.
### 11 November 2026 - recorded HOA balance tallies with total

Implemented owner-approved Office-first verification flow; see docs/CUSTOMER-HOA-BALANCE-SETUP.md. Migration 064 adds Imported receipt allocation as a draft/submit/independently post/reverse accounting kind. It applies existing receipt evidence to the actual posted invoice month without creating another payment; the generic accounting Review inbox routes it correctly. Receipt and invoice caps, source-property matching, pair deduplication and billing-reversal dependency checks use the existing accounting-posting lock and actor/version/audit path. Original receipt entitlements and imported collection totals are unchanged.

Migration 065 supplies a caller-scoped read of posted HOA invoices and posted manual/imported allocations for current approved active-lot links. HOA and total recorded balance use the same nonnegative remainder, and the shared response schema enforces agreement. Home/My account share the read; monthly details show billed/applied/remaining/status/due dates with paging. Missing bills are not debt and no bills is not zero. Water/Other remain unknown; the total is explicitly recorded HOA only. There is no scheduled automatic posting, inferred billing start or oldest-first historical assignment. Office still verifies baseline and posts monthly billing runs and receipt mappings. Preview gets an audited read only; synthetic previews do not wait for a disabled live query. Direct visible balance summaries refresh every 30 seconds and on focus; accounting decisions invalidate registry reads.

Validation: TypeScript, targeted ESLint, formatting and production build passed (large-chunk warning remains). Isolated synthetic PGlite checks compiled 064/065; three PHP800 invoices less PHP800 allocated evidence returned PHP1600 in both HOA and total with two unpaid months. Self-review, duplicate/excess source/invoice allocations and reversing an allocated billing run were rejected. Reversing the allocation restored PHP2400; an unrelated account received zero invoices. Role permission helpers were stubbed, so these checks do not prove live role configuration, preview behavior or browser acceptance. No automated suites, live database/SQL application or deployment. Owner applies 064 then 065 after 063 and verifies live access, Office review, partial/zero/multiple-lot/reversal cases and mobile/desktop UI. Optional metadata check: scripts/verify-hoa-balance-readiness.sql.

### 11 November 2026 ? final screenshot UI polish

See [Final UI polish assessment](../FINAL-UI-POLISH-ASSESSMENT.md). Fixed native date sizing/phone date layouts, missing booking-row styling, single mobile navigation selection, duplicate customer empty-state actions, shared action-row spacing and participation section rhythm. Polished scripture metadata, mobile Developer cards, access choices, Finance metrics and active-workspace wording. Existing financial/auth/approval rules unchanged. Owner scripture additions preserved. Local production build passed with existing bundle/annotation warnings; final TypeScript and targeted ESLint checked. No automated browser suites or device checks; owner iOS/Android and desktop verification remains required. Performance/authentication optimization is a separate unfinished follow-up.


### Balance card preference ? 11 November 2026

Restored the original three inset cards (HOA dues, Water dues, Other) side by side inside the burgundy balance card on phones, as requested by the owner. Retained the independent date-filter overflow fixes. CSS-only change; no financial behavior changed.
