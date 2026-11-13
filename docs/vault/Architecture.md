# Architecture

**Authentication stage, 5 November 2026** - `data/auth.tsx` owns the singleton Supabase client, Auth events, server identity verification and TanStack member query. `packages/shared/src/auth.ts` owns validation and frontend workspace rules. `AuthGate` wraps application routes; no protected shell renders before identity/member verification. `Access` provides real forms while `PreviewAccess` retains the explicitly configured synthetic chooser. `VITE_APP_MODE=authenticated` is the default; missing configuration fails closed. The browser API key is validated as publishable/anon, and Vite refuses server keys before bundling. Supabase is separated into a vendor chunk. Existing repositories still handle synthetic business records only; none were replaced with live finance/operations tables. See START-HERE for the setup contract and limitations.


The connected feature layer derives directories, notice/document views and review queues from the same workspace items. Shared integration schemas add synthetic media descriptors, typed local actor messages and per-thread read cursors with defaults for older compatible tab data. A guarded content-publication operation accepts supported locally reviewed content only; it is not authentication/authorization. Operations simulations use the same adapter. `/coverage` maps frozen metadata to current route entry points. See [[Connected workflows]].

**Observed** — React 19 and TypeScript render an owned UI library and feature routes. React Router owns navigation. TanStack Query owns asynchronous repository reads/mutations. CSS Modules and semantic tokens own styling. Zod contracts and pure calculations live in `packages/shared`.

```mermaid
flowchart LR
  UI[React feature routes] --> Q[TanStack Query]
  Q --> R[Explicit preview repository]
  R --> S[Tab session storage: synthetic data only]
  UI --> C[Shared zod contracts and financial logic]
  UI --> T[Semantic CSS tokens and owned components]
  R -. future replacement .-> API[Authenticated row-level API]
  API -. pending .-> DB[Separate Supabase dev project with RLS and RPCs]
```

**Observed** — Production builds split feature routes. PWA caching is limited to public app assets; no records endpoint has a runtime cache rule.

**Risk** — The demo uses a single browser-state envelope for convenience. It is not a backend design and must never become the production storage model. See [[Data model]] and [[Security]].

**Observed** — The extended preview adds a separate typed workspace adapter (`data/workspace.ts`) and shared preview schemas (`packages/shared/src/workspace.ts`). It stores synthetic applications, content drafts, service interests, expenses and their local timelines under a separate session key. Existing resident data and extended workspace data can be reset independently. These are browser demonstration adapters, not normalized production tables or API contracts for real authority.

**Observed** — `/office`, `/security`, `/driver` and `/board` select visual workspace navigation by route. `/sign-in` is an explicit chooser, `/register` saves synthetic applications, `/recover` reports its missing provider and `/sign-out` clears in-memory Query state. None verifies identity or grants permissions. Developer diagnostics are allowlisted metadata only; no environment secret reader or remote maintenance client exists.

### 13 November 2026 - public/protected loading boundary

App.tsx is now the small entry router, preserving theme initialization and choosing PublicAccess or ProtectedApplication through lazy imports. PublicAccess retains the public Access/Exit/PWA behavior plus title/scroll reset. ProtectedApplication preserves the existing real/developer/target/synthetic gates and workspace redirect. AppShell.tsx contains the unchanged signed-in shell/helper bodies; resident Home and preview modules load on their relevant paths. Public registration and synthetic access are also split within Access. This is a code-loading boundary, not an authentication boundary; server authorization is unchanged.

See [Performance first pass](../PERFORMANCE-FIRST-PASS.md). Financial and authority-related queries retain previous freshness. Short presentation caches and current/next announcement preloading reduce redundant work. Media URLs retain 60-second validity and are not persisted; authorization/signing remain coupled on renewal. Source/TypeScript/build checks passed; browser/device acceptance remains with the owner.


### 13 November 2026 - approved workspaces and notification subjects

