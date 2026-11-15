# Board screenshot implementation

14 November 2026. Local frontend implementation; no backend or deployment changes.

- **Shell:** Board uses the compact branded 264px staff shell, workspace selector, permitted Board screen search with Ctrl/Cmd K, existing navigation, notification/theme controls and Board identity footer. Office and Developer keep their own contexts.
- **Overview:** governance and oversight card grids plus recent updates follow the screenshots. Published report and board-record counts use existing authorized feature dashboard queries. These describe published records, not pending approvals or downloadable attachment counts. Recent update links include the record identifier and open through the existing exact notification-target reader. Loading, errors and empty results remain distinct.
- **Documents:** existing document-library search, category filtering, pagination and attachment Sheet remain. Board cards use folder icons and the shared card grid. No upload action was invented: this reader does not supply a document-publishing capability. The existing Office publication workflow remains separate.
- **Elections:** existing published candidate reader retains fields, detail views, permissions and notification targets, with a Board heading and responsive card layout. It is not a turnout, voting or certified election-results service.
- **Updates:** existing publishing reader renders Board updates as a continuous feed with record detail buttons. Original content, dates, images and full detail presentation remain available.
- **Reports:** existing board-report reader retains its records, fields, publishing/review permissions and detail/history behavior. No numbers are extracted from free-text report content to fabricate financial charts.
- **Shuttle review:** Board title and description replace passenger copy. A semantic summary table shows permitted individual requests on the current page, with source dates, routes, passenger counts and statuses. It does not pretend to provide daily aggregate trip counts. All original request detail cards, available actions, active/history controls, filtering and pagination remain below.

## Deliberate differences from mock data

Verified turnout, collection rate, year-to-date expenses and expense-category reporting are not supplied by these existing readers. Overview displays unavailable states rather than numeric sample values, zeroes or progress arcs suggesting a measured percentage. Synthetic previews stay labelled, and no real data is fetched by the new Overview's feature hooks in synthetic mode. Existing role-preview routes retain their separate synthetic implementation.

## Owner browser acceptance

Check all six Board destinations in light/dark themes and desktop/narrow views. Verify sidebar search, workspace switching and permissions; document search/category/page and attachment opening; candidate/report details and deep links; Overview update links; shuttle active/history views, filters, table and original actions. Confirm unavailable metrics remain unavailable and restricted records stay inaccessible. No live browser, production database, Edge, full automated suite, E2E or axe verification was performed for this UI pass.

Run local TypeScript/build, targeted lint/formatting and diff checks. This pass needs **frontend deployment only**, with **no new SQL or BFE redeployment**. Nothing committed, pushed or published.
