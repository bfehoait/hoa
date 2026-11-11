# My account UI

Local customer frontend update, 9 November 2026. Uses the reference's rounded cards and clear hierarchy with Bellefort colors. No new database migration, rate, billing source, account authority or Edge Function is added.

## Page structure

- Compact My account heading with the account-holder name, recorded address and Profile details link. A recorded address does not approve a lot link or establish ownership.
- One prominent burgundy Total balance card remains above the account tabs, containing three inset translucent panels for HOA dues, Water dues and Other. All three panels stay side-by-side on phones and desktop. Total remains Unavailable and the panels say No data until approved bill data is connected. No deposit card or invented zero is displayed. No duplicate service shortcuts or announcement feed is added here.
- Properties: the existing permitted lot records and lot-link request workflow, embedded under the account header. Search remains; office registry-status, review-priority and phase filters are omitted from this customer presentation. Property detail, recorded-owner wording and receipt/claim permission checks remain unchanged.
- Payments: a compact list using the existing protected receipt RPC, date filters and 20-record pagination. Receipt number, lot, date and recorded amount are displayed. No receipt total is presented as a current balance or bank-cleared payment. Empty results mean no records are available to this account, not that the household has paid nothing or owes zero.
- Existing five-item resident bottom navigation is retained instead of the reference's Home/Profile/Logout footer. Synthetic fixture Account remains separately labelled and unchanged.

The Overview tab has been removed. `/account` opens Properties by default; `/account/lots` and `/account/payments` remain available. The balance card stays visible above both tabs. Existing `/account/lots/:id` property details retain their established workflow. All existing route visibility and server data permissions remain in force; elevated accounts may see records their authority permits, so the receipt list says records available to this account rather than claiming every row belongs to one household.

## Verification

Frontend/shared TypeScript and targeted whitespace checks passed. The earlier separate-card layout was inspected in an isolated synthetic fixture at 320px, 390px and 1440px with external requests blocked. Those captures precede the final inset-panel correction; this last correction received code checks only. No live connections or submissions were run. The owner should check the connected page and both themes, inner/bottom navigation, property search/link request/details/back navigation, receipt date filters and pagination, and empty/error states. Compare homeowner and restricted account views. Confirm no fake balance, deposit, amount due or payment confirmation appears.