Added a real workspace chooser at /workspaces for accounts with multiple server-assigned, permitted workspaces, plus a resident workspace selector on mobile/desktop. A single workspace still opens directly. This changes navigation only; public registration, assigned roles and server authorization remain unchanged. Connected My account now emphasizes the member name, household role and address. Customer help and shared error feedback use plain language; explicit synthetic previews retain their disclosures.

Prepared migration 070 to resolve existing/future notification destinations during authorized reads and open exact owned booking/pass/submission/application records through the existing dashboards. Helpdesk uses exact UUID filtering with existing owner/RLS checks. Subject reads do not depend on the first dashboard page; unread state changes only after a linked subject loads. Unavailable destinations show a fallback. New booking choices exclude legacy Clubhouse; prepared 068 remains responsible for connected pool configuration/history preservation. No new booking-limit policy was introduced.

See [Account workspaces and notification destinations](../ACCOUNT-WORKSPACES-NOTIFICATIONS.md). Source-reviewed SQL is prepared only; the owner applies it and performs browser acceptance. Earlier loading optimization and CORS work are preserved.


### 13 November 2026 - account charge details without empty disclosures

Connected My account no longer mounts the two charge disclosures on the overview. Verified invoice/amenity-charge counts independently control View HOA bills and View amenity charges links. Counts, rather than unpaid amounts, preserve access to fully paid history; an empty category adds no link or empty disclosure. Existing overview loading/error/balance states remain.

