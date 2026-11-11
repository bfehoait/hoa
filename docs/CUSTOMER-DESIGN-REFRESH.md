# Customer design refresh — 10 November 2026

The owner supplied an estate-style layout draft and authorized a consistent customer redesign, including restrained animation. This pass implements that direction in the existing connected portal. It preserves the selected burgundy account balance card and does not replace workflows, permissions or authoritative data with a mock application.

## Visual and interaction system

- Customer-only warm off-white canvas, white grouped surfaces, warm borders and burgundy actions, with corresponding dark values. Staff workspaces retain their existing operational styling.
- Georgia/system-serif page and section headings echo the existing wordmark. Manrope remains the body, control and record font. No new remote font or component library.
- Consistent 12px customer action corners, 16px grouped surfaces and 22px heroes. Body and inputs remain 16px; secondary text remains at least 14px. Controls retain 48px targets and focus indicators.
- Services, More, requests, connected records and property links use grouped rows rather than repeated floating cards. Announcements, balances, marketplace covers and facility selection retain purposeful card treatment.
- Mobile header retains Back/branding, search icon and notifications. Desktop keeps search, sidebar and readable content widths. The existing five customer tabs remain.
- Route entry uses a cancellable 220ms opacity/6px translation via the Web Animations API. It does not remount children, reset form state or run on every filter/query-string change. Controls receive short color/border/press feedback. Reduced motion skips the route animation and added transitions.

## Home and page refinements

- Mobile Home follows household summary, quick actions, announcements, request/booking activity and community discovery. The account summary is compact, unknown bills remain unavailable, and missing addresses remain explicit.
- Desktop Home gives quick actions a balanced primary section, places the account summary alongside it, and uses the primary column for announcement imagery and grouped discovery links. Activity remains in the secondary column.
- Announcement covers use an inset 16:9 frame so landscape artwork retains its text without the former short-frame side gaps. Existing preload, carousel controls, automatic rotation, pause and reader remain.
- The Account page retains its burgundy Total balance / HOA dues / Water dues / Other hero. Nested property-page framing is reduced. No amounts, links or payment statuses are invented.
- Pass lot-link preflight now has a clear icon and primary next step. Existing lot approval remains required; no automatic linking or QR is added.
- Existing configured amenity selection, date/time ranges, forms, dirty-close guards, errors, read-only state and server actions remain connected.
- Livelihood selected tabs use a clearer solid accent state. Vehicle/permit and other connected lists inherit the resident row pattern and typography.
- Missing-service and unavailable-action error copy is resident-readable; it still refuses the action and does not report an unconfirmed save as successful.

## Implementation

The shared customer layer is `apps/web/src/styles/customer.css`, scoped to the existing customer shell attribute. Shared UI/navigation CSS and targeted page modules supply the list and layout refinements. React 19, Router, TanStack Query, shared zod validation and plain CSS Modules remain. No SQL, backend contract, access rule, external asset, live connection, commit or deployment was introduced.

## Review evidence

Controlled browser renders used a synthetic identity, intercepted synthetic service responses and blocked external account traffic. Map tiles were replaced by an empty synthetic style; this review does not revalidate map data or actual routes. The banner fixture was an explicitly synthetic SVG, not estate photography. Screenshots/scripts/logs remain under ignored `.private-imports/`.

- 18 distinct routes rendered in Chromium and WebKit at 390×844 and 1440×1000: Home, Account, Services, passes, amenities, Helpdesk, Livelihood, More, Hotlines, vehicles, permits, Shuttle, Carpool, Settings, Profile, Documents, Calendar and feature Search.
- 72 distinct route/engine/viewport combinations, with repeated Home/Account renders after layout adjustments (88 light-theme captures total). No horizontal document overflow, browser exceptions or unhandled fixture endpoints were observed.
- Two additional WebKit phone renders reviewed Home and Account in dark mode. No overflow or browser exceptions were observed.
- Representative images were visually inspected. The inspection caught cramped activity layouts, nested property framing and imbalance between the account and quick-action sections; these were adjusted before the final renders.
- Representative token contrast calculations: light body/canvas 13.48:1, light secondary/white 5.95:1, dark body/canvas 15.88:1 and dark secondary/surface 8.39:1. These calculations do not establish whole-app WCAG conformance.
- TypeScript, production build and scoped diff whitespace checks passed. Manifest/service worker generation remains working. Existing zod annotation and large-chunk build warnings remain.

This was a visual render review, not an automated interaction suite or end-to-end journey. No unit suites, axe sweep, real call, live permission test, actual phone/PWA installation or populated-state audit was run. Physical iOS/Android keyboard/safe-area/text-scaling checks, screen-reader review, all form variants, live data and every role/state remain owner acceptance work. Rendering in WebKit is evidence for the layout engine, not proof of behavior on an iPhone.
