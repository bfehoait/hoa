# Screenshot assessment and UI polish ? 11 November 2026

Scope: owner-supplied mobile screenshots across resident, Office, Board, Security, Developer and Driver workspaces. Local presentation changes only. Existing daily scripture content and dashboard integration were owner work already present before this pass; preserved and restyled. No deployment, database changes or approval decisions.

## Findings and changes

| Finding | Local change |
| --- | --- |
| iOS date/time controls extend outside narrow columns in account receipts, Office Finance and carpool forms | Shared native date/time sizing; phone receipt date ranges and carpool date/time fields stack below 600px. Date picker keeps 48px day targets; very narrow phones can scroll that calendar locally. |
| Booking row runs facility, purpose and timestamp together with browser-default styling | Added the missing base record-row layout, separated metadata, theme colors, aligned status and keyboard focus inherited from the shared rules. |
| Developer Home/Support and More both highlighted | Mobile navigation chooses one specific destination; More is the fallback. No route or permission changes. |
| Tall narrow Developer tool cards | Single-column phone cards, compact padding, readable titles. |
| Back to Livelihood stretches beside a labeled select | Grouped application controls in the existing toolbar, bottom-aligned actions and stacked phone controls. Shared buttons no longer stretch vertically with neighboring fields. |
| Booth applications headings touch each other when activities are empty | Consistent section spacing and an explicit no-open-activities state, separate from the applicant history empty state. |
| Repeated permit/listing create action in a customer empty state | Retained the toolbar action and removed its duplicate from the empty state; staff clear-search actions remain. |
| Carpool sections compete with the page heading | Dedicated compact two-by-two phone section selector with space below; map labels constrained to the map width. Synthetic/demo labels and map attribution retained. |
| Document pagination and other action rows have no gaps | Added missing shared btn-row layout. Document pagination is shown only when more than 20 results exist. |
| Small-screen balance tiles wrap awkwardly | Owner requested the original three inset cards restored on mobile after this pass. HOA dues, Water dues and Other remain side by side inside the burgundy balance card; unknown financial values and scope guidance retained. |
| Daily scripture heading/date compete on narrow screens | Wrapped metadata, separate date line on phones, consistent body type, increased verse line height and space before account content. No verse content changed. |
| Staff pages show Account services regardless of workspace | Status strip now names the active workspace. Review queue empty copy addresses staff review rather than telling staff to request a pass. |
| Access choices and Finance metrics lack consistent visual density | Selected access choice has a border and tint without changing toggle logic; compact phone metric padding and staff title sizing. |

During checking, fixed an existing Marketplace effect-driven draft-search reset with a guarded state reset so URL back/forward still synchronizes the search field without an effect-triggered extra render.

## Boundaries and remaining checks

This is screenshot/source assessment, not proof that every screen is visually correct on a device. Device/browser checks remain with the owner under AGENTS.md. No automated UI suites or screenshots were run. No authentication, permission, payment, booking or approval backend rules were changed. Billing setup remains on hold. The earlier performance assessment is a separate follow-up; this pass does not claim to have fixed repeated authentication checks or overall application speed.

Owner verification: iPhone Safari/PWA and Android Chrome, especially 320/375/393px, text scaling, keyboard open, date/time picker, pass modal scrolling/footer, booking list details, navigation selection across all workspaces, document page navigation, and desktop layout regression. Check dark mode and reduced motion. Keep real member information out of verification artifacts.

## Local validation

Production build (including TypeScript) passed before the final minor source/copy refinements; final TypeScript and targeted ESLint checks are recorded in the vault verification note. Build reported existing large entry/map chunks and dependency annotation warnings; no performance improvement is claimed from that build output.
