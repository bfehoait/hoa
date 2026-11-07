# Lot register and receipt migration — operator instructions

Remaining legacy sections: see [LEGACY-MIGRATION.md](LEGACY-MIGRATION.md). Run `scripts/assess-legacy-data.sql` for the read-only next assessment; do not repeat the workbook import.

Status: migrations 001–005 were reported installed by the user. The user completed the three-part import; their SQL Editor screenshot confirms an active batch with 921 lots, 4,314 receipts and 566,005,850 centavos. Their signed-in Lot Register screenshot shows imported records. The agent has not connected to a live database or created real accounts.

Authenticated finance entry points (`/office/finance`, `/office/finance/collections`, `/office/finance/reports`) now use the existing receipt RPC, including date filters, monthly/phase/lot aggregates and permitted receipt details. These local frontend changes require a browser refresh; the development tunnel serves the local app, not an independently deployed release. Exports retain their separate permission. Expenses and bank reconciliation show unavailable states; approved invoices, allocations, expenses and bank evidence have not been supplied by this import. Preview and role-preview workspaces remain synthetic.

## SQL Editor upload in three parts

If the full file exceeds the SQL Editor size limit and the owner has no database password, generate three smaller files locally:

```powershell
python scripts/assess-lot-workbook.py 'C:\Users\User\Downloads\BFE Lot Register v2.xlsx' --output-sql-parts '.private-imports/lot-register-v2-parts'
```

In the authorized target project's SQL Editor, select the `postgres` role and run each complete file in order: `lot-register-part-1.sql`, then `lot-register-part-2.sql`, then `lot-register-part-3.sql`. Wait for success after each. These are private data files; do not publish them or use the original oversized file as well. Do not rerun migration 005.

The first file creates a restricted upload schema. The first two files commit upload chunks only; the third verifies all three chunk digests, counts and exact centavos before calling the existing atomic importer. Finalization and upload-schema cleanup share a transaction. Missing or changed chunks abort finalization without inserting registry records. If any part fails, stop and inspect its error; when retrying in the same SQL session, run `ROLLBACK;` first if it remains in a failed transaction. All three original files can be replayed in order; the existing workbook checksum prevents duplicate imports. The final result must show 921 lots, 4,314 receipts, 566,005,850 centavos and active status. Database-password access is not required for an already authorized dashboard SQL Editor session.

Generated parts are each constrained below 950,000 UTF-8 bytes. Actual dashboard acceptance remains to be confirmed by the operator. Interrupted uploads remain in the restricted schema until the three-file workflow completes; they do not appear as imported lots or receipts.

## 1. Choose the private environment first

Use an owner-approved, isolated private staging project with the existing application prerequisites and migrations 001–004. Do not run this against Kate's source project, edit the reference SQL, or use a publicly accessible demo for these real records. Creating new tables does not repair legacy `members` / `portal_data` policies. Private staging access restrictions and review of legacy data exposure are prerequisites to importing real data.

Back up the target database before installing or importing. The app needs only its existing browser-safe URL/publishable-key configuration. Never add an owner password, secret key or service-role key to a `VITE_` variable.

## 2. Install the application migration

Open `supabase/migrations/202611060005_lot_register.sql`. Review it, then run the complete file once in the approved staging project's SQL Editor as its database owner. It creates lots, source evidence, memberships, receipts, explicit receipt entitlements, private import staging and audit records. It seeds no accounts, permissions or real data.

Do not rerun successful migrations 001–004. If 005 fails, keep the error, run `ROLLBACK;` if necessary, and resolve it before retrying the complete migration. Do not run selected fragments or disable RLS to bypass an error.

## 3. Validate the workbook offline

In PowerShell, from the project root:

```powershell
python scripts/assess-lot-workbook.py 'C:\Users\User\Downloads\BFE Lot Register v2.xlsx'
```

Python 3 is required; the utility uses only its standard library. It reads both entire worksheets, validates cached cell values without evaluating formulas, checks all lot/payment links, and reconciles monthly and YTD summaries. It never connects to a database. Its output contains aggregate counts and a file checksum, not resident records.

Expected baseline:

| Check | Expected |
|---|---:|
| Lots | 921 |
| Phase 1 / 2 / 3 | 669 / 198 / 54 |
| Receipts | 4,314 |
| Total centavos | 566,005,850 |
| Total PHP | 5,660,058.50 |
| Lots with receipts | 637 |
| Created accounts / ownership links | 0 / 0 |

Unexpected headers, additional sheets, conflicting identities, invalid dates, fractional centavos, missing lot links or unreconciled totals stop preparation. Excel's sub-millionth-cent representation noise is rounded; genuine fractional-cent values are rejected. A revised master workbook with different counts/amounts requires reassessment and an explicit baseline update, not bypassing validation.

## 4. Prepare the private import file

Only after validation and staging approval:

```powershell
python scripts/assess-lot-workbook.py 'C:\Users\User\Downloads\BFE Lot Register v2.xlsx' --output-sql '.private-imports\lot-register-v2.sql'
```

This creates a sensitive SQL file locally. It is ignored by version control and denied by the Vite dev server. Do not move it into `public`, upload it to a public issue, paste it into chat, include it in screenshots or commit it. The command refuses to overwrite an existing output file. The original Excel remains outside the repository.

The generated file includes one transaction calling the owner-only import function. The utility does **not** execute that SQL. No browser account, including a developer, can invoke the import function.

## 5. Execute and reconcile in private staging

Review and run the generated SQL file as the authorized database owner in the approved staging project. The final `COMMIT` activates the batch only if the whole operation succeeds. If the SQL Editor cannot accept the file size, use the owner's normal PostgreSQL client with its secure connection configuration and the file input option; do not split the import into partial commits or place connection credentials in source.

