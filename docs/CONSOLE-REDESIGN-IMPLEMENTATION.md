# Staff console redesign - 14 November 2026

Implemented locally from ARTIFACT-CONSOLE-DESIGN.md and Claude's handoff, with the real application as the authority for data, permissions, fields and actions. This is a console-wide presentation pass; specialized operational screens keep their existing review and submission workflows.

## Coverage

| Area | Result |
| --- | --- |
| Staff shell | 264px desktop sidebar, compact workspace navigation, workspace breadcrumb, restrained elevation, 1340px content measure and consistent typography. Existing mobile navigation, workspace options, logo, notifications and theme controls remain connected. Synthetic chips appear only in synthetic contexts; existing preview banners remain. |
| Office overview | Approval and Helpdesk action cards use the existing authorized review response. Waiting and in-review counts remain separately described. Queue breakdown and follow-up/dispatch remain available. Zero counts come from accessible queues; no assumed queues are introduced. |
| Overview collections | StaffCollections reuses useReceipts / bfe_lot_receipts without changing its arguments/schema/service. It is enabled only for real accounts with association finance view permission and route access. Shows all-date imported collections, the latest recorded month, six available monthly bars and receipt amounts by phase. No export is requested. Error feedback and retry remain local to this section. |
| People / registrations | Consistent filter toolbar, table-like directory rows, status badges, icon treatment and result headings. Existing search modes, filters, pagination, create-account action and review dialog remain. |
| Member workspace / account forms | Clear segmented sections, readable detail cards, pinned existing actions and explicit reason feedback from the earlier account work. Account validation and created/member_linked confirmation remain intact. |
| Review inbox | Category icons, queue cards, counts and existing links to authorized desks. The inbox does not turn unrelated workflows into one generic Approve action. |
| Finance / collections / accounting | Unified summary cards, receipt charts, scrolling tables, task navigation and existing draft/review/posted forms. Posted accounting and imported receipt evidence remain distinct. |
| Operations / permits / vehicles / passes | Existing connected record cards, filters, facts, review dialogs and booking/visitor actions use the shared console surfaces. No operational policy or field is removed. |
| Facilities / calendar | Filter card, month and agenda panels, current-day marker, selected day and reachable day controls. Existing legends, booking availability and reservation workflow remain. |
| Community / documents / activities | Existing announcement/listing/document cards and previews adopt consistent elevation and typography. Publication audience controls and consent/expiry/review remain. |
| Helpdesk | Grouped request rows, filters and existing conversation/reply handling adopt the console style. Retains authorized handlers and the existing focused conversation dialog rather than introducing a second reply implementation. |
| Lot register / receipt history | Registry cards, filters, property tabs and receipt tables retain existing queries, ownership distinctions and approved receipt access. |
| Roles / permissions | Existing three-level TabAccess matrix, limited edit, inherited defaults, dirty-state protection, server saves and permission drawer retained. Suspension copy describes portal access rather than claiming the Auth login is deleted or disabled. |
| Developer | Existing tool cards, diagnostics, account support and access screens share the console style. No invented uptime, latency or connection status. |
| Board / Security / Transport | Shared cards, document/election layouts, request desks and shuttle fleet/dispatch components adopt the same styling under staff scope. Existing real/synthetic boundaries, duty controls, available actions and permission filters remain. No live vehicle ETA/GPS claim added. |
| Forms / dialogs / states | Shared staff buttons, badges, empty states, cards and native dialogs. Staff sheets center on larger screens with their existing size variants; resident sheets remain bottom sheets. Focus trap, Escape/scrim handling, busy state, unsaved-change protection and submit handlers are reused. |

## Deliberate adaptations to the draft

- Actual tokens are retained for contrast. Body text stays 16px, secondary text at least 14px and actionable controls at least 48px. The draft's smaller control/type examples are not copied literally.
- Dark-mode staff styling now follows the theme attribute on the document root. Staff table containers retain horizontal scrolling; card styling no longer clips columns.
- Real receipt collections replace sample collection-rate/dues-aging figures on the overview. Collection rate and debt aging require verified billing sources and denominators; receipts alone do not establish them. Missing months are not filled with zero or counted as debt. The phase donut is a different, explicitly named breakdown supported by the existing service.
- Existing module search/filter tools are retained. No fake command shortcut, dashboard notification count, unsupported phase audience, welcome email, Clubhouse option or unimplemented mutation is added from the mock.
- Specialized authorized review desks remain separate, with centered staff dialogs where appropriate. Their form contents are not replaced with the mock's simplified universal approval form. Existing forms therefore retain fields omitted by the draft.

## Verification and limits

Passed locally: TypeScript and production Vite/PWA build, targeted ESLint, edited-source formatting, git diff --check, and the account-integrity check (10 embedded PostgreSQL tests plus generated Edge artifact parity). The static source inventory matched 32 distinct account-navigation destinations to shell routes and 87 literal frontend RPC names to prepared migration definitions. These inventories do not prove installed backend versions or runtime authorization.

No browser, E2E, axe, live database, external service or production deployment verification was performed. Existing Zod annotation and large map-chunk build warnings remain. Existing account-integrity changes and migrations in the working tree are earlier work, not new backend requirements from this redesign.

## Owner browser acceptance

Check the real staff console at desktop, tablet and phone widths in light and dark themes, including the GHL embed:

1. Sign in as a full administrator and a restricted/view-only staff account. Verify workspace/nav visibility and disabled/absent actions stay permission-correct; check the resident shell has its existing design.
2. On Overview, compare approval/helpdesk totals with their desks, open both actions, compare collection totals with Finance, and verify a staff account without association finance access does not receive that section. Check loading/error/empty states with unavailable data.
3. Search/filter/page People and Registrations; open an existing member, switch sections, link a verified property with an independent approver, and check an unavailable-link explanation. Use synthetic accounts for creating or suspending accounts.
4. Open Finance charts and receipts at narrow widths. Scroll to the final column; test date/month filters, authorized export and existing accounting draft/review flows without posting real money just to test styling.
5. Open each operational review type, calendar day/agenda item, announcement, document and helpdesk conversation. Check the original fields, validation, busy state, reply/status restrictions and cancellation/unsaved-change protection.
6. Verify all three access levels, inherited/limited settings and drawer sizing; keyboard through tabs, close with Escape and confirm focus returns. Repeat with reduced motion enabled.
7. Verify Board, Security and Transport views with their real permitted accounts; confirm synthetic labels remain wherever only preview data exists.

## Rollout

This redesign needs the **frontend deployed only**. It adds no SQL, RPC definition or Edge change. It assumes the existing backend and earlier account-integrity rollout remain installed. Do not rerun migrations 075-077 for this UI pass. No commit/push/deployment has been performed by Codex.
