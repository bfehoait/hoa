# Office console screenshot implementation

Implemented locally on 14 November 2026 from the owner's Office reference screens. Existing backend contracts and authority remain in place. The calendar keeps its current functionality.

## Coverage

| Screen | Presentation and retained behavior |
| --- | --- |
| Shell | Compact 264px desktop sidebar, existing Bellefort logo, Office screen search with Ctrl/Cmd K, workspace selector, existing authorized destinations, theme and notification controls. Search filters permitted screen destinations; it does not claim to search private records globally. |
| Overview | Existing queue-based attention cards, authorized receipt charts, then a current queue worklist. No invented weekly metrics, response SLA, debt aging or collection percentage. Additional Office tools remain available. The two inbox projections share the existing query key and polling service. |
| Review inbox | Queue list beside a selected-queue detail panel. Current counts and decision access come from the existing inbox projection. Open uses the existing queue destination helper. Individual approvals, reasons, conflicts and account provisioning remain in their authorized desks. Pending lot review remains accessible. |
| People & accounts | Table-style rows, member initials, existing full role lists and linked-property distinctions. Status chips use the existing server status filter, search retains name/email/unit choices, and pagination, Create account and member workspace dialogs remain connected. |
| Finance | Existing imported-receipt dashboard, metrics/charts and receipt detail/export tools retain their source, filters and permissions. Accounting drafts, allocation, payments, expenses and independent review remain separate and accessible. Refined chart/card surfaces match the reference. |
| Operations | Visible links to visitor passes, permits, vehicles and amenity bookings, plus the full workflow area/selector. Desktop feature reviews use compact summary tables; Open exposes the original full record/actions. Narrow views retain the original cards. No existing fields or submission/review handlers were replaced. |
| Facilities & calendar | Full-width desktop month with continuous grid styling, highlighted current/selected day and rounded surfaces. Existing facility/status filters, counts, month navigation, daily agenda, pagination, reservation details and booking approval destination remain intact. Day counts are not replaced with invented event names. |
| Community | Responsive announcement cards with excerpts, full text/image disclosure and retained publish/unpublish/history actions. Existing author, consent, capability and version rules remain unchanged. |
| Helpdesk | Desktop request list beside the selected conversation. Existing request/thread queries, notification selection, reply validation, client request IDs, status actions, business-detail editors and permissions remain. Filters, pagination and other request selection lock during unsaved edits/saves. Reply/status actions retain their server handlers. Page refresh/close warns during edits, and leaving through links/sidebar search requests confirmation; browser-history navigation still needs owner verification. Narrow views retain the existing Sheet. The same Thread instance keeps reply state when its responsive presentation changes. |
| Lot register | Desktop semantic results table with lot ID links; original cards remain at narrow widths. Existing phase/status/search filters and all detail/link/receipt dialogs remain. Recorded homeowner text is not labelled as verified ownership. |
| Roles & permissions | Visible Members, Group defaults, Committees and Access reference tabs reuse the existing complete access editors. Dirty/pending group-default edits lock tab switching. Account-search deep links, member dialogs and independent server capability checks remain. |

## Differences from the draft

- The inbox service supplies aggregate queues, not a unified list of individual applications, bookings and permits. The split view therefore selects queues and opens the existing decision desk. No fake inline approval was added.
- Registration approval does not acquire an automatic welcome-email promise from the screenshot. The existing account-creation and private sign-in instruction workflow remains.
- Financial charts describe recorded receipts. No collection-rate denominator, debt-aging buckets, invoice clearance or synthetic sample amount is inferred.
- People uses supported status chips rather than inventing global role filtering that its current query does not provide. Lot filters retain real registry criteria rather than guessed occupancy categories.
- Full role/committee access settings and all implemented workflows remain available even where the mock only showed a few rows.

## Validation and owner acceptance

Local verification: TypeScript/production Vite/PWA build, targeted ESLint/Prettier, `git diff --check`, ten account-integrity PostgreSQL regression cases and generated BFE editor artifact parity. A static scan found definitions in prepared migrations for all 79 literal frontend BFE RPC names matched by the scan; dynamic calls, gateway configuration and deployed migration state are outside that check. Existing Zod annotation and large map-chunk build warnings remain.

No live database, deployed Edge, browser, full automated suite, E2E or axe verification was performed. The account suite uses synthetic local PostgreSQL fixtures; it does not certify live provisioning or the new UI.

Owner browser checklist:

1. Check Office navigation, screen search, workspace switching and notifications in light/dark themes and narrow/desktop layouts.
2. Select review queues; open registration, lot link, booking, permit and vehicle review. Confirm permitted actions succeed and denied actions remain denied.
3. Search/page People, inspect all assigned roles and approved links, create an authorized account, retry safely, and inspect registration approval through the existing workflow.
4. Check receipt totals, dates, phase charts, detail/export permission, and accounting navigation without assuming imported receipts establish current debt or bank clearance.
5. Open Operations table records and their full review dialogs; check mobile cards, workflow changes and record history.
6. Navigate calendar months, filter facilities/status, select a day, page its agenda and open reservation details/approval.
7. Open announcement text/images and verify publish/unpublish/history under an authorized Office account.
8. Open a Helpdesk notification and a list item; send a reply, receive updates, update status, edit/cancel request details, check pagination and unsaved-edit guards, including resizing and browser back/forward.
9. Open a lot from desktop and narrow views, then check approved relationships and permitted receipt history.
10. Check all access tabs, save/discard group defaults, individual member changes and denied permissions.

This Office UI pass requires **frontend deployment only**. No new SQL or BFE redeployment is required for these changes. Earlier account-integrity rollout remains separate. Nothing was committed, pushed, published or changed in live hosting/database state.
