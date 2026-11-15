# Payment history after Office links a lot

## Cause and correction

The previous receipt policy treated an approved owner link and historical receipt access separately. Owner links required per-receipt entitlements, while migration 061 already allowed current approved household links to see their linked lot's receipts. This could leave an approved owner link with an empty payment history.

The owner has now authorized approved owner links to show the linked lot's existing and future recorded receipts automatically. Migration `202611130075_linked_owner_receipt_access.sql` extends the existing shared receipt scope to owners. The permission check, individual-receipt read policy and history query already consume that scope. The history query excludes overlapping entitlement rows, so they do not duplicate the linked receipts.

Active membership, approved/current link dates, active lot and receipt imports, explicit permission rules, date filters and pagination still apply. Revoking or expiring the link removes access through that link. Household access is preserved; renter-only links are unchanged. The migration does not create payments, import missing receipts, alter financial balances, confirm bank clearance, or grant financial approval/export permissions.

## Owner rollout

Run **075 after 074**, with 061 already installed. The script aborts without changes if the expected 061 scope/integration is missing or customized. Do not bypass a guard failure; inspect the installed definitions first. No `bfe-create-account` redeployment or frontend change is required for **075 alone**. Earlier pending frontend/SQL/Edge changes have their own rollout requirements.

After success, reopen or refresh the customer's Payments tab. Previously approved owner links are covered immediately; there is no need to approve each receipt. Receipts must already exist against the same internal lot ID in an active import. An address displayed on a member profile is not an approved lot link.

## Owner acceptance checks

Use synthetic accounts or private existing accounts without copying personal information into source/screenshots:

1. For an approved owner link with active imported receipts, verify Payment history lists those receipts, with correct totals, dates and pagination.
2. Verify a newly imported receipt becomes visible without a new entitlement. Existing entitlements must not duplicate rows.
3. Verify pending, revoked, future-start and expired links cannot expose the lot's receipts. Test another unlinked lot and a signed-out user as well.
4. Verify existing approved household access still works and renter-only behavior is unchanged.
5. Verify inactive receipt imports stay hidden and unrelated lots stay inaccessible. An account with separately authorized association finance access is not a valid negative test for own-lot access.

The migration received static source review only. No live SQL or browser checks were performed by Codex. Runtime access and actual imported data remain for owner verification.
