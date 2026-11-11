# Customer UI implementation — 9 November 2026

This local frontend pass implements the shared layouts from the customer assessment. Existing server authority, account linking, payment access and database migrations remain unchanged. The customer architecture remains React, CSS Modules and TanStack Query.

## Delivered

- Compact customer phone header, history-aware Back action with an in-app parent fallback, consistent heading rhythm, safe-area-aware bottom navigation and desktop content widths. The website footer is omitted from the customer phone layout. The administrative inspection banner retains the member identity, read-only label and exit action with shorter text.
- More uses compact horizontal icon/label tiles and grouped rows. The clipped category strip is removed. At the owner?s request, separate Complaint, Concern and Report an issue shortcuts are retained alongside Helpdesk, and the Messages entry is removed from More. Livelihood remains in the primary navigation; secondary community destinations remain in More. Search and permission filtering are preserved.
- Connected Services groups access/amenities, requests/property and community resources. Help focuses on contacting the office and community resources. Desktop groups use a two-column composition when there is sufficient width.
- Resident vehicles, permits and personal listings use compact record summaries opening full detail. Bookings and passes use the same summary/detail approach. Irrelevant management counters and the general office View selector are removed from resident feature screens. Published reader surfaces have resident-oriented descriptions and browse cards. Announcements and training no longer reserve a large empty image when there is no cover.
- Long request, pass, profile, listing and shuttle composers have a full-screen mobile dialog presentation. Document, announcement, listing, request, booking and pass detail use the same presentation where integrated. Desktop dialogs retain their bounded layout. Existing keyboard focus handling and visual-viewport sizing remain in use.
- Opted-in task forms guard Close/Escape/backdrop dismissal after changes, offer Keep editing / Leave form and register a refresh/leave warning. Form input remains in memory. This does not persist private drafts to browser storage or add a universal client-side route blocker. Explicit caller-managed Cancel actions and browser Back require separate consideration when converting a composer into its own route.
- Marketplace committed search, section, category, sort, page, selected listing and browse/mine mode use URL parameters. Back restores committed search; malformed page/sort parameters are bounded. Unavailable selected listings get a recovery action. Advanced filters are collapsed initially; marketplace category chips remain intentionally scrollable on phones.
- Account payment date filters and pagination use URL parameters with date validation. Unknown balances and dues remain explicitly unavailable. Empty single-page pagination is removed from property, request and feature lists.
- Booking retains its date and time-range workflow. The phone calendar can use the full viewport width to fit seven 48px date targets at widths of at least 360px; narrower layouts retain their scrollable calendar region/manual date alternative. Submit/reset actions appear after an amenity is chosen. Reset is explicitly a non-submit button.
- Shared pending buttons expose busy state. Detail surfaces stop rendering stale selected feature/marketplace records after a read error. Existing identity-scoped query keys, session cache clearing, retry identities and server confirmations remain the authority; no additional global state library was introduced.

## Verification performed

Frontend TypeScript passed after implementation. Prettier parsed/formatted the changed frontend files. Scoped diff whitespace checks were performed. No unit suite, production build, axe sweep or live database operation was run.

Controlled local Chromium walkthroughs used a separate Vite process on port 5176 configured for a reserved `.invalid` backend. All non-local network traffic was intercepted or blocked. Synthetic identity, permissions and response fixtures were supplied only in the browser walkthrough; this is layout evidence, not proof of backend permission enforcement. No real member information, tokens or account sessions were used.

23 customer routes were captured at 390px and 1440px: Home, More, Services, Account, Payments, Marketplace, Vehicles, Permits, Requests, Passes, Amenities, Calendar, Documents, Profile, Settings, Notifications, Help, Announcements, Learning, Carpool, Elections, Shuttle and Messages. An earlier 17-route batch also covered 360px, 430px dark appearance and 768px. No whole-document horizontal overflow was recorded in those captures. Representative images were inspected, including More in both themes, Services on phone/tablet/desktop, account desktop, resident records, marketplace, Home, training, announcements and shuttle.

Eight additional task/detail states were captured at 360px, 390px, 430px dark appearance and 1440px: vehicle detail, vehicle creation, request discard confirmation, pass creation, selected booking range, refined marketplace, listing detail and listing creation. Checked interaction paths included retaining the unfinished request after Keep editing, selecting a booking time range, restoring marketplace search through browser Back and resetting a booking without submitting it. The final targeted task run recorded no page exceptions or whole-document overflow.

The initial expanded route capture reported two storage exceptions from the walkthrough's unscoped initialization script on non-app documents. The fixture initialization was restricted to the isolated app origin; the repeated expanded capture recorded no page exceptions or unknown fixture endpoints. An initial TypeScript check also caught implementation errors in the modal props and record-render extraction; these were corrected before the passing final check.

Private local captures and walkthrough scripts are under ignored `.private-imports/ui-review/` and `.private-imports/inspect-customer-*.mjs`. They are labeled synthetic and are not release assets.

## Remaining owner/device verification

- Verify signed-in homeowner/renter flows and read-only account inspection against the installed backend, including actual permission differences, expired sessions, real image signing/upload and populated histories. Fixtures do not establish server behavior.
- Verify physical iOS/Android keyboard behavior, installed PWA mode, device safe areas and native browser Back/refresh warnings. Desktop Chromium viewport resizing does not reproduce all mobile browser behavior.
- Check increased text size, screen-reader operation, contrast and longer production content. This pass did not perform a complete accessibility audit or measured performance benchmark.
- Long mobile tasks currently use full-screen dialogs. Dedicated composer/detail URLs, comprehensive tab scroll restoration after delayed data loading, persistent drafts, universal navigation blocking, realtime messaging and offline write replay are not introduced. Source-only references to potential improvements in the original assessment are not claims that those features were implemented.
- Existing account-lot review and historical receipt entitlements remain admin work. Missing official billing data must continue to show Unavailable rather than zero.

No deployment, commit, push, live account change or new SQL is required for this frontend pass.
