# Office review inbox

10 November 2026. Local frontend and database migration prepared; no live database connection or deployment performed.

## What changed

Office → Review inbox is the central entry point for pending submissions. The Office overview also shows a compact Needs attention list. Only server-confirmed counts from authorized queues are shown; missing setup or denied reads produce an error rather than zero or sample records.

Submissions remain in their original tables. Staff open the existing version-checked review actions; this inbox does not approve anything, grant permissions, change ownership, certify payments or copy records into another store. Staff-issued announcements keep their direct-publication workflow.

| Submission | Original source | Office destination |
| --- | --- | --- |
| Membership application | `registrations` | Registration inbox, Pending filter |
| Account/lot claim | `bfe_lot_memberships` | Pending lot links → exact lot review |
| Amenity booking | `bfe_bookings` | Pending bookings → existing decision dialog |
| Visitor, gate, small delivery pass | `bfe_visitor_passes` | Pending passes → existing approval/gate workflow |
| Vehicles, permits, marketplace listings and other structured submissions | `bfe_feature_records` | Module-specific pending review desk |
| Workshop, booth and carpool participation | `bfe_activity_participation` | Module-specific pending activity applications |
| Complaints, concerns, maintenance and support | `bfe_requests` | Helpdesk follow-up, separate from approvals |
| Live shuttle request | `bfe_shuttle_requests` | Shuttle dispatch/review, separate from approvals |

Legacy structured submissions are counted by their installed feature definition as well. Current dedicated submission forms keep using their dedicated stores. Carpool map demos, synthetic previews and unavailable features do not create real approval items.

## Wiring corrections

- Added capability-specific Office review/participation routes so a Livelihood reviewer does not need unrelated Operations access to open a marketplace queue.
- Corrected the Office permits route from Operations to Property, matching the existing protected permit review.
- Added paginated pending-only projections for features, bookings, passes and participation. These reuse the installed dashboards' authorization and action flags. Old pending records remain reachable beyond the first page; full history remains available.
- Added pending-lot pagination and direct links to the matching lot's existing membership-review controls.
- Kept the older `?module=` review links usable alongside the section selector.
- Counts refresh every 30 seconds while the inbox is open, on returning to it and after successful TanStack mutations in Office. Queries are scoped to the signed-in user, with no retained inactive cache. Direct registration actions are reflected on returning or the next refresh.
- Office shuttle mode does not show the resident ride-request composer. Driver/Board responsibilities and server authority are retained.

## Installation

After migration 037, the project owner must run the entire [038 migration](../supabase/migrations/202611100038_office_review_inbox.sql) in Supabase SQL Editor. It creates read functions only; no submission is approved, seeded or migrated between stores, and no role is granted decision authority.

The frontend is prepared locally. Without 038, the new inbox/pending projections report unavailable setup. Existing full-history desks continue to use their existing RPCs. No additional Supabase keys or storage changes are needed.

## Scope and decisions

The overview/inbox requires an active Office-capable admin/developer and the existing association overview summary permission. Each queue additionally needs its own association view permission. The decision controls still need the appropriate status, approve, publish or manage capability. View-only staff are labelled accordingly. Independent property approval, membership validation, capacity, expiry and concurrency checks remain server-owned.

Started bookings and expired passes are excluded from actionable approval counts; their history remains in the original store and existing history views. Awaiting counts do not prove a submission is eligible for approval: eligibility is rechecked when staff decide. A receipt or payment-evidence review is not payment clearance or a balance calculation.

Customer-facing layout, navigation and normal submission behavior are unchanged. Shared components select the new pending RPCs only when called in the staff pending-review mode.

## Checked locally

- Eight isolated PGlite tests: anonymous/resident/missing-overview denial; module visibility and revoked view access; source counts; pending versus closed states; more than 20 records; active-import lot claims; pending-only booking/pass/feature/activity pagination; route/capability readiness. Dashboard authorization stubs isolate the new projections; this does not substitute for checking installed policies on the live project.
- Intercepted synthetic Chromium: eight Office routes, including inbox, pending lots, marketplace/permit review, activity applications, pending bookings/passes and overview. Queue destinations and feature review dialog opening/closing checked. No detected page overflow, undersized scanned controls, page errors or unhandled fixture RPCs at 1280×800.
- TypeScript and production build checked after implementation; results reported with the handoff.

The owner still needs live verification: install 038, submit an authorized resident sample once, confirm the matching Office queue count/record, decide as authorized staff and confirm the resident sees that server decision. Repeat across enabled workflow families. No live submissions or decisions were performed by the agent.
