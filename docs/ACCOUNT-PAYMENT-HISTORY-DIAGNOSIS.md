# Existing account payment history

The customer Payments tab already reads `bfe_lot_receipts`; it does not create receipts, invent payments, compute outstanding bills or match accounts by name/address. Read-only account preview routes the same read through the existing audited preview gateway.

For resident access, the established database rules require an active imported receipt and lot batch, finance view permission, a current approved owner membership and an unrevoked entitlement to that receipt. Association finance viewers can have broader access. An empty result and a failed read are different states; the shown screenshot is a failed read.

## Diagnose the current failure

1. Open the affected account preview immediately before diagnosis.
2. In the project owner's SQL Editor, run all of `scripts/verify-account-payment-history.sql`.
3. Share the `account_payment_check` JSON result. It excludes names, account IDs, amounts, receipt details, tokens and raw SQL context.

The diagnostic uses the latest active account-preview session. It compares a direct receipt read as that target with the normal preview gateway. Temporary diagnostic setup and any preview audit entry are rolled back. It creates or changes no receipts, memberships or receipt entitlements. Do not use the result as permission to expose all receipts or automatically associate a similarly named payer.

If both reads succeed, investigate the browser/API response and schema validation next. If only the gateway fails, inspect preview dispatch. If both fail, use the returned database code to inspect the receipt read and its helpers. If no preview is active, reopen it and rerun. The live root cause has not yet been established. Following the reported timeout, migration 036 prepares a scoped query optimization; see below.

## Local checks

When the page loads successfully but shows zero receipts, run `scripts/verify-account-existing-receipts.sql` with a fresh affected account preview open. It returns only counts and permission flags. No approved owner links means records may be unlinked; it does not prove there are no imported payments. Existing receipts for approved owner lots with zero entitled receipts indicates missing or revoked receipt access. Zero existing receipts for approved owner lots means none were found in the active imported batches for those verified links. A false own-finance permission or inactive membership can also explain invisibility. Association access has broader semantics; its readable records are not represented by the owner-lot-only counts. Do not grant entitlements or change property links automatically based on this report.

The original receipt function executed successfully against synthetic tables. A separate isolated PGlite check used the actual receipt-read predicate and function with synthetic membership/receipt records and stubbed permission helpers: one entitled receipt was visible while another existing receipt without entitlement remained hidden. The rolled-back diagnostic executed through a synthetic preview gateway and returned the expected counts. This does not validate the deployed gateway, database grants or imported records.

Frontend TypeScript passed. Payment read failures now show a sanitized error code and read-specific wording; backend error bodies and private record contents are not displayed. Owner diagnostic output is still needed to fix the reported live error.


## Timeout follow-up and migration 036

The original receipt query repeatedly invokes the receipt-access predicate in detail/count and summary scans. Migration 036 caches the unchanged finance permissions once, builds the approved-owner/unrevoked-entitlement set once, filters active receipt and lot import batches, and materializes the authorized result for pagination and summaries. It does not add receipts, memberships or entitlements, or infer balances. A source guard refuses installation if the installed receipt-read predicate differs from migration 005, so custom receipt restrictions are not silently bypassed.

The owner can apply 036 after 035, then reopen the affected account preview and refresh Payments. If diagnosis is still needed, the updated diagnostic uses an eight-second statement limit and handles query cancellation explicitly instead of letting WHEN OTHERS miss it. On direct-read timeout it skips the second read. The short limit reduces the chance of a gateway timeout; it cannot guarantee the SQL Editor upstream will wait eight seconds.

A result with active_preview_found=false means no payments read was executed: account previews expire after ten minutes. Open a fresh affected preview and rerun immediately. That result is neither an empty receipt history nor proof that the payment issue is fixed.

Local verification compared complete old/new JSON results in 13 scenarios using 64 synthetic receipts, covering own/association/no access, revoked entitlements, rejected/future/expired/other-account/renter memberships, withdrawn imports, filters, pagination and export. A customized receipt-read predicate caused installation to fail as intended. Validation/authority checks also produced the expected 22023/42501 errors. Fixture parameter casting and replacement-function argument naming were corrected before the successful comparison run. Permission helpers were stubs; no live query plan, production timings or deployed gateway were verified.
