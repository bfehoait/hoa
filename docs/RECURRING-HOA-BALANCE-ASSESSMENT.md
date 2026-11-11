# Recurring HOA balance assessment

11 November 2026. Assessment only; no behavior, rates, invoices, allocations or permissions changed. Source and the user-provided workbook were inspected locally. No live accounting data was queried.

## Intended customer display

The My account HOA dues tile should eventually show the remaining balance of verified HOA charges for the linked lot, rather than the recurring monthly rate. The rate stays separately labelled PHP 800/month or PHP 900/month. An unpaid-month count should describe billed months with remaining amounts; an overdue label additionally requires an established due date.

Example: three approved monthly charges of PHP 800 total PHP 2,400. If a verified PHP 800 payment is allocated to one of those invoices, the remaining HOA balance is PHP 1,600 across two unpaid billed months. This conclusion depends on the charges and allocation, not merely on two months lacking receipt rows.

## Current implementation

- HouseholdAccount.tsx hardcodes Total balance Unavailable and the three No data tiles. Those values are placeholders, not queries proving that a particular account has no billing records.
- Migration 062 supplies a recurring monthly rate from the owner-confirmed policy and the imported Linear Park classification. It does not accrue monthly debts or create invoices.
- Migration 054 has accounting invoice and payment tables. Posted billing runs create monthly invoices; posted payment records can be allocated to an explicit invoice month. Independent finance review, reversals and duplicate invoice guards already exist.
- The customer account does not yet have a permission-scoped read of those posted invoices and allocations. The Office accounting dashboard uses association scope and must not be exposed directly to residents.
- Existing billing runs are explicitly posted workflows, not automatic scheduled recurring billing. A rate display or page visit must not generate charges.

## Workbook evidence

LOT Register contains 921 lots. Admin HOA Start is supplied for 678 and blank for 243, but Billing Start Verified and Verified Monthly Rate are blank for all 921. The owner has since confirmed the PHP 800/900 rate policy; this still does not establish the effective start date, historical rate changes or opening arrears for each lot.

Payments contains 4,314 receipts with lot/date information. There are 265 lot/receipt-month groups with more than one receipt. Columns contain receipt month/date, account series, payer, OR number, amount, physical lot and source file. There is no explicit billed-month allocation, charge category or verified opening balance field in this sheet.

Therefore a receipt dated in one month cannot automatically be treated as that month's full HOA payment. It may relate to a different month, multiple periods or a partial amount. Conversely, no receipt row in a month is not sufficient proof of an unpaid invoice. Aggregate counts were inspected without printing identities or financial rows.

## Recommended implementation sequence

1. Establish an approved billing baseline for each lot: effective start month, opening balance or settled-through month, applicable rates over time, due day and any exemptions. Do not infer this baseline from account-link dates or the first imported receipt.
2. Preserve imported receipts as evidence. Add a reviewed allocation/reconciliation workflow that maps each accepted receipt amount to actual HOA invoice periods, including partial, advance and arrears payments. Prevent the same imported receipt from being counted again as a new accounting payment.
3. Generate each recurring month's charge through a server-owned, auditable process with one active HOA invoice per lot/month and the existing independent posting authority. Decide whether recurring drafts are scheduled or Office initiates monthly runs; do not silently bypass posting review.
4. Add a customer read service scoped to current approved account-lot relationships and finance permissions. Return billed amount, allocated amount, remaining HOA amount, unpaid periods, unallocated credit and a completeness state. Exclude reversed invoices/payments. Show partial payments explicitly and do not subtract an unallocated credit from an arbitrary month.
5. Wire the HOA tile to that service. Show No billing data when the baseline/coverage is incomplete; PHP 0 only when verified billing coverage establishes a zero remainder. A genuine invoice balance can be shown even when unrelated historical receipt mapping is pending, with its exact covered period clear.
6. Keep Water and Other unavailable until their charges are separately connected. Total balance must not imply a complete household total while these categories or the HOA baseline are unknown. It can be labelled a known HOA balance or known charges subtotal instead.

Before implementation, the owner needs to settle the official billing baseline/effective dates, due day and the rule or Office review process for historical receipt allocation. Owner browser acceptance must cover multiple linked lots, missing baseline, partial/advance payments, reversals, duplicate import protection, expired/revoked links and month-boundary behavior in Philippine time.

No SQL needs to be run for this assessment.
