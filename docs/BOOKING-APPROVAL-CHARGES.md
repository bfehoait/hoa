# Confirm the fee when approving a booking

Owner decision, 15 November 2026: authorized staff approving an amenity booking should add its confirmed fee to Other automatically, without a second Finance posting step. This explicitly supersedes the earlier separate-posting requirement **for this narrow booking approval action only**. Payments, reversals and other accounting forms retain their existing independent Finance checks.

## Workflow

1. Open a pending booking in Office bookings or the inline Review Inbox.
2. Review the PDF estimate and the fee confirmation form. Known rental/admission and bond amounts are filled from the saved server quote. Missing rental prices stay blank. A listed reservation fee requires an explicit additional amount because the PDF does not specify whether it is credited. Older bookings without a price snapshot require all fee amounts to be confirmed.
3. Enter a fee explanation, review the calculated total and tick the confirmation.
4. **Approve & add fee** approves the booking and creates one posted amenity charge in the same database transaction. The charge is read by the existing Other and Total balance queries. This does not record a payment.
5. Already-approved bookings without a charge use **Confirm & add fee** from their details. No historical fee is added automatically and no bulk backfill is run.

Rejection/cancellation remain separate actions. Cancelling an approved booking does not automatically reverse a confirmed fee or refund a bond. Existing Finance reversal and payment flows remain authoritative.

## Implementation and safeguards

Owner-run migration `supabase/migrations/202611150083_booking_approval_charge.sql` follows 082. It preserves the installed booking decision function under a private, non-client-callable name and reuses it for new approvals, retaining its permission, version, future-time, audit and notification behavior. The public legacy decision RPC refuses approval without a fee; rejection and cancellation delegate to the preserved function. Old frontend versions must be updated together with this migration to use the new approval action.

The new fee RPC independently requires an active signed-in identity and association-level calendar view/approval permission. It accepts confirmed integer-cent amounts from staff, validates bounds and a required explanation, serializes with the same advisory lock as Finance posting, locks the booking and rejects existing charges or stale versions. An exact retry of the same successful confirmation returns its existing charge; changed fees or a different action cannot reuse it. A downstream failure rolls back the booking approval, charge, accounting audit and notifications together.

The posted accounting entry records the confirming approver as creator and reviewer, with an explicit booking-fee confirmation audit. This is the owner's authorized exception to independent draft/post review, not a general bypass of Finance permission checks. Clients receive no direct table-write grants and cannot mark a fee paid. The existing owner-scoped account balance and charge JSON readers are unchanged.

The approval form uses a separate form outside the booking rejection/cancellation form. Pending mutation locks the review frame; any amount/explanation edit clears confirmation. Success invalidates bookings, registry/account balances, charges, accounting, inbox and notification queries in the current client. Other signed-in sessions use the existing account polling interval (30 seconds); this change does not introduce a cross-device push subscription.

## Verification and rollout

Local checks: frontend TypeScript, targeted ESLint, production build and whitespace review. An isolated PGlite rehearsal compiled the real 054/069/083 accounting migrations with synthetic supporting tables and permission helpers, and reused the actual installed-source booking decision body from 014. It exercised denied callers, missing-fee legacy approval, stale versions, negative amounts, atomic approval/charge creation, exact retries, changed retries, owner-scoped Other/Total values, already-approved fee repair and rollback after a forced charge-insert failure. It does not verify live grants, existing database customizations, real overlapping reservations or browser behavior. No automated suites/E2E/axe or live database connection were run.

Owner next steps:

1. Run **083 once after 082** and deploy the updated frontend as one rollout. Do not rerun 082. No BFE Edge Function redeployment is needed.
2. As an authorized booking approver, confirm a synthetic pending booking's fee and approve it. Check the booking, posted charge, accounting history and resident Other/Total agree.
3. Open the existing approved booking without a fee and use Confirm & add fee. Check that no second booking is created.
4. Retry the same confirmation after a simulated lost response; confirm there is one charge. Check rejection creates no charge and a resident cannot invoke approval.
5. Check pending Finance drafts cannot create a duplicate charge, and verify payment/reversal permissions remain unchanged.

## Confirmation form layout (15 November 2026)

Fee confirmation now has its own CSS Module rather than borrowing the resident price display styles. Amount fields align in a responsive grid, fee explanation is a resizable two-row field, reservation-credit guidance remains visible, and a separate summary emphasizes the exact total. All existing centavo calculations, field requirements/limits, confirmation reset on edits, version checks and approval RPC remain unchanged. Unknown quote amounts stay blank; staff must explicitly enter an amount or a justified zero before approving. No blank field is silently treated as zero.

Pending Office booking decisions now place Reject beside Approve & add fee in a shared footer. Reject explicitly belongs to the original decision form through its unique HTML form id and submits Rejected with the original mandatory reason; it does not validate or submit the fee form. The approval button submits only the fee form. Reject remains available if fee review fails to load, and both mutation paths disable conflicting actions while pending. Visitor decisions and resident cancellation actions retain their existing controls.

Owner browser checks: verify field alignment and keyboard order in Inbox and standalone booking dialogs, desktop/mobile/light/dark. With blank amounts, Reject plus a valid reason must still work; approval must stay disabled. With valid amounts, explanation and confirmation, approve once and check one charge appears in Other. Check required reason, fee-load failure, stale version, duplicate click handling and existing visitor/cancellation forms. This layout requires frontend deployment only; migration 083 is the separate existing prerequisite for the fee-posting feature, not a new migration for this UI pass. No BFE redeployment.

## Approval notification fix — owner run 084 after 083

083 inserts a booking-fee notification at /account, but the notification path CHECK from 006 (also present in the owner-supplied schema) allows only seven older destinations. Its 23514 constraint violation rolls back the entire approval/charge transaction. 084 preserves those destinations and adds /account only. It changes no permissions, fee amounts, payments or table write access. Run 084 once, not 083 again. The frontend now recognizes this specific constraint error and gives a plain system-update message; other errors remain under the existing safe handling.

A synthetic isolated local PostgreSQL/PGlite rehearsal reproduced the 23514 with the original allowlist, accepted /account after 084 and continued rejecting an unapproved URL. This proves the path defect; it is not a live approval/permission test. Owner must retry the booking once after applying 084 and check Approved plus one posted Other charge. If it still fails, inspect the actual RPC Response rather than redeploying bfe-create-account.

## Package-price clarification — owner run 085 after 084

Owner clarified on 15 November 2026 that a dash in the package table means the same package price in either daytime/nighttime column. The calculator now quotes hall 9 hours PHP 3,500 and 5 hours PHP 3,000, and exclusive pool 8 hours PHP 5,000 and 5 hours PHP 4,000, in either period within existing operating/booking limits. Hall two-hour day/night prices remain distinct (PHP 1,000 / PHP 1,500). No court cutoff, partial-hour/extension package choice, multi-day rule or reservation credit is inferred.

085 recalculates an unposted booking estimate on staff fee review and authorized owner price reads using its saved use/guest data. Saved snapshots and posted charges are retained. Booking creation continues to enforce the existing hours, maximum duration, slots and availability; this pricing correction does not increase configured duration limits. Older bookings without a saved price still require staff confirmation. Reservation-credit amounts remain explicit to avoid duplicate fees.

Local synthetic SQL rehearsal: both migrations parsed/executed; hall/pool cross-period package rates and distinct hall two-hour rates returned the expected values; staff and owner reads returned the updated unposted rental; posted snapshot read remained unchanged. Live permission, full approval transaction and owner balances require owner verification. Deploy frontend changes and run 084 then 085; no BFE Edge Function deployment is needed.
