# Customer creation access review — 10 November 2026

Static review following the marketplace scope bug. An active login does not confer association approval, publication or unrestricted access. Residents submit within the capabilities and prerequisites enforced by each backend. No live account permissions were queried or changed.

| Feature | Creation / action check | Outcome |
| --- | --- | --- |
| Livelihood | Marketplace `postable_modules`, own management flag; submission uses `bfe_submit_feature` | Corrected approved-feed View mode incorrectly suppressing own creation. Staff publication remains separate. |
| Training/workshops and published directories | Feature dashboard `can_create`; module resident-create definition and backend create/own or create/association | Removed misleading broad read-only banner inferred from approved-feed View. Actual posting stays server-controlled. |
| Vehicles & stickers | Feature dashboard `can_create`; security capability; dedicated resident module | No equivalent create-blocking bug found. Added missing security/own tab mapping, including the explore module map. |
| Permits & clearances | Feature dashboard `can_create`; property capability | No equivalent create-blocking bug found. Added property/own route and explore mapping so hidden/view presentation respects the right scope. |
| Visitor/gate/delivery passes | Dashboard `can_create` and a returned eligible lot | Linked-lot prerequisite intentionally remains. Requests need office approval. |
| Amenity bookings | Calendar create/own, eligible configured facility, date/time availability; backend validates submission | No approved-feed scope confusion found. Pending/approved status remains server-owned. |
| Helpdesk | Resident create-request endpoint; server request permission; separate reply capability | No generic approved-feed gate found. Backend remains authoritative; this was not a live submit check. |
| Shuttle | Transport own View mode, roster availability and existing request checks | Its own-scope View restriction is meaningful and is retained. Shuttle dispatch is not a generic listing publication queue. |
| Lot linking | Existing request and independent staff verification | Not automatically linked from an address. This prerequisite remains intentional. |
| Documents and announcements | Published content viewing; staff creation/publication paths | Resident feed viewing does not grant publication. |
| Payments/account | Read authorized existing records | Residents cannot set payment status, create authoritative balances or approve receipts. |
| Carpool map | Explicit interactive local demo | Not converted into a real booking service by access changes. |

## Validation

TypeScript and scoped whitespace checks passed. Source reviewed against feature/dashboard, request, booking and resident-access migrations and client components. No automated suite, real-account browser submission, live SQL, backend grants or deployment. The owner should verify a directly signed-in homeowner/renter with the intended configured capabilities: listing/vehicle/permit submission, approved-lot passes, booking conflict refusal, staff review and read-only account-preview refusal. If an action remains absent, inspect the actual returned can_create/postable_modules and effective server access rather than bypassing authority in the frontend.
