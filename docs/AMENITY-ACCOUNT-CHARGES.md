# Amenity choices and account charges

Local implementation, 11 November 2026. No live connection, SQL application, publication or deployment was performed.

## Booking names

The preview's former Clubhouse choice is now Swimming pool, with one pool option rather than duplicates. Function Hall remains a separate amenity with its own rules. Service text, default choice, sample fixture and old local sample titles are updated. Only local synthetic records are normalized; actual booking history is not relabelled.

Apply **068** after 067 to replace the connected legacy choice. It deactivates active facilities named exactly Clubhouse after trimming/lowercasing, keeps their historical bookings, and reuses an active Swimming pool if one exists. If no pool exists, it creates one with the PDF's weekly operating envelope (7 AM–9 PM) and capacity 40, retaining the prior slot size, maximum duration and renter configuration for Office review. Migration 067 narrows that envelope by day. The script stops if future Pending/Approved Clubhouse bookings need resolution, or an inactive Swimming pool needs review. No booking is reassigned, cancelled or repriced. Function Hall records are untouched. No active Clubhouse means there is nothing for 068 to replace; facility setup still belongs to the Office.

## Fees and Total balance

Implemented the workflow presented in the clarification: **approved booking → Office quote → Finance draft → submit → independent posting**. Pending requests are not debts. The owner subsequently confirmed that fees belong in Other after Office approves the booking and confirms the fee, and that Clubhouse should be replaced by the pool while Function Hall stays separate. Existing independent Finance posting remains the confirmation step; unapproved requests are not automatically charged.

The booking detail shows an Office-confirmed fee or a pending-confirmation message. Authorized staff can open Prepare booking charge, which links to Finance / Accounting with the booking reference prefilled. Choose New draft there, enter the reviewed quote and source reference, submit, then have a different authorized reviewer post it. Existing draft/version/audit/permission rules remain server-owned.

The new Amenity charge form separates rental, additional reservation fee and refundable bond. Office enters an additional reservation fee only when it is actually additional; the PDF does not establish whether the reservation fee is credited to rental. Zero amounts support a confirmed free-use booking. No rate, day/night cutoff, eligibility, extension, child age band or fee interpretation is inferred. PDF rate/rule information stays available in the existing expandable guideline.

After posting:

- **Other** is the remaining amount of posted amenity charges for bookings owned by the signed-in account.
- **Total balance** is posted HOA balance for current approved linked properties plus Other. Home and My account share the same read/query. Water dues are explicitly unavailable and are not treated as zero.
- Account details list rental, extra reservation fee, bond, total charge, verified payment and remaining balance, with paging. A refundable bond is an amount collected subject to review; it is distinguished from rental, not represented as permanent income.
- Finance's Amenity payment form applies a verified payment to a specific charge. It reduces Other and Total balance after independent posting; the app neither takes a bank payment nor lets a resident mark anything paid.

Duplicate posted booking charges, overpayments, reused payment references and receipt references already present in imported records are refused. The payment-reference check also blocks a later ordinary Finance payment from reusing a posted amenity payment's reference. A single receipt cannot be split over charges through this implementation; resolve that allocation policy before extending it.

Reversing a payment restores the charge remainder. A charge with posted payments cannot be reversed until those payments are reversed. Booking cancellation does not silently waive the fee or refund a bond: the guideline has non-refundable fee and review conditions. Refund disbursement, forfeiture, payment gateway collection, late fees and automatic pricing are not implemented. Corrections use the reviewed reversal/replacement workflow; no posted amounts are edited in place.

## Rollout and checks

1. Confirm 066/067 and earlier prerequisites are installed. Apply **068**, then **069** using the owner's normal SQL process. Migration 069 adds charge/payment records and accounting form definitions, not resident charges or permission grants.
2. Review the legacy facility's bookings and pool slot/duration/renter configuration. Resolve 068's blockers explicitly; do not delete history or bypass them.
3. Publish frontend through the authorized release process. The new balance read requires 069. A missing read reports unavailable rather than substituting a sample balance.
4. In an isolated project, create a labelled synthetic booking, approve it, prepare/submit/post its fee with independent Finance accounts, then verify the booking detail, Other and Total balance. Post/reverse partial payment, verify unauthorized and duplicate refusals, inspect pagination and confirm unrelated accounts see none of the charge.
5. Run `scripts/verify-amenity-account-readiness.sql` for read-only metadata/counts; it creates no charge or payment.

Executed locally: frontend TypeScript, formatting of edited source and `git diff --check`. Isolated synthetic PGlite applied actual 054/064 accounting services, the 065 HOA read, 068 and 069; it exercised real save/submit/post/reverse calls, pool dedup/history retention, pending-booking and duplicate-charge refusal, self-review/resident refusal, overpayment/duplicate receipt refusal, own-account isolation, charge/payment reversal and retained fees after cancellation. A ₱3,500 amenity charge appeared as Other; a ₱1,000 payment reduced it to ₱2,500. After reversing that payment, an ₱800 posted HOA invoice produced ₱4,300 Total balance. Reversing the amenity charge left ₱800 HOA.

Permission helpers and the preview dispatcher were stubbed in the isolated check, so this is not live Auth/RLS or authorized-preview validation. No automated suite, browser run or axe sweep was performed for this change. Owner must verify role configuration, concurrency with real sessions, existing receipts, actual schema/preview-dispatcher compatibility, mobile/desktop wrapping and live outcomes.
