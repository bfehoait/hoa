# Office design QA: second pass

10 November 2026. Compared the updated assessment with source and isolated synthetic browser checks. No deployment, live database connection or real approval action was performed.

## Confirmed changes

- **Finance:** Office receipts now use a labelled table. Pagination and the explicit record range sit above it. The existing twenty-row server pagination is preserved. Monthly collection cards now filter From/To to that calendar month, reset to page one and retain CSV/date controls. Clear dates restores the unfiltered period. Totals still describe receipt evidence, not verified payments or account balances. Customer receipt cards are unchanged.
- **Lot register:** moved Office pagination above the list, with a visible range and total page count. Customer pagination is unchanged. Both Finance and Lot register already paginated before this pass; the earlier assessment confused total matching counts with displayed rows.
- **Operations:** added an Area filter and grouped Workflow choices by staff capability area. Vehicle workflows are grouped under Security & vehicles, rather than inheriting the resident catalogue's Property label. Existing section/module deep links remain supported; association read/decision permissions stay server-owned. Read-only staff also see the correct Office review selection even when they cannot decide.
- **Announcements:** staff rows prioritize title, status, date, Unpublish and History. Full text, image preview and existing unpublished-image controls stay inside an expandable section. Resident announcement presentation is unchanged.
- **Overview:** the chart legend includes only states present in the displayed bars. Zero counts stay explicit in summary/text; no fake gray status segment is introduced.
- **Roles & permissions:** Office member lookup now offers Assigned role. Filtering includes primary and extra roles and uses a server query over the full matching set, with twenty-row pagination. Exact-email matching and ambiguous/unlinked-account exclusions remain consistent with migration 024. No bulk role mutation was added.

## Installation

Frontend layout changes need only the updated local app. The new role filter requires [migration 040](../supabase/migrations/202611100040_access_member_role_filter.sql), applied by the owner after 039. It adds an access-manager-only read function; no member role, assignment or permission rule is changed.

All roles continues to use the existing lookup RPC. If 040 is not installed, selecting a specific role gives setup guidance and can be cleared back to All roles. Do not rerun earlier migrations for these frontend changes.

## Verification

- TypeScript and production build passed; existing dependency annotation/large-chunk warnings remain.
- Four isolated PGlite tests passed for full-set primary/extra-role filtering beyond twenty rows, exact email combined with role, access-manager denial, invalid filters and duplicate/unlinked sign-in handling. Authorization was stubbed for the read-contract test; installed live permissions still require owner verification.
- Synthetic Chromium checked nine staff routes at 1024×768 and 1440×900 (18 renders). Checks included receipt and lot page changes, table headers, month-filter request parameters, clearing dates, existing unavailable reports, grouped workflow selection, collapsed announcement preview and Unpublish dialog dismissal, server-role-filter requests and an all-waiting chart legend.
- Three additional dark renders checked Finance, Operations and Announcements. No detected page overflow, undersized scanned controls, JavaScript page errors or unknown fixture RPCs. Main light-theme screenshots were visually reviewed; all artifacts are synthetic and ignored.

Approval/publication/export/entitlement write functions were not replaced. Account and customer layouts are excluded. The existing review guidance remains available because review, publication, payment clearance and service fulfillment are distinct decisions; no new historical statistics were invented.
