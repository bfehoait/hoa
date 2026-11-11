# Office facility calendar

10 November 2026. Staff-only addition; the resident calendar and booking form are unchanged.

Open Office overview → Facilities & security → Amenity calendar, or use Calendar view from the Office booking list. `/office/calendar` now displays a month grid and the selected day's reservations instead of duplicating the booking list.

Staff can filter by facility and status, move between months, return to today, inspect reservation details and open the existing booking approval desk. The calendar includes pending, approved, rejected and cancelled records, with explicit status labels. It grants no approval authority.

Migration [039](../supabase/migrations/202611100039_office_facility_calendar.sql) must be installed by the owner after 038. Its read function requires active membership and Calendar association-view permission. It reads existing facility/booking records only and returns full-month daily counts plus a paginated daily list. Philippine time defines month/day boundaries; a reservation spanning midnight is included on both affected days. Daily pagination does not truncate the month counts. Data refreshes every 30 seconds while open.

The provided November reservation PDF has three scanned pages without usable extracted text. Its reservation entries were not imported, seeded, approved or copied into source. If those reservations are absent from the database, the calendar cannot display them until separately verified and entered through an authorized process.

Verification: TypeScript passed. Four isolated PGlite tests passed for association access, date validation, Philippine-time boundaries, midnight overlap, status filters and more than twenty reservations. Synthetic Chromium checks at 1024×768 and 1440×900 covered rendering, facility/status filters, next month and reservation modal open/Escape. No page overflow, undersized scanned controls, page errors or unknown fixture RPCs were detected. No live backend connection, database change or real booking action was performed. Owner verification against live records remains necessary after installing 039.

## 10 November 2026: calendar navigation

Added Facilities & calendar directly to the Office sidebar, permission-filtered through the existing calendar association-view requirement. Calendar and booking-list routes highlight this entry rather than Operations. Customer navigation unchanged.