The existing /account/* route serves /account/bills and /account/amenity-charges as separate details screens using MonthlyHoaCharges and AmenityCharges. The shared mobile Back control returns through history with /account as the direct-link fallback. Existing Finance permissions, paging, payment/allocation/refund guidance and server reads remain. Charge components mount only on their details route. No SQL or financial calculation changes.


### 13 November 2026 - one mobile page-level Back control

CustomerBack now identifies the header return control with data-customer-back. At the same portrait/landscape breakpoints where that control is visible, the resident shell suppresses body-level .back-link and data-page-back returns. This applies to existing customer profile/help/community/directory/statement links as well as the shared BackLink, lot-profile return and service-page wrapper; empty wrapper spacing is removed too. Desktop/staff navigation and same-module controls without a header Back retain their existing actions. Unavailable-record recovery links remain available.

Directly opened nested lot pages now fall back to their lot list (/account/lots or /more/lots); standalone feature pages fall back to /explore. History-based Back behavior, authentication, permissions and data operations remain unchanged. No database migration is required.


### 13 November 2026 - verified customer property states

Connected customer property lists now use bfe_my_linked_properties directly, sharing the own-link cache with the account address. They do not mount the registry search/list query. Confirmed links produce property cards with detail links and an optional request to link another property. An empty successful link check produces Request a lot link; pending/failed checks never become an unlinked state. Office registry searching and labelled synthetic lists retain their existing paths.

The visible customer list opts into 30-second own-link polling so Office changes can appear without a full-page refresh; other hook consumers retain their previous non-polling default, and member preview polling is disabled. Reads remain server-filtered to current approved links. Link requests still use the existing protected claim workflow, with Office verification required. Property-list errors and other registry reads now describe failed loading rather than an uncertain save. The Properties tab owns link retry feedback; the account header keeps its retry only on the Payments tab to avoid duplicate retry controls.


### 13 November 2026 - numeric My account balances

The connected My account card now formats the confirmed total_balance_centavos and hoa_balance_centavos even when invoice/amenity counts are zero. A confirmed zero appears as PHP 0.00 instead of No bills yet. The no-posted-charges explanation remains beside the number; no unpaid months or charges are inferred from the recurring rate. Missing/error/loading and reconciliation-review states remain non-numeric, and unavailable water dues remain explicitly unavailable. The calculation, posted-charge scope and backend are unchanged.


### 13 November 2026 - unified Livelihood views

Marketplace retains one Livelihood heading and persistent Browse / My listings / My applications view controls. URL-based view/category selection supports browser history and direct management links. The six listing categories remain available; listing creation uses the existing permitted postable modules through the shared desktop action/mobile + in every view. Management views request only the unfiltered first feed page for current posting permissions, with no feed background polling there. Read-only member previews remain Browse-only.

Embedded LiveFeature hides the redundant category intro and create/navigation actions while preserving own listing records, edits, withdrawals and existing authorization. Embedded ParticipationDesk shows applications/status/history without the standalone workshop intro, open-activities section or generic Apply button. The selected workshop/booth event detail starts the existing protected application form; closed or inaccessible activities show feedback. Application type changes clear stale event/record targets. Standalone and Office participation layouts retain their existing headings/actions. No SQL or approval-policy changes.


### 13 November 2026 - owner-designed Account cards

Applied the supplied Account layout using existing CSS tokens and solid surfaces: Account page title, initial avatar, member name/role badge, linked-address row, large numeric total and stacked icon/amount breakdown. Empty confirmed billing uses No posted charges, never Nothing due; water remains Unavailable and reconciliation/loading/error states remain explicit. No repeated total at the bottom. Properties/Payments use pill navigation. Existing verified-charge detail links and property-state handling remain.

PayDues now presents its monthly rate separately from balance with a visible rate warning, one inline copy-reference control and the existing owner-supplied Buyani external handoff. Reference format, suffix matching reminder, authorization, billing calculations and payment confirmation remain unchanged. The component is shared by account/lot/preview surfaces; no real payment confirmation is inferred from opening the external destination.


### 13 November 2026 - compact account properties and receipts

Customer property cards now show the confirmed physical lot ID and phase/block/lot plus the server-returned relationship (owner displayed as Homeowner, renter as Renter, household as Household member). Compact home-icon rows and a rounded Link another property action match the supplied Account design. Office registry cards and link approval rules are unchanged.

Account receipt rows now use a receipt icon, number and combined lot/date metadata, with the recorded amount aligned right; the previous desktop table headings are removed. Date filters remain side by side from 360px, stacking below that width; narrow receipt amounts move beneath the details. Existing receipt access, warning, error/retry/empty states, date filtering and paging remain unchanged. No sample receipts, amounts or relationships are inserted.


### 13 November 2026 - stable account section switching

The shell now skips its scroll-to-top, whole-page entry animation and main-focus reset only for resident navigation between /account, /account/lots and /account/payments. Existing scroll handling remains for individual lots, charge details and other modules. Account section links request preventScrollReset, and the content wrapper reserves viewport-relative height to limit upward clamping when a short/loading list replaces a longer section. Route URLs, permissions and browser history remain intact.


### 13 November 2026 - responsive Livelihood Browse cards

Reused Marketplace and its existing feed without changing queries, RPCs, route definitions or schemas. Browse now uses repeat(auto-fill, minmax(160px, 1fr)) with a 10px gap, without fixed column-count breakpoints. Mobile page gutters are reduced by 6px on each side within the existing 16px shell padding, leaving space for two minimum tracks at 360px. Empty tracks keep a single listing from spanning the grid. Card links use the existing listing query parameter and preserve other filters; the same details modal handles the destination.

Cards use square lazy signed covers, two-line title clamping, tabular bold prices and category/condition pills. Focus outlines and hover borders use tokens. Cover-only loading/missing/error states show a neutral image-icon placeholder; image load failures use that fallback instead of a broken image. Signed URL authorization, lifetime checks, queries and eager announcement preloading remain unchanged. No synthetic listing records were inserted.


### 13 November 2026 - compact Livelihood controls and search

Removed the empty header-actions flex row from layout, tightened mobile heading/view/category/filter/result spacing and card padding, and explicitly uses body typography for Livelihood/results headings. View controls use pill shapes. Marketplace search separates one rounded icon/input field from its submit button; native inner input borders/padding/focus shadows are reset and the field supplies one visible focus outline. CustomerSearch similarly resets inner focus decoration and displays its placeholder on mobile Search instead of a blank field. Controls retain 48px targets; card square aspect ratio, auto-fill grid, routing and data behavior remain.


### 13 November 2026 - Home hotlines and reusable pass sheet

Added HomeHotlines below resident announcements, gated by the existing Hotlines destination permission. Three horizontal scroll-snap cards consume emergencyContacts, communityContacts and utilityContacts from the existing public contact module. Each renders all named contacts and labelled number lines via hotlineTelephone; no number, staff name or email is added or changed. See all hotlines uses the existing route. Each category body has bounded vertical scrolling and keyboard access; theme tokens style surfaces/body text with contrasting fixed category header accents.

Sheet wraps the existing native Modal rather than duplicating focus trapping, background scroll locking, focus restoration, Escape/scrim handling, dirty-form protection or keyboard viewport sizing. Sheet CSS bottom-anchors the panel, exposes a decorative handle and keeps header/actions outside the scrolling body. Request a pass uses Sheet through BookingComposerFrame; its existing fields, constraints, handler, RPC arguments and route remain. The action row is lifted unchanged to the footer and references the original form through useId and native form attributes. Inline resident amenity booking and Office booking dialog behavior stay on their existing paths. Reduced motion removes sheet/backdrop animation.


### 13 November 2026 - screenshot-led resident mobile redesign

Implemented the owner-provided mobile direction across shared shell, Home, Account, Livelihood, More, Amenities, Helpdesk and Shuttle while preserving Claude's Sheet conversions. Added scoped mobile header/surface/navigation CSS, verified-data balance/rate/record layouts, horizontal announcements, per-device theme control, compact amenity choices/steps, Helpdesk status views/message bubbles and shuttle route/progress cards. Expanded Sheet only with an optional styling class; native Modal retains its accessibility, dismissal, keyboard and busy/dirty handling.

No RPC contract, SQL, schema, role assignment, approval/payment authority or submit handler was replaced. Helpdesk Open uses the existing authorized query with a not-Resolved read filter. Additional mobile services remain reachable via More services, with desktop groups retained. Screenshot sample data is not seeded, missing live shuttle location/ETA remains explicit, and the demo map remains labelled. See [Resident mobile redesign](../RESIDENT-MOBILE-REDESIGN.md) for accuracy differences, source scope and owner browser acceptance.


### 13 November 2026 - mobile handoff follow-up

The resident Livelihood route uses the shell title on mobile; its duplicate page header is hidden only under the matching resident route attributes. Search now sits on the neutral curved content surface instead of adding another burgundy strip. Header action colors target direct controls, avoiding nested notification dialog actions. Shared Sheet presentation and existing queries, routes and submit handlers are preserved.


### 13 November 2026 - compact mobile announcements

Home announcements retain the existing published-record query and reader Sheet. Mobile cards use a 90px colored Community header and actual title/detail preview in the horizontal carousel. Publishing records have no category field, so no advisory classification is inferred. Cover media remains in the reader and desktop carousel; mobile previews avoid requesting hidden cover images.


### 13 November 2026 - announcement covers and mobile autoplay

Restored existing signed announcement covers on mobile cards, with a readable category overlay and colored fallback for posts without images. The horizontal carousel advances every five seconds, loops at the end and follows the current scroll position after manual swipes. It pauses during pointer interaction, keyboard focus, reader opening, hidden-page state or reduced-motion preference; an explicit play/pause control is available. Existing published query, media authorization and reader Sheet remain. TypeScript, targeted ESLint, formatting and git diff --check passed. Phone checks of image loading, autoplay, swiping, pause and reduced motion remain owner-pending; no automated suites or live backend operations performed.


### 13 November 2026 - five equal-height hotline cards

Home hotlines now group the existing contact arrays into Admin Office; Security & Aqualink; Barangay Molino IV; Bacoor Emergency/Cavite Command/PNP; and Bureau of Fire/Metro South Medical. Names select existing records; numbers remain sourced from hotline-contacts and telephone normalization is unchanged. Shared grid-row stretching keeps all five cards the same natural height with a 360px minimum; longer content can grow without inner scrolling or clipping. Manual swipe, hidden scrollbar, keyboard access and See all remain. No staff names or emails were added. TypeScript, targeted ESLint, formatting and git diff --check passed. Owner mobile visual checks remain pending; no browser automation, live data changes, commit or push.


### 13 November 2026 - hotline reference proportions

Tightened Home hotline cards toward the supplied design: shorter colored headers, uppercase muted group labels, wider mobile cards and less vertical spacing. Removed the artificial minimum height; the grid stretches all cards to the tallest actual content. Consecutive same-label numbers and consecutive unlabelled landlines share a wrapping row while retaining separate normalized telephone links with 48px touch targets. All nine existing contact records and PNP remain included; no mockup staff names, emails or numbers were copied. TypeScript, targeted ESLint, formatting and git diff --check passed. Exact rendered sizing and phone interactions remain for owner browser verification; no browser automation, live backend, commit or push.


### 13 November 2026 - owner-authorized fixed office directory

The owner explicitly replaced the managed-database choice with fixed office contact details and approved the source exception for the published staff directory shown in the reference. Added a dedicated Home office-contact data module and rendered the two staff sections, the existing office phone and four mailto links with wrapping email text. Other hotline arrays remain unchanged, and no database setup is required. Manual swipe, equal card heights and hidden scrollbars remain. TypeScript, targeted ESLint, formatting and git diff --check passed; owner browser checks for names, mail links, wrapping and card height remain pending. No SQL, backend connection, automated suites, commit or push.


### 13 November 2026 - Livelihood mobile reference layout

Marketplace now presents its existing search form in a burgundy mobile hero above a curved neutral content wrapper. A mobile submit icon and keyboard search use the unchanged submit handler and URL query state; desktop keeps its text submit button. The resident Livelihood title is larger only on that route, and main drops its own top radius only while Browse renders the search hero. Tabs, filters, permissions, queries and listing destinations are retained. Mobile business cards omit the duplicate type heading and show the type in the metadata pill; real covers remain.


### 13 November 2026 - owner-requested quiet marketplace priority

Prepared migration 071 and an owner-run exact-UUID configuration script for the Multiply Talents business. The existing feed sorts configured priority before date/price and before pagination, while retaining its visibility, consent, expiry, audience, category, search and authorization rules. No badge or priority property is returned to the UI. Configuration uses a single-slot RLS-enabled table with client privileges revoked, no resident setter and no preselected record. No frontend or schema changes were needed. Reviewed both ordering clauses and preserved feed guards; git diff --check passed. SQL has not been executed or live-verified. Owner must apply 071 after 070, verify the official record UUID, configure it and browser-check ordering/filtering/pagination. No automated suites, live connection, commit or push.


### 13 November 2026 - resident phone spacing system

Added resident-only mobile spacing tokens (16px sections, 12px card/form spacing and shared card padding) and scoped adjustments across 20 CSS Modules. Home removes stacked grid and hotline margins; Account, Services, requests, booking, connected modules, More, transport, property, community, shared navigation rows and dialog bodies share the tighter rhythm. Desktop/staff breakpoints and all data/permission/form logic are unchanged. See ../RESIDENT-MOBILE-SPACING.md for scope and owner checks.


### 13 November 2026 - persistent portal sessions

Moved only Supabase Auth storage to a dedicated persistent adapter with one-time tab migration and restricted-storage fallback. Preview records stay tab-local. Added bounded server-policy checks before member verification, foreground activity throttling, timeout checks that do not count background polling/token refresh as activity, cross-tab sign-out cleanup and retry states that retain saved credentials during connection errors. Prepared migration 072: server-clock deadlines (resident-only 30 days/7-day idle; privileged/mixed or association-granted accounts 12 hours/30-minute idle), private activity table, Data API pre-request enforcement and restrictive bfe Storage policy. Updated account Edge function and regenerated dashboard artifact to check the caller before service-role operations. This is portal authorization expiry, not modification/revocation of Supabase Auth sessions. See ../PERSISTENT-SESSIONS.md for rollout and limitations.


### 13 November 2026 - move More services into Services

Removed the More services disclosure and its unused CSS. More retains profile/preferences, community information, authorized workspace links and sign-out; Settings is directly reachable in mobile account preferences. Operational destinations now live in a shared Services definition used by both preview ServiceHub and signed-in ConnectedHome, including Transport (Community shuttle and Carpool), property links, office requests and elections. Calendar remains available; Livelihood keeps its existing tab. Permission filtering and original destination URLs remain, with Services tab highlighting and direct-link Back fallback updated for moved operational pages. TypeScript, targeted ESLint, source formatting and git diff --check passed. Owner browser checks remain for both service hubs, More, transport links, permission-limited accounts and Back/navigation. No automated suite or browser run, live connection, SQL, commit, push or deployment. This change needs no SQL or bfe-create-account redeployment.


### 13 November 2026 - mobile Helpdesk conversation page

Resident phone request details now render a dedicated page instead of a Sheet, while Office and desktop keep the existing Sheet. Mobile selection uses the existing record query parameter and authorized exact-record read; the shell header is hidden only when the conversation page is present. The page presents real title/status/category/UUID reference, Manila dates and times, original request and left/right reply bubbles, grouped date markers, a details disclosure and compact sticky composer. Existing reply form/handler, mutation identity, permissions, loading/error state, manual refresh and older/newer pagination are reused. Native back control and navigation links warn on unsent text; reload uses beforeunload. No live data, workflow or backend changes.


### 13 November 2026 - automatic thread updates, mobile headers and return caching

Newest request-thread pages poll every five seconds while mounted/foreground; older pages retain the 30-second cadence. Mobile conversation removes the routine refresh icon and retains retry only for errors. Resident detail headers use a shared Back/bell first row with the title beneath. Home no longer plays the shell entry animation; phone scripture entrance animation is disabled. Announcement media now retains its in-memory query for five minutes instead of garbage-collecting immediately; signed URL lifetime checks and 45-second authorization/signing renewal are unchanged. Home booking cache retention is five minutes without changing stale time, balance logic or polling. Auth/session cache clearing remains unchanged.

Shuttle now shows the map directly, with seven numbered stop selectors. Removed the disclosure and suppresses the twelve synthetic map pins/road route/office marker for this view; Carpool demonstration behavior remains separate. The map retains an approximate area center and a Google Maps search link for the owner-provided address. Exact seven stop pins are pending the owner matching and sending locations; no guessed coordinates were added.


### 13 November 2026 - supplied seven Shuttle stop coordinates

Replaced pending Shuttle placement with the owner-supplied seven numbered coordinates, normalized from latitude/longitude into MapLibre longitude/latitude order. A dedicated shuttle-stop-data module is the single source for stop labels and pins. Shuttle map fits all seven points, excludes the old approximate office marker and synthetic road route, and shares selected pickup/destination state with the existing request selectors. Carpool keeps its existing separate demo coordinates/route. Removed the owner-requested Sales Office Google Maps link. Coordinates define static stop locations, not live vehicle tracking, ETA or approved driving geometry.

### 13 November 2026 - multi-audience publication and phase limits

AudiencePicker submits either members alone or a set of specific existing roles. The new review RPC retains the original server reviewer checks and writes the audience set atomically; all related prepared content readers use one predicate with a legacy fallback. No audience selection grants permissions. Shared lot validation now follows Phase 1 (19 blocks/111 lots), Phase 2 (9/36), Phase 3 (1/54), with owner-run migration 074 protecting new resident registrations/member inserts. Account creation editor artifact regenerated for Edge redeployment. Customer wiring review and owner acceptance checklist are documented in docs/CUSTOMER-WIRING-REVIEW.md.
