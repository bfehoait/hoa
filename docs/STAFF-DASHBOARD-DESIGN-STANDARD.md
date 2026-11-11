# Bellefort staff dashboard design standard

Scope: Office, Board, Security, Driver and Developer workspaces. Resident-facing screens retain their existing design. This document is a source assessment and implementation record, not a claim of complete visual or live workflow verification.

## Principles

- Give each task one clear destination. Keep technical maintenance separate from association operations.
- Spend desktop space on useful records, not repeated headings, notices or nested cards.
- Preserve readable text, 48px controls, visible keyboard focus and explicit status labels.
- Keep primary actions together. In long record windows, keep save/cancel actions outside the scroll area.
- Name actions by their real outcome: approve a booking, approve and publish a listing, or record actual issuance.
- Preserve filters and drafts. Distinguish loading, empty, restricted, failed and saved states.
- Keep authority on the server. Editing an address does not establish a property relationship; approving evidence does not clear a payment.

## Desktop density specification

| Element | Target |
| --- | --- |
| Main workspace | Up to 1760px, 24px side padding, responsive to remaining width |
| Top bar | 60px; signed-in scope band at least 40px and allowed to wrap |
| Spacing scale | 8px related actions, 12px controls, 16px sections, 20–24px larger regions |
| Body / secondary text | 16px / at least 14px |
| Buttons and inputs | At least 48px; reduce surrounding space before control size |
| Page header | One title, concise context, grouped actions |
| Cards | One container per meaningful region; avoid a card around a toolbar inside another card |
| Lists | Readable row separators, aligned labels, wrapped long values, clear pagination |
| Long prose | Readable line length; full desktop width reserved for tables and work areas |
| Focus | 2px staff outline with 2px offset; never remove keyboard focus |

Desktop density rules apply at 1024px and above. They do not force side-by-side layouts on narrow screens.

## Source assessment and changes

| Surface | Finding | Implemented in this pass |
| --- | --- | --- |
| Shared staff shell | Header and content margins consume useful vertical space | Shorter header, wider content area, smaller main padding |
| Page introductions | Large spacing; People actions spread across the header | Compact staff title band; grouped People actions |
| People and registrations | Successful connection card repeats information before the filters | Removed that card; result count now accompanies list heading; loading/error/empty handling retained |
| People lists | Large row padding and wide gaps before records | Compact filters, 76px minimum desktop rows and tighter column headings |
| Finance | Full-width selector card, separate notice and nested date-filter card | Selector and necessary availability notice share a row; date filters use separators within the existing region |
| Receipt and lot workspaces | Repeated container padding | Staff-only toolbar, metric, month-selector and lot-row density rules |
| Overview and shared queues | Large metric margins and queue cards | Reduced margins and card padding while preserving labels and action targets |
| Operations and other feature desks | Shared toolbars/cards use generous spacing | Compact staff-only toolbar and record-card padding |
| Finance reports | Large chart/metric padding | Consistent 20px region padding and 16px section margins |
| Member record | Inline editing and persistent actions established in earlier changes | Preserved |

No approval, access, RPC, query-cache or mutation behavior is changed by this density pass. No migration is needed.

## Remaining acceptance work

The shared spacing pass is not a full redesign of every individual screen. Owner browser verification should cover Office People, Finance, Operations, Calendar, Community, Helpdesk, Lot register and Access management, followed by Board, Security, Driver and Developer workspaces.

Check desktop widths of 1024, 1280, 1440 and 1920px, plus 200% zoom. Inspect long names, multiple role badges, expanded filters, loading/error/empty states and open dialogs. Confirm no page-level horizontal overflow; wide data tables may retain an explicitly labelled local scroll region. Verify forms, disclosures, paging and permission-restricted actions still behave as expected.

Further lifecycle work must be assessed separately: draft retention across navigation, unsaved-change protection, cross-screen invalidation, concurrency conflicts, duplicate-submit protection and precise approval/issuance outcomes. Do not describe these as universally complete based on visual consistency alone.

## Follow-up to the 10 November PDF audit

Accepted improvements: readable Finance month labels, an accurate bar explanation, Operations recovery guidance, consistent staff filter label placement, explicit sidebar separation and tighter announcement rows.

