# Customer mobile responsiveness review — 10 November 2026

Owner requested an iOS/Android responsiveness check, including controls. Scope is the customer app and its entry forms; staff/developer workspaces are not certified by this review. All browser sessions used isolated synthetic account and service responses. No real member data, live database writes, deployments or phone sessions were used.

## Browser coverage

WebKit and Chromium were run with touch/mobile emulation at 360×800, 390×844, 430×932 and 844×390 landscape. WebKit is useful evidence for Safari behavior and Chromium for Android Chrome behavior, but neither session was on a physical iPhone or Android device. Default synthetic membership was homeowner with own/approved capabilities; renter/driver/admin-specific data and all production permissions were not exhaustively exercised.

23 customer routes × 2 engines × 4 viewports = 184 route checks:

- Home, More, Services, Account, Payments, Marketplace.
- Vehicles, Permits, Requests, Passes, Amenities, Calendar.
- Documents, Profile, Settings, Notifications, Help.
- Announcements, Learning, Carpool, Elections, Shuttle, Messages (existing direct route).

Checked whole-document horizontal overflow, visible button/form-control sizes, form input text below 16px and browser page exceptions. Synthetic screenshots were captured privately; representative phone and landscape captures were visually inspected. No horizontal page overflow or page exceptions were recorded in the 184-route run. This does not establish that every possible content/permission/state combination fits.

Sign-in, registration and recovery were separately checked in both engines at 360px portrait and 844px landscape: 12 route checks, no page overflow or exceptions. The small native registration consent checkbox was flagged by a geometry-only scan; inspection confirmed its enclosing clickable label has at least 48px height, so the native checkbox itself was retained.

Eight task states were exercised in WebKit at 360px/390px portrait and 844px landscape: vehicle details, vehicle creation, request discard/keep-editing, pass creation, selected booking range, marketplace search/Back, listing detail and listing creation. Those 24 state checks completed without page exceptions or whole-document overflow. The checks include retaining unfinished request input and resetting booking selection without submission. They do not simulate the real operating-system keyboard or prove the backend accepts changes.

Map requests were intercepted with an empty local basemap style during the broad responsiveness scan to isolate layout from external service availability. Thus the scan verifies map controls/layout and local demo behavior, not real map-tile availability. Road basemap rendering and markers were checked in earlier dedicated network-enabled walkthroughs, documented separately.

## Fixes applied

1. MapLibre's default zoom buttons measured 29×29px. Enlarged to 48×48px on carpool and shuttle maps. A focused computed-style check confirmed the new dimensions.
2. Landscape phones previously crossed the tablet breakpoint and displayed a desktop sidebar. Customer landscape at coarse-pointer widths 768–1023px and heights up to 500px now retains its app header and five bottom destinations. Landscape links use a compact horizontal icon/label arrangement. Desktop and taller tablets keep their prior layouts.
3. Customer Back is available under the same landscape condition. Long task dialogs also use the full available screen under that condition, retaining a scrollable body and visible close control.
4. Hardened shared action buttons against flex shrinking and added minimum block size. WebKit had flagged two actions on the direct Messages route at 35px in one capture.
5. Marketplace listing title controls have an explicit 48px minimum height, in addition to the existing whole-card click area. A landscape WebKit measurement had flagged the title at 45px.

Repeated verification after fixes covered Carpool, Shuttle, Messages, Marketplace and More in both engines at all four viewports: 40 checks, zero whole-page overflow, zero undersized scanned controls and zero page exceptions. WebKit landscape task walkthrough passed. TypeScript and scoped whitespace checks passed. Screenshots and walkthrough scripts remain ignored under `.private-imports/mobile-review/` and `.private-imports/check-*.mjs`; no test fixture data was added to production UI.

## Remaining physical-device checks

- iPhone Safari and Android Chrome with actual keyboard opening/closing, native date/time selectors, browser address-bar resizing and device Back behavior.
- Installed PWA, notch/home-indicator safe areas and rotation while a form is focused. Native browser/OS dialogs were not verified by desktop emulation.
- Larger system text/zoom, assistive technologies, physical-device WebGL stability and slow/unstable network behavior. No axe sweep, full screen-reader audit or performance benchmark was run.
- Real account content, long names/addresses, image upload/signing, approved passes/bookings and populated payment histories under actual permissions. The broad scan includes mixed populated/empty synthetic states, not every combination.
- Secondary route branches such as individual property details and every permit/pass subtype were not all populated and opened. The customer route/shared-pattern coverage is broad; it is not a claim that every feature state or live operation was tested.

No SQL or backend migration is required for these responsive fixes.
