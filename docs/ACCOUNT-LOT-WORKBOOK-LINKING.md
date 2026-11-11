# Match existing accounts to workbook properties

The owner-supplied `BFE Lot Register v2.xlsx` was validated locally using the existing workbook assessor. It contains 921 distinct lots and 4,314 receipt rows, with checksum `4cbbf76d44cbbb6b89e6a48ddcd0533673320938415676bb40fb3f361bf5d49e`. No workbook formulas or embedded instructions were executed. No private workbook names, addresses or receipt rows were added to source, logs, fixtures or screenshots.

The owner subsequently supplied a member export for offline comparison. Its private assessment is described below; the portal workflow still rechecks current database rows against the active import before applying any links.

## Owner setup and use

1. Apply migration `202611090037_reviewed_account_lot_link.sql` once after 036. Installing it creates no account-property links or receipt entitlements.
2. Refresh the frontend and open the developer member-account list from the screenshot, outside read-only account preview.
3. Use **Match this page to workbook lots**, then **Check workbook matches**. The check covers the actual accounts on that page, up to 20; it does not silently select the first 20 accounts in the database or process other pages.
4. Review the names, recorded addresses, matched physical lots and recorded workbook owners. Enter a verification reference, confirm the review and use **Link verified matches**.
5. Reopen the member's account to see its approved property link. Use the lot register's existing **Receipt access** review for specific historical receipts as appropriate. Linking a property does not automatically disclose all past payments.

Only active accounts whose roles include homeowner qualify for workbook-based owner linking. The match requires a recognized full phase/block/lot and an exact normalized owner name on the same lot from the assessed active workbook batch. Normalization removes formatting/punctuation, ignores case, and recognizes a single `Last, First` comma format. It does not use fuzzy names, nickname expansion, partial matches, payer-name guesses or address alone. Forms such as `PH1 B3 L6`, `P1-B3-L6`, `Phase 1 Block 3 Lot 6` and canonical `1-03-006` are recognized. Oversized block/lot components are rejected instead of truncated.

Duplicate active account names, changed owner records, different imports, missing/ambiguous addresses, mismatches, non-homeowner roles, inactive accounts, the reviewer's own account and expired/future existing owner links require separate review. These are excluded from automatic linking. The exact current workbook must already be installed as an active import; this workflow does not import or replace it.

## Authority and existing data

All new RPCs enforce active reviewer membership plus people-view, property-view and property-management authority at association scope. They are unavailable through the read-only account-preview allowlist. The apply operation recomputes the report, rejects stale account/lot snapshots, serializes account linking, and reuses the original independent membership-approval/audit function. Matching and linking are distinct operations. Apply is transactional, and retries retain existing current links instead of creating duplicates. No homeowner names, payments, balances, rates or receipt entitlements are overwritten or manufactured.

## Local verification and limits

Frontend TypeScript and whitespace checks passed. Isolated PGlite execution used the original registry tables and membership-review function, with synthetic accounts/lots and stubbed permission helpers. Thirteen account classifications covered exact names, comma-form names, canonical addresses, duplicate names, oversized addresses, different imports, inactivity, renter roles, corrected owner records, missing lots, expired links and self-review. Read-only checks created no links; applying created two expected owner links; retry returned both as already linked. No receipt entitlements were created. Stale reports and denied authority were rejected.

An initial fixture helper failed because its test-only SQL used unqualified names under an empty search path; that fixture was corrected before the successful run. No live connection, live matching, approval, deployment, automated browser suite or screenshots were performed for this workflow. Live linking remains for the owner's portal check.

## Owner-supplied export assessment

The authorized offline comparison covered 24 exported member rows: 20 had account IDs and four did not. Six complete recorded addresses were found in the workbook. Five belong to homeowner-role accounts with differing recorded owner names; the sixth account lacks a homeowner role. No strict normalized full-name-and-address match qualified for automatic linking. One name-order difference and one incomplete-name difference are identified for identity verification; neither was treated as an approved match.

The private input and detailed JSON/Markdown reports remain under ignored, dev-server-denied `.private-imports/`. No apply SQL was generated because there were no qualifying exact matches. Workbook receipt counts describe existing source rows, not account entitlements or confirmed payment status. No account links, owner records or receipt permissions were changed.
