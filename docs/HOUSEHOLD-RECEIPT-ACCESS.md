# Approved household receipt access

11 November 2026. The owner explicitly selected: **approved household members see all existing and future receipts for their linked lot**.

## Owner installation

Apply **supabase/migrations/202611110061_household_receipt_access.sql**, once, after installed 060. Then hard-refresh the customer and Office tabs so the permissions and receipt queries reload. No existing links need to be recreated.

The migration guards the installed base-access, receipt-read and optimized receipt-history definitions before changing them. It accepts the reviewed 023/045 base variants and the 005/036 receipt services. If a guard reports a different definition, stop and inspect it; do not remove the guard or repeatedly rerun the script. The entire update rolls back if a check fails.

## What becomes visible

- The account must be active and its household relationship must be approved, already started and unexpired. The lot and receipt import batches must be active.
- Existing historical receipts and later receipts for that lot become visible automatically while the relationship remains current. No per-receipt household entitlement is required.
- The relation may be `household` even if the account's primary role is renter. The added capability is Finance **view / own** only; no role is changed.
- Configured visibility rules, explicit Finance denials and existing property visibility remain in force.
- Owner relationships retain their existing per-receipt entitlement path. The migration does not automatically grant the same sharing rule to renter relationships; the approved relationship must be household for this new path.
- Overlapping household access and an owner entitlement do not duplicate receipts or totals.
- Revoking or expiring the household relationship removes this sharing path. Other independently valid, authorized access paths remain effective.

This is receipt visibility, not approval of payments, bank clearance, balance settlement, ownership, a gateway connection or export authority. Historical receipt amounts do not establish a current balance. The separate new accounting ledger remains outside this historical-receipt display integration.

## Customer interface

An account with an existing approved link sees **Link another property** instead of Request a lot link. The existing property does not need another request. Receipt descriptions refer to current household relationships and receipt permissions.

The complaint screen also received a frontend fix in this pass: the shared Field component now supports an input plus helper text instead of treating the entire child list as one element. It generates missing input IDs and associates labels/validation messages. This crash fix requires a browser refresh, not a database update.

## Checks and owner verification

Local isolated SQL checks exercised household historical/new receipts, unrelated-lot exclusion, individual-read/history consistency, export refusal, future/expired/revoked relationships, explicit Finance denial and duplicate-free overlapping access. An isolated rendering check ran the actual Field function with an input, helper and error message. TypeScript/build and targeted lint results are recorded in the completion report. No automated test suite, end-to-end browser run or live database change was performed.

After 061, open the linked household account's Payments tab with blank date filters. Verify against Office that it sees the receipts actually imported for that property. An empty result may still mean the linked lot has no active imported receipts; the update does not create or move historical records. Check another unrelated household for isolation, and verify revocation using association-approved test procedures.