The returned UUID is the import batch reference. Preserve it with the backup/change record. Compare the batch's `lot_count`, `receipt_count` and `total_centavos` in the private Table Editor against the baseline above. The private `bfe_import_stage` retains worksheet row provenance. Inspect names and review exceptions only inside the authorized private environment.

Same checksum: returns the existing batch without importing again. A changed file with identical evidence reuses existing lots/receipts. A changed record with an existing lot/OR identity stops the transaction instead of overwriting history. The OR namespace is globally unique in this assessed source; reassess this rule if future agency exports reuse OR numbers across series.

## 6. Open the connected screens

Start or refresh the app with `npm run dev` (use `npm.cmd run dev` if PowerShell blocks npm.ps1).

| Screen | Route |
|---|---|
| Staff lot register | `/office/lots` |
| Lot Profile | Open a lot in the register |
| Recorded collections | `/office/finance/collections` |
| Resident account / linked lots | `/account` |
| Common account lot access | `/more/lots` |

Developer navigation includes Lot register. Staff overview includes Lot register under People & property and Recorded collections under Finance. Role previews stay synthetic and never issue real registry writes. Authenticated account views do not substitute sample balances when the registry is unavailable.

Missing 005 or denied access produces an error, not a synthetic fallback. No resident account is linked by matching its name or existing free-text `members.unit`.

## 7. Review people and access

1. Residents open Your lots and choose **Request a lot link**, enter the physical lot ID and select owner/renter/household. This grants no access. Unknown lot references receive the same neutral response to avoid a public lot lookup.
2. A different authorized reviewer opens the lot's **People** section, checks the supporting evidence outside the app and chooses **Review account link**.
3. Approval requires a developer or `property/manage/association`; staff also need registry viewing permission to use the screen. The approver cannot approve their own link. Use the other authorized developer to review a developer's personal ownership claim.
4. Record a verification reference and optional expiry. Expiry, revocation and account suspension remove access on subsequent database requests. Rejected/revoked links are not silently reactivated; request a new link for a new relationship.
5. An owner link alone does not expose historical receipts. In the lot's **Receipts** section, a developer or `finance/approve/association` reviewer chooses **Receipt access**, selects the approved owner and grants/revokes entitlement for that specific receipt. Finance viewing permission is also required to see the receipt being reviewed; registry viewing permission is needed to select other people's lot memberships in the UI.

Do not grant a property or finance permission just because a user is admin/BOD. Use the existing developer access controls to provision explicitly approved module/action/scope grants. Renter/household relationships receive no financial entitlement in this release. Historical receipts remain hidden if the account lacks own-finance capability, even with an entitlement.

## 8. Correct a recorded homeowner

On **Overview**, an authorized property manager chooses **Correct recorded name**, supplies the verified correction and its reference, then saves. The operation preserves the original Excel name and source fields, records an audit event, checks for concurrent edits and changes no account link.

The display remains a recorded homeowner label; it is not legal title certification. Ownership/occupancy verification and account linking are separate operations. Receipt amounts/payer history have no generic browser edit/delete operation. Conflicting financial evidence requires an audited correction/reversal design, not direct overwrite.

## 9. Collections and exports

Collections are grouped by **receipt date**, with monthly, phase and lot totals. Filter the dates, then choose **Download CSV** if granted `finance/export/association`. Export independently rechecks access server-side and reconciles pagination before generating the download. Keep the CSV private.

The file includes report basis, dates, totals, monthly/phase/lot breakdowns and receipt detail with source/batch references. CSV values are formula-escaped by the shared download utility. It is receipt evidence, not proof of bank clearance or a paid invoice. Missing approved billing, allocations, balances, budget, expenses and bank statements remain unavailable. No AR/debt is inferred from the 284 lots without receipts.

## 10. Recovery and acceptance

Failed import: no partial batch is committed. Investigate privately and correct the source/validation issue; do not delete pre-existing records.

For a committed batch that must be hidden, the database owner can run:

```sql
SELECT public.bfe_withdraw_registry_import(
  'REPLACE_WITH_BATCH_UUID'::uuid,
  'Owner-reviewed recovery reference',
  false
);
```

This preserves receipts, memberships, corrections, source evidence and audit history; it hides the lots/receipts originally created by that batch. It does not delete data or affect records originally created by other batches. A matching later import does not take ownership of old records, so restore the original batch if those original records should become visible again. Use the same function with `true` only after owner review. Before withdrawal, review dependent account links and downstream records. Use the backup for disaster recovery, not broad DELETE statements.

Before inviting real residents: verify own/other-lot isolation, explicit receipt entitlement, expired/revoked/suspended access, property-versus-finance separation, view-versus-export separation, independent approval and the legacy data-exposure boundary. Test through authenticated clients, not only owner SQL Editor queries. Production release is not approved merely because the migration installed successfully.

## Separate additions — tracked, not claimed complete

- **Incidents and announcements:** assess actual saved exports and attachment access, then migrate; the workbook contains neither.
- **Visitor/security operations:** shared resident/security records, guest authorization, guard-managed deliveries, QR/manual lookup and entry/exit events. Gate/device/connectivity rules still need meeting confirmation.
- **Helpdesk:** align Issues, Complaints, Concerns and Ideas with server categories and responsible staff.
- **Financial statements:** approved charges, allocations, opening balances, expenses, budget, reserves and bank evidence before AR aging/delinquency and accounting reports.
- **Developer/mobile polish:** earlier mobile homepage/button alignment and broader popup review remain separate UI work. Developer editing exists only for implemented protected operations, not every legacy JSON section.
- **Profiles/notifications/PWA:** retain existing implementations; later acceptance must verify them with the installed backend. No claim of push/email delivery.

No deployment, public-data replacement, source-project edit or live database action was performed by the engineering agent.
