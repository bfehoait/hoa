# Mobile and desktop screen review — 9 November 2026

This pass makes the Bellefort foundation work as responsive task layouts. It does not convert the website into a native app, and does not verify live account permissions or data.

## Layout changes

- Services: compact phone destination cards, with primary services on the left and tracking/activity on the right on wide desktop screens. Removed the decorative eyebrow above the already-named section.
- More: concise heading, touch-friendly destination cards and horizontally scrollable category controls.
- App shell: centered wide workspaces, safe-area-aware phone gutters, wrapping navigation labels, and one brand mark on desktop rather than duplicate sidebar/header logos.
- Connected lists, documents, permits and operational forms: horizontal phone section selectors, wrapping full-width actions, resilient filter widths and two-column desktop record grids.
- My account and property register: wrapping charge rows and action controls, phone-friendly property filters/tabs and a two-column wide property list.
- Livelihood: phone header actions share the available row; search buttons and My listings controls fit narrow screens. This connected component still needs owner verification with actual authorized data.
- People and finance: compact phone filter panels, card spacing, scrollable finance tabs and one-column phone metrics. Desktop people rows retain their table-like layout.
- Amenities: three-column phone time choices and a single-column start/end pair on small phones. Shared calendar/date selection and accessible targets remain.
- Office/tablet: the two-column content layout becomes one column at 768–1023px, where the sidebar reduces usable content width. Panels can shrink without overflowing the page.

## Local browser inspection

A separate Vite process used explicit synthetic preview mode. The browser allowed requests only to 127.0.0.1; all external requests were blocked. No live backend or other project was contacted. These were layout inspections, not automated workflow suites or an axe audit.

18 synthetic routes loaded at 390px and 1440px (36 views): Home, Account, payment history, Services, requests, bookings, visitors, More, documents, permits, vehicles, Market, Office overview, office residents, finance, Security, Driver and Developer. Their rendered pages had no document-level horizontal overflow. Initial captures taken before lazy content loaded were discarded and the inspection repeated after each heading appeared.

Five routes (Services, More, Account, Office and Developer) were also inspected at 320px and 768px in dark mode (10 additional views). This exposed tablet Office overflow; the layout was corrected and that view rechecked successfully. A phone request dialog was opened and visually inspected after its entrance animation, with a reachable footer and opaque dark surface. Selected screenshots were inspected for Services, More, Account, Office, Developer and the request dialog. Not every route received a manual screenshot review.

Synthetic layout captures and the first 36-view metadata report are local in `.artifacts/responsive-design`. They are not production screenshots. Preview Home/Account/Market and staff screens can use different components from connected sessions; the synthetic checks do not establish visual correctness of those connected components. No production account data, confirmation of a payment, publication or approval was created.

Frontend TypeScript, all 48 frontend CSS files parsed, and whitespace checks are the code checks for this pass. Owner follow-up remains for connected Home/Account/Livelihood, real long names/records, upload states, mobile keyboards and actual device/browser behavior. No SQL or Edge Function update is required.