- Finance displays short month names while retaining ISO month keys for filtering. Bars compare recorded amounts with the largest displayed month; the gray track must never be labelled unpaid or remaining.
- Operations explains Area and Workflow selection. Empty review queues suggest changing the selection; an empty search result offers Clear search without creating or approving a record.
- Staff workflow filters use labels above their controls. Different workflows retain their necessary filter dimensions rather than forcing identical fields everywhere.
- Desktop staff navigation has an explicit 4px bottom margin between links. Controls retain their 48px minimum.
- Announcement management retains its compact title/action row and disclosure for the full content. Its existing Unpublish confirmation and permission-bound publish flow are preserved.

Disputed audit findings were assessed against source rather than applied blindly. The current muted token is #625E63, with approximately 6.36:1 contrast on white and 5.84:1 on the page background. The reported lighter global tokens were not found in source. Truly disabled components and decorative separators must be distinguished from readable helper text when assessing contrast. Operations already contains grouped workflow options, loading and empty states; announcement unpublish confirmation also already exists. Actual computed styles, disabled states, browser zoom and rendered target sizes still need owner browser verification.

Refresh remains a secondary action. Bulk approval, global keyboard shortcuts and saved searches are separate workflow proposals, not automatic consequences of this visual audit. No accessibility conformance claim is made by this source review.

## 11 November 2026: payment history and lot profile presentation

This targeted pass covers customer Account > Payments and the Office lot profile. Customer receipts now use aligned reference/property/date/amount columns at 768px and above, with stacked rows below that width. Filters, pagination, loading/error/empty states and receipt access are retained.

Lot profiles use compact segmented section buttons with 48px targets and a 2px keyboard focus indicator. Property fields align in responsive one/two/three-column groups. Linked accounts show readable relationship/status labels and Philippine dates, with review actions aligned beside their records. History shows action, operator, local time and reference; expanded change details retain the supplied audit fields and import batch reference. The resident Buyani payment panel remains on customer profiles and is omitted from Office profiles.

No SQL, permission, receipt entitlement, accounting or approval changes are part of this presentation pass. TypeScript and targeted ESLint passed. Owner browser verification is still required at mobile and desktop widths, including zoom, long values, tab switching, expanded audit details and existing edit/review actions.
## 11 November 2026 - Office Finance collections overview

Office Finance > Imported receipts now has four date-range summary cards (recorded amount, receipt count, properties represented and months represented), an interactive monthly bar chart, and a phase amount comparison. Exact amounts and receipt counts remain visible in chart labels. Charts represent imported receipt evidence; they do not report outstanding dues, paid-up property counts, revenue recognition or bank clearance. Missing months are not invented as zero collection months.

Selecting a month filters the existing paginated receipt list and CSV export. The selected month is intersected with the From/To range, while overview charts and cards retain the wider date range for context. Show all months resets the drill-down; changing date inputs clears month selection and resets paging. Filters and chart actions are disabled during export to preserve its scope. Overview and receipt reads use the existing permission-bound service and query keys; matching initial reads share the same TanStack Query key. No extra unbounded receipt download is used for charting.

Receipt numbers open a read-only detail dialog. Existing lot navigation and authorized export remain. Draft payment, payment review and expense review shortcuts open the existing accounting workbench with explicit form/status filters. They do not post or approve records. No accounting queue count is estimated from imported receipts.

The dashboard is opt-in from RecordedFinance only. Customer screens and Office lot-profile receipt presentation retain their existing layout. The Finance chart module is loaded lazily; no chart dependency, backend migration or access-policy change is introduced.

Validation: TypeScript, targeted ESLint and formatting passed; production build passed with the existing large-chunk warning. No automated test suites or browser runs were performed. Owner browser acceptance: open /office/finance, inspect full and empty date ranges, select/reset months, verify partial-month ranges, page receipts, open/close receipt details, verify authorized CSV scope and accounting shortcut destinations. Check desktop at 1024/1440/1920px and 200% zoom; monthly charts have a local scroll region when their labelled bars exceed the available width. Confirm customer Payments and Office lot receipts retain their presentation.