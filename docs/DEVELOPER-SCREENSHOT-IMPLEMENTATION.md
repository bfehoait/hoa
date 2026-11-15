# Developer console screenshot implementation

Implemented locally on 14 November 2026. This pass follows the owner's Developer screenshots; other roles retain the earlier console styling and await their own screenshot review.

## Screens and retained workflows

- **Shell:** Bellefort logo tile, sidebar search with Ctrl/Cmd K, workspace selector, five Developer destinations, active navigation and member footer. Styling is scoped to the Developer shell; the existing notification and theme controls remain available.
- **Overview:** service cards, activity totals and recent request-audit feed. Account preview, role previews, record diagnostics, access tools, workspace selection and sign-out remain accessible.
- **Account support:** searchable member table with initials, unit, all assigned roles, status and an explicit Preview account action. The original inspection-session creation, verified preview read and destination logic are preserved. Workbook matching retains its existing capability checks and loaded-page scope.
- **Connections:** four service cards with working detail dialogs and internal diagnostic destinations. Recheck session and the existing connection notes remain available.
- **Access configuration:** visible Members, Group defaults, Committees and Access reference tabs. Members opens first; committee search, existing member editors, role/status controls and the full role/committee access model remain accessible. Tabs support arrow/Home/End keyboard navigation and query-string links without a page reload or scroll reset. Panels remain mounted to preserve local state; switching is disabled while group defaults are dirty or saving. Existing native member dialogs retain their own unsaved-change protection. No grant or server permission contract changed.
- **Diagnostics & audit:** paginated existing request-audit records, refresh/retry, timestamps, empty/error/loading states and links to the broader record monitors. Role previews have a distinct `/developer/previews` destination under the existing Developer route guard; the legacy `/developer/roles` access alias is preserved.

## Evidence limits and draft adaptations

The screenshots contain illustrative data. No fabricated latency, deployment health, collection figures, event charts or 24-hour totals were copied into production UI. Supabase's status describes only the verified current session/member lookup. Vercel, Buyani and map provider health are marked not monitored.

Activity totals come from the existing authorized module monitor. The audit feed identifies its request-workflow source; it does not claim to aggregate Auth, hosting or infrastructure events. Committee counts describe the existing defined groups, not live membership totals. New committee creation is disabled with an explanation because no corresponding creation endpoint exists; existing assignment and permission controls remain operational.

Member search uses the original query. Status chips filter the currently loaded page, explicitly labelled as such; pagination and the server's matching count remain intact. No new RPC, schema, account mutation protocol or resident presentation was introduced by this pass.

Owner follow-up: the Developer desktop sidebar now stays 264px wide, including wide monitors. The workspace selector uses a full-width 48px control with an accessible label, removing the separate visible label that squeezed the selector. Sidebar/search spacing is reduced while text and target-size requirements remain. These refinements do not affect the Office shell.

## Verification and rollout

Run frontend TypeScript/build, targeted lint/format checks and `git diff --check`. The protected account regression command validates ten embedded PostgreSQL cases plus generated Edge artifact parity; it does not connect to Supabase.

Owner browser acceptance remains required: verify all five pages in light/dark themes and at desktop/narrow widths; search and paginate members; open and exit an authorized account inspection; check workbook matching permissions; open connection details; expand the existing access editors; review/paginate audit records; check sidebar search, keyboard focus, notifications and workspace switching. Confirm denied users remain denied by the existing server checks.

This Developer UI pass requires only a matching frontend deployment. **No new SQL or BFE redeployment is required for this pass.** Earlier account-integrity rollout requirements are separate. Nothing has been committed, pushed, published or checked against the live database/browser by this pass.
