# Customer HOA balance and reviewed historical allocations

11 November 2026. Local implementation and backend migrations prepared. The owner chose Office verification of each lot's billing baseline and historical payment allocations. No live records were read or changed.

## Install

After 063, apply these complete files in order:

1. `supabase/migrations/202611110064_reviewed_receipt_allocation.sql`
2. `supabase/migrations/202611110065_customer_hoa_balance.sql`

Refresh the portal. Do not rerun successful CREATE migrations blindly. Migration 064 guards the installed accounting functions against the reviewed 054 definitions and rolls back if they differ. Inspect a differing installed function rather than removing its guard. The optional metadata check is `scripts/verify-hoa-balance-readiness.sql`.

## What the resident sees

- My account's HOA dues tile and Total recorded balance use the same remaining posted HOA invoice amount. The server returns both values and the shared schema requires them to agree.
- The total is explicitly HOA-only: Water and Other remain unavailable and are not silently treated as zero.
- The Home account summary uses the same service and amount.
- Monthly HOA charges shows billed, applied and remaining amounts by property/month, with Paid, Partial, Unpaid and Review labels. Due dates determine overdue charges using Philippine time. Multiple properties in one month are distinct charges; the month count counts distinct unpaid billing months.
- Posted invoices through the current Philippine calendar month are included; future billing months are excluded until that month begins. Reversed invoices and reversed payment/allocation entries are excluded.
- Unallocated new accounting payments are shown separately and are not subtracted from an arbitrary month. Imported receipts without reviewed allocations are evidence, not automatically credit against an unknown bill.
- With no posted invoices, the display says No bills yet, not PHP 0 or Paid. When some linked properties have no posted bills, the partial property coverage is shown. Periods without posted invoices are never invented as unpaid months.
- An unexpected over-allocation marks the balance Under review rather than displaying a confirmed zero.

The displayed amount is a recorded HOA balance, not certification that all historical charges or other categories are complete. When every recorded invoice is covered it can show zero for that recorded scope, without claiming the whole household has no other obligations.

## Office workflow

1. Check the lot's verified billing start or settled-through baseline and any historical arrears. Do not use the account-link date, first receipt date or an unverified Admin HOA Start as proof. Keep the reviewed source reference in the billing/allocation notes. Unknown opening arrears remain outside the confirmed recorded subtotal until their supporting charges are established; this pass does not create a lump-sum opening-balance adjustment.
2. In Office > Finance > Accounting records > Dues configuration, prepare the applicable monthly rate with its effective date, due day and approved reference. Obtain independent posting approval.
3. Prepare and independently post Billing run entries for the verified lot and billing months. Use the correct PHP 800/non-linear-park or PHP 900/Linear Park rate for the applicable period. Existing One lot/One phase/All active lots scopes remain; do not apply a single flat rate to mixed classifications. No sample rules, historical charges or automatic arrears are seeded.
4. For receipts already imported, choose **Imported receipt allocation**, also linked from the Finance overview. Enter the exact imported OR number, physical lot ID, verified billing month covered, amount and verification notes. A multi-month receipt is split into separate allocations to its actual periods. Save a draft and submit it; another authorized finance reviewer posts it from Accounting records or the existing Review inbox.
5. Record genuinely new payments through Payment recording. Do not recreate an imported receipt as a new accounting payment. The existing duplicate-source payment guard remains.
6. Correct a posted allocation by independent reversal, then a new reviewed draft. Allocations must be reversed before a dependent billing run can be reversed.

Monthly billing remains an Office-reviewed posting workflow. Merely reading the account or knowing its recurring rate never generates invoices. This pass does not install a cron job, automatically post next month's bills, invent a billing start, or automatically assign historical receipts oldest-first. Posting each verified monthly run is how the existing recurring dues policy becomes an actual charge.

## Allocation protection

The new accounting kind reuses the existing creation, submission, independent approval, reversal, version and audit rules. Its submitted entries automatically appear in the generic accounting Review inbox. No permission grants are added.

Posting requires an active imported receipt from the same active property and an existing, posted, unreversed invoice for the requested billing month. Total posted allocations cannot exceed the receipt amount or invoice remainder. An existing posted receipt/invoice pair must be reversed before correction. Manual payment posting also considers imported allocations when checking invoice capacity. The existing accounting-posting advisory lock serializes these decisions.

Applying imported evidence does not insert a second accounting payment or change the original receipt. Finance's allocated-payment summary now includes these reviewed applications, while imported collection totals are left alone. Once an allocation is independently posted, it remains a journal decision until reversed; archiving its source receipt batch does not silently reverse that finance decision.

## Access and refresh

The balance read returns only the caller's current approved relationships to active imported lots, subject to Finance own/association view and the existing lot-read predicate. Association scope does not turn this endpoint into an all-lots query. Duplicate relationships to the same lot do not duplicate invoices. No payer names, OR details, verification notes or another account's allocations are returned.

Authorized audited account preview adds this STABLE read to its existing dispatcher and client allowlist. Preview cannot post accounting records. Direct signed-in balance summaries refresh every 30 seconds while open and on window focus. Posting/reversal invalidates the registry balance queries in the same session. Invoice pages beyond the first have their own refresh; page zero shares the summary cache. A page reset handles invoice counts shrinking after reversal. Raw imported receipt entitlements remain separate from the invoice balance summary.

## Validation and owner acceptance

An isolated synthetic PGlite smoke check compiled 064/065 and exercised the actual accounting service bodies: three PHP 800 invoices with one reviewed PHP 800 allocation returned PHP 1,600 in both HOA and total, with two unpaid months. Self-review, duplicate allocations, receipt over-allocation, invoice over-allocation and dependent billing reversal were rejected. Reversing the allocation returned both recorded balances to PHP 2,400. An unrelated account saw no invoices. Permission helpers were stubbed in that isolated check, so it does not establish the live role configuration or production access behavior.

Owner browser checks after installation: create reviewed synthetic/staging billing records with separate creator/reviewer accounts; verify monthly, partial, unallocated and reversed cases; compare the HOA tile, recorded total, Home card and Office ledger; check no-data versus verified zero, multiple/expired/revoked links, future billing months and 30-second refresh. Verify authorized account preview and unrelated real accounts. Inspect desktop/mobile layouts, expanded monthly details and pagination. Real historical charges and allocations need Office verification before posting.

No automated suites, live SQL application, deployment or publication is part of this local implementation.
