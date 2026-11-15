# Workspace data wiring

Prepared migration **078** after 077. Owner runs SQL; Codex has not connected to the live database or applied it. This is a read-only aggregate endpoint, not a posting or authority change.

## Existing data now summarized

| Workspace | Metric | Definition / boundary |
| --- | --- | --- |
| Security | Passes marked Entered | Current `Entered` visitor-pass records across the authorized association scope. Not verified physical occupancy, unique people or vehicles. |
| Security | Recorded movements today | Visitor audit actions Entered or Exited since Manila midnight. Does not include unrecorded gate/device/sticker movements. |
| Security | Recorded entries by pass type | Today's Entered audit actions grouped by visitor/gate/small_delivery pass type. Not the mock's resident/visitor/delivery/service split. |
| Board | Posted invoice coverage, YTD | Posted allocations against unreversed posted invoices with billing periods from January through the current month; numerator capped to each invoice amount. Includes posted imported-receipt allocations via the existing 064 allocation helper. Null when billed denominator is zero. Not bank clearance or all historical imported receipts. |
| Board | Expenses YTD / by category | Posted accounting expense amounts with expense dates from January 1 through today, grouped by existing category. Reversed and draft entries excluded. No amounts inferred from report text. |
| Transport | Riders today | Sum of passengers on requests currently marked Picked up with closure timestamp today. Not unique riders or all completed travel. |
| Transport | Average time to arrival | Mean minutes from request creation to recorded shuttle arrival on today's Picked up requests, excluding absent/invalid arrival timestamps. Not acceptance wait, ETA or service time limit. Sample count is displayed; no timestamps means null. |

All day boundaries use **Asia/Manila** and the server clock. Summaries refresh every 30 seconds. Board published report/record counts and updates retain their existing authorized readers.

## Authority

- Active membership and Auth identity are required.
- After corrective 079, Security summary is available to active Security accounts or existing Developer read access. Hidden Security tabs and explicit read/summary denies remain effective.
- After corrective 079, active Board accounts receive aggregate financial summaries without a raw Finance view grant. Hidden Finance tabs and explicit read/summary denies still restrict financial summaries. Developer read access remains. This does not grant transaction-level Finance reads, writes, approvals or exports.
- Transport reviewers retain association scope. After 079, active Driver accounts may read their own assigned-trip aggregates, even without a current active shuttle assignment; a missing assignment does not authorize operations. Hidden own-transport tabs and explicit read/summary denies are respected.
- No personal identifiers, pass names, roster contacts, payees or raw transaction records are returned by the new endpoint.
- The function uses an empty search_path, explicitly qualified tables, and grants execution only to authenticated. It does not write records or grant roles.

Election turnout remains unavailable: published candidate records do not provide an eligible-voter denominator or certified vote count.

## Rollout

1. Review and run `supabase/migrations/202611140078_workspace_metrics.sql` after 077 in the intended project. Then apply `supabase/migrations/202611140079_workspace_metrics_role_read.sql`. If 078 is already installed, run **only 079**. This implements the owner-approved role-based summary policy and retains explicit hidden/deny restrictions. No roles or raw-record permissions are granted. No BFE redeployment is required.
2. Deploy the matching frontend. Missing endpoint or denied access keeps summaries unavailable; existing pass/accounting/shuttle actions remain on their original services.
3. Owner verifies summaries using appropriately authorized real accounts. Compare Security with pass audit history, Board with posted invoice allocations/expenses and Transport with picked-up request timestamps. Test no-record days, missing arrival times, reversed expenses, no invoices and denied roles/capabilities. Confirm a driver without review rights cannot read another driver's totals.

Local checks cover TypeScript/build, lint, formatting and static SQL/source review only. No live SQL, browser, deployed Edge, SQL runtime fixture, automated suite or production performance validation has been performed. Large datasets may require query/index tuning after owner measurement; no index/state change was applied implicitly.


The old frontend silently merged missing-function and 403 permission errors into Unavailable. The updated client displays distinct setup/access errors. 078 alone retains its original stricter role-plus-capability policy; do not rerun or edit the already-installed migration to install this correction.
