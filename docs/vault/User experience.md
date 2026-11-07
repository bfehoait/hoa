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
