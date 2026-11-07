# Bellefort UX standard and measured baseline

Dated 7 November 2026, Asia/Manila. This is a maintainable acceptance standard and a bounded local assessment, not a production-readiness claim.

Read with root AGENTS.md, CLAUDE-HANDOFF.md, NEXT-WORK-PLAN.md, UX-IMPROVEMENTS.md and UI-UX-FIX-LIST.md. No source, schema, test or reference implementation was changed for this assessment. No commit, publication, live database connection, account provisioning or real resident operation was performed.

**Normative numbers in the definition half are proposed acceptance thresholds, not measurements or official HOA policy. Observed numbers in the assessment half come from the completed commands reproduced below.**

# Half one — the bar

## 1. Route/state matrix: the spine

A route is ready only when its visible information, available actions and authority are correct in each state below. Apply the contract to the primary content and independently to each asynchronous section. A successful surrounding shell does not make an unavailable section successful.

| Code | State | What the person sees | What they can do; observable acceptance |
| --- | --- | --- | --- |
| L | Loading | The destination title, persistent navigation and a named loading status. A bounded placeholder retains the layout. Checking identity or permissions is described as checking, not denial or an empty account. | Leave safely; cancel a cancellable operation. Creation/confirmation that requires missing data is disabled. Starting again cannot create a duplicate. Loading resolves to content or a recoverable error; it never silently becomes zero. Focus does not jump when content arrives. |
| E | Empty | A distinction between no records, no filter matches, no eligible facility, and a service not configured. Unknown data is not an empty result. | Create when authorized; clear filters when filtered; otherwise find the responsible office/setup route when allowed. An explanation names who can act when the person cannot. No dead primary action opens an unusable form. |
| R | Error | A plain explanation of what could not be loaded or confirmed. Previous confirmed data, if retained, is explicitly marked as older. No false empty state, paid status or success notice. | Retry the failed operation or use a safe alternative; keep input. After uncertain submission, check the existing record before retrying with the same operation identity. A retry does not silently discard changes or double-submit. Technical details, if useful, are secondary and contain no private data. |
| P | Partial | Working sections remain usable. The failed, delayed, missing or stale section is named at its own boundary. Totals disclose incomplete coverage. | Retry that section without resetting the working form, filters or selection. Actions dependent on unavailable information remain blocked; independent actions remain available. Booking availability failure cannot permit a reservation. |
| S | Success | The requested content or a specific operation result, its status and relevant time. Distinguish loaded, saved, submitted, approved, published and paid. These are not synonyms. | Take the next permitted step; reopen or refresh a saved record to confirm it. A submitted booking or listing can end successfully as Pending; it must not claim approval. An actual server response is needed for a server confirmation; a local save remains a sample. |
| D | Permission-denied | A concise restriction or expiry explanation without protected record contents, hidden household identities or internal policy details. Being signed out is distinguished from being signed in without permission. | Return to an allowed destination, retry identity/permissions when appropriate, sign out, or contact the appropriate office. Direct URLs do not bypass the restriction. No self-grant control, fake role switch or sample record is offered as a way around real denial. |

Every contract also inherits the accessibility, performance and content requirements below. State conformance alone does not constitute overall acceptance.

### Route profiles and overrides

The profile column in the inventory refines all six state contracts; it does not exempt any cell.

| Profile | Application of L / E / R / P / S / D |
| --- | --- |
| Resident | Household services, directories and hubs. E offers an authorized next step; S distinguishes published content from one's own pending work. P identifies missing sections and preserves independently useful content. D does not reveal another household. |
| Work | Office, board, gate and driver operations. L includes delegated permission checks. E is a genuinely empty authorized queue. R/P retain known queue status and disclose stale/incomplete totals. S records the actor/result through the applicable protected service. D offers allowed work only. A role label alone is not sufficient authority. |
| Financial | E means no recorded items, not no liability. R/P hide unverified totals or mark the unavailable period; they never display invented zeroes. S states source, period, currency and recorded status. External payment navigation is not receipt or reconciliation. D withholds financial details. |
| Detail | E means unavailable, withdrawn, unknown or no longer visible; do not infer which private record exists. R/P preserve safe navigation and distinguish attachment failure from whole-record failure. S shows only allowed fields. D contains no title/contact/address leaked from the unavailable record. |
| Access | Public access/recovery/exit surfaces. E means the initial unfilled form or no linked membership, with the appropriate explanation. L disables duplicate submission. R keeps safe inputs, never a password in logs. P names unavailable identity steps. S uses generic recovery wording. D covers invalid/expired recovery or inactive membership with an allowed recovery path. |
| Inspection | Account and role inspection wrappers. L identifies the inspection being opened. E never fabricates a target account. R/P keep a working Exit action. S labels read-only real-account inspection separately from synthetic role samples. D/expiry remove target content and leave safe recovery. The wrapper contract and the inner route contract both apply. |
| Oversight | Developer catalogues, diagnostics, modules and setup. E offers the actual permitted workspace/setup path, not fictional records. R/P name missing capabilities and sources. S separates monitoring from operational editing. D preserves authorized recovery without granting developer rights. |
| Missing | Catch-all or unrecognized suffix. E/S mean an explicit not-found explanation and safe destination, not a plausible but unrelated screen. L/R/P cover shell/identity recovery without claiming the missing page loaded. D protects the original private path and preserves a safe return. |

### Inventory and evidence notation

The matrix below serves both halves: its codes are requirements; its suffixes are the current evidence ledger.

- Each cell reads **state-code preview/authenticated**. U = unchecked; O = the state was exercised and the listed behavioral assertions passed; F = the exercised state missed a listed requirement.
- O is **observed behavior, not full acceptance**. It does not certify untested transitions, manual accessibility, all roles, data variants, themes or devices. No cell has full acceptance evidence in this assessment.
- Wildcard rows cover unlisted suffixes and fallback behavior. Named children have their own obligations; passing a parent never passes its children. Resolve a concrete URL against the most specific named row, then also test any wrapper/guard row it traverses.
- Parameter rows represent the data-dependent route family. IDs, query filters, monitoring-section choices, audience, lifecycle status and mixed roles are test variants, not new rows. Add a named row if a new screen is introduced.
- This is a source-derived **inventory of route obligations**, including aliases, named children and wildcard/parameter families. Its count is not the number of independent React Router declarations or distinct possible URLs.
- C1 enumerates absolute app path literals, module metadata and the explicitly identified parameter/computed families. Registered catch-all patterns ensure arbitrary URLs have a contract. Computed named children can require inventory refinement; the count must not be treated as a completeness certificate.

| Route obligation | Profile | Loading | Empty | Error | Partial | Success | Permission-denied |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `*` | Missing | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/account` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/account/*` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/account/lots` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/account/lots/:id` | Detail | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/account/payments` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/account/statement` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/admin` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/admin/*` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board/*` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board/documents` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board/elections` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board/reports` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board/shuttle` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/board/updates` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/community` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/community/*` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/community/:id` | Detail | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/coverage` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/*` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/access` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/account-preview/:session/*` | Inspection | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/activity` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/components` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/connections` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/members` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/:module` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/access` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/audit` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/calendar` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/community` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/documents` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/elections` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/finance` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/hotlines` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/livelihood` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/messages` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/operations` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/people` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/property` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/security` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/modules/transport` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/preview/:role/*` | Inspection | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/roles` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/runbook` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/scenarios` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/developer/source` | Oversight | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/directory` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/directory/governance` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/directory/learning` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/directory/market` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/directory/transport` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/driver` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/driver/*` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/driver/dispatch` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/:module` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/access-proposals` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/billing-proposals` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/board-records` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/booth-applications` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/booth-events` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/budgets` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/businesses` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/buy-sell` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/calculator` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/carpool-interests` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/carpools` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/complaints` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/concerns` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/election-candidates` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/election-setup` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/events` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/expense-evidence` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/facility-rules` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/garage-sales` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/gate-passes` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/guard-roster` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/household-changes` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/imports` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/jobs` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/messages` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/participation` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/payment-evidence` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/publishing` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/ride-requests` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/stations` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/tickets` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/unit-register` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/walk-ins` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/explore/workshops` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/*` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/documents` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/elections` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/help` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/lots` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/lots/*` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/lots/:id` | Detail | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/marketplace` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/notifications` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/permits` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/profile` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/settings` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/training` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/transport` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/more/vehicles` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/*` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/access` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/announcements` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/bookings` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/calendar` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/community` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/documents` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/finance` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/finance/collections` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/finance/expenses` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/finance/reconciliation` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/finance/reports` | Financial | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/history` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/inbox` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/lots` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/lots/*` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/lots/:id` | Detail | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/operations` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/permits` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/registrations` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/registry` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/requests` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/O |
| `/office/residents` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/review` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/settings` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/vehicles` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/office/visitors` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/recover` | Access | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/register` | Access | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/reset-password` | Access | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/security` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/security/*` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/security/gate` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/security/incidents` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/security/vehicles` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/security/visitors` | Work | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/services` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/services/*` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/services/bookings` | Resident | L U/U | E U/U | R U/U | P U/F | S U/U | D U/U |
| `/services/calendar` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/services/inbox` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/services/requests` | Resident | L U/O | E O/O | R O/O | P U/U | S O/O | D U/U |
| `/services/visitors` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/sign-in` | Access | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/sign-out` | Access | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |
| `/workspaces` | Resident | L U/U | E U/U | R U/U | P U/U | S U/U | D U/U |

## 2. Role journeys

These are task definitions for the six operational roles, not new grants or declarations of official committee policy. Developer oversight is covered by the route matrix and inspection contract; it is not substituted for a resident role.

For each journey, recruit a first-time person holding the intended role and only the relevant delegated capabilities. Give the task, not instructions. A pass requires completion without opening help or an unrelated screen, without facilitator coaching, and with the observable result below. Normal navigation from the entry point and an expressly labelled external handoff are allowed. Record mode, role/capabilities, starting state, input device, theme, elapsed time, detours and outcome. Do not turn an unavailable backend into a simulated official result to obtain a pass.

| ID | Role | Task / entry | Steps | Observable success criterion | Current human measurement |
| --- | --- | --- | --- | --- | --- |
| H1 | Homeowner | Raise an issue — /services/requests | New request → category → title/details → send → reopen own record. | First-time resident reaches a distinct Pending/Open record, sees the submitted text after refresh and understands that no office resolution was promised, without help. | Unchecked |
| H2 | Homeowner | Reserve a place — /services/bookings | Choose eligible facility → date → contiguous free time → purpose/attendees → request → view own status. | Person requests exactly the intended interval; an occupied interval cannot be selected/submitted; one Pending record reopens with the same interval. No other booker's identity is shown. | Unchecked |
| H3 | Homeowner | List a business — /directory/market | Choose business section → supply required details → optionally consent to a photo/links → send for review → view own submission. | Person produces one private review-pending listing and can explain why it is not yet public. Optional contact publication is not preselected or bundled into unrelated service access. | Unchecked |
| R1 | Renter | Ask the office for help — /services/requests | Create own concern → send → reopen → read an authorized reply. | Own request and reply are reachable without opening another household or owner-only financial record; delivery status distinguishes pending from confirmed. | Unchecked |
| R2 | Renter | Find an eligible facility — /services/bookings | Inspect renter eligibility → choose date/time → submit when eligible, or follow the explained alternative. | Person identifies an eligible place or correctly identifies why booking is unavailable; an ineligible reservation is never accepted. No invented renter policy. | Unchecked |
| R3 | Renter | Request a visitor pass — /services/visitors | Select an entitled residence → minimum visitor details → validity → send → inspect status. | One request reopens with the intended validity and Pending status. The person understands that the request alone is not entry authority. | Unchecked |
| A1 | Admin | Resolve an assigned support item — /office/requests | Filter authorized queue → open request → reply → permitted status transition → inspect history. | Correct request, reply, actor and resulting status are visible after refresh; an unrelated request or stale version is not modified. No household-side role bypass is needed. | Unchecked |
| A2 | Admin | Review a community listing — marketplace review workspace | Open pending submission → inspect optional media/links → review only public fields → choose permitted audience/expiry → publish or request correction. | Another eligible member sees only the explicitly published content after publication; a pending/rejected listing stays private. A reviewer without publish authority cannot publish. | Unchecked |
| A3 | Admin | Manage delegated access — /office/access | Identify member/group → inspect defaults → choose hidden/view/edit and scope → review/save → inspect resulting access. | Authorized manager changes only the intended rule; the target's next visit reflects it; manager cannot self-elevate or alter protected developer authority. An ordinary admin sees an explained restriction. | Unchecked |
| B1 | Board | Read an approved board document — /board/documents | Find document → inspect audience/date → open permitted detail/attachment. | Person finds the requested approved document and distinguishes a missing attachment from no document. Unpublished/private household material is absent. | Unchecked |
| B2 | Board | Read an association report — /board/reports | Select available period/report → inspect source and coverage → read summary. | Person states the correct period and whether totals are verified, incomplete or unavailable. Missing reporting integration is not represented as zero collections. | Unchecked |
| B3 | Board | Check governance/election information — /board/elections | Open current information → inspect eligibility/status/deadlines or readiness limits → follow a permitted next step. | Person identifies what is currently available and any prerequisite without help. No sample tally, unsupported vote or unapproved election rule becomes authoritative. | Unchecked |
| S1 | Security | Check a visitor — /security/visitors | Find approved pass → inspect validity/minimum gate details → perform permitted entry/exit transition. | Valid pass and recorded transition reopen correctly; expired/revoked/pending passes cannot authorize entry. Unrelated household finances and visitors are not exposed. | Unchecked |
| S2 | Security | Record a non-emergency incident — /security/incidents | Start permitted incident record → minimum facts → save → reopen. | Record is retrievable with actor/time and the correct authority label. A local sample is expressly not an official incident or emergency dispatch. | Unchecked |
| S3 | Security | Check a vehicle — /security/vehicles | Search permitted vehicle identifier → inspect current approved vehicle/access information. | Person distinguishes active, expired and unavailable information without reading unrelated resident records or treating absence as permission. | Unchecked |
| D1 | Driver | Accept a shuttle request — /driver/dispatch | Confirm authorized vehicle/duty → inspect available requests → accept. | Exactly one accepted request is assigned through the protected operation; another driver cannot also take it. Unavailable duty/vehicle has a visible reason. | Unchecked |
| D2 | Driver | Update pickup progress — /driver/dispatch | Open accepted trip → update permitted approach/arrival status → inspect response. | Intended trip changes once; corresponding resident sees the correct status. A network interruption preserves context and does not claim an unconfirmed update. | Unchecked |
| D3 | Driver | Complete and find a served trip — /driver | Open own active trip → complete → open service history → locate trip. | Trip leaves the active queue and appears once in the correct dated history, without unrelated passenger contacts or a fabricated completion time. | Unchecked |

## 3. Accessibility bar

Axe is the floor. A clean scan does not verify understandable labels, first-time completion, speech output, focus hidden under fixed UI, or reachability with a thumb. Check both modes, both themes and all role journeys, including denied and error variants.

| Line | Required manual check | Verification method and retained evidence | Current complete-line status |
| --- | --- | --- | --- |
| M01 | Complete every role journey using keyboard only. | A human uses Tab/Shift+Tab, Enter, Space and relevant arrow keys from entry through outcome; retain task log, focus stops and any blocked step. Mouse clicks or scripted locator filling do not qualify. | Unverified |
| M02 | Tab order matches visual and reading order at each responsive layout. | Compare recorded keyboard sequence with visual order in forms, cards, menus and modal action rows; check reverse tabbing. CSS visual reordering must not invert the intended sequence. | Unverified |
| M03 | Focus remains visible and predictable. | Human opens/closes dialogs, navigates, retries and submits; inspect focus against sticky headers/footers, sheets and the onscreen keyboard. No trap except an intentional modal; focus returns to a meaningful trigger. | Unverified |
| M04 | Accessible names are meaningful when spoken out of context. | NVDA with a desktop browser and VoiceOver with Safari on a real phone: navigate by headings, links, controls and landmarks; identify target/action without relying on icons or nearby visual text. Compare visible label and spoken name, including voice-control use. | Unverified |
| M05 | Validation can be understood and corrected nonvisually. | Submit missing/invalid fields; listen to the error and field association; correct the field without losing other input. Placeholders are not the only labels. | Unverified |
| M06 | Async state changes are announced usefully and without repetitive noise. | Listen to loading → result, partial failure, save uncertainty and retry outcomes. Confirm concise announcement scope; multiple status regions are not inherently invalid, but competing/repeated announcements must not obscure the result. | Unverified |
| M07 | Browser zoom and reflow preserve completion. | Human sets actual browser zoom to 200%, then checks a narrow 320-CSS-pixel layout separately; complete journeys without clipped controls or page-wide horizontal scroll. Data tables may scroll within a labelled region. CSS zoom/device scale is not evidence of browser zoom. | Unverified |
| M08 | One-handed phone use reaches and completes the task. | Use physical phone in either hand, portrait and landscape; try primary action, back/close, date selection and retry with keyboard open. Record unreachable targets, accidental activation and required grip changes. Desktop narrow viewport is insufficient. | Unverified |
| M09 | Text, boundaries, focus and state do not rely on low contrast or color alone. | Measure actual foreground/background pairs in both themes; ordinary text ≥4.5:1, large text ≥3:1, essential control boundaries/focus indicators ≥3:1. Inspect status/selection with grayscale and spoken labels. Record each tested pair and surface. | Unverified |
| M10 | Motion and safe areas do not block interaction. | Enable reduced motion and inspect animation removal; on physical phones test cutouts, bottom safe area, scrolling sheets and onscreen keyboard. No interaction requires a decorative drag handle to move. | Unverified |
| M11 | Targets and text support touch and low vision. | Combine computed-box/font audit with human inspection: controls ≥48×48 CSS px; body/input text ≥16px; secondary text ≥14px. Check spacing and wrapping with real fingers and enlarged text. Hidden/zero-sized elements are excluded explicitly, not mistaken for tested targets. | Unverified |
| M12 | Role and privacy boundaries are understandable with assistive technology. | For each role/permission combination, navigate directly to denied routes and inspect rendered/accessibility-tree content; explain restriction and recover. Separately verify server refusal in an authorized test environment. A hidden button or a preview selector is not enforcement. | Unverified |

Automated supporting methods: Axe tags wcag2a/wcag2aa/wcag21a/wcag21aa; DOM overflow/target checks; keyboard focus probes. These support lines, but do not mark an entire manual line verified.

## 4. Performance and resilience budgets

These are **normative test targets**, not measured current performance, traffic forecasts or newly approved HOA service guarantees.

Define application-ready time rather than relying on an unspecified “TTI” label: from navigation start until primary content is visible, required identity/permission checks have resolved, a permitted primary action can respond to a real input, and the UI remains responsive during a short observation window. A perpetual poll does not need to become network-idle. Measure loaded, empty and denied outcomes separately; a denied request is not a fast successful workflow.

| Budget | Target | Measurement method |
| --- | --- | --- |
| Initial application-ready time | Median ≤3 seconds; p95 ≤5 seconds over 20 cold runs. | Production build, documented mid-range physical Android device and iPhone comparison, browser/OS versions, cold cache, no service worker warm-cache shortcut, controlled network. Capture navigation timings, readiness markers, main-thread trace and actual action response. A local Vite dev navigation is not this metric. |
| Interactive response | Input feedback ≤100ms; list filter/page update ≤500ms at p95. | Record input event to visible acknowledgement/result across 20 interactions per fixture. Separate network waiting from frozen UI. Include active polling and open dialogs. |
| Paginated list rendering | Stable page displays within 500ms after response; no unbounded DOM growth across 20 page changes. | Synthetic stress fixtures with 10,000 requests, 1,000 properties, 100,000 receipts and 2,000 listings, including long text and mixed statuses. These are chosen stress targets, not measured production volumes. Exercise first/middle/final pages, filters and detail return. Record schema work, DOM count, long tasks and memory. Verify backend pagination separately. |
| Slow connection | Application-ready p95 ≤8 seconds under 1.6Mbps download / 750Kbps upload / 150ms RTT, with visible progress. | Document throttle mechanism and trace; repeat cold and warm runs. Use a production build and physical device or explicitly labelled lab proxy. Include image/media transfer; do not count an immediate mock response as a slow network test. |
| Intermittent connection | No loss of unsent text, no duplicate confirmed operation, no false confirmation; recovery does not reset working sections. | Interrupt reads, uploads and mutations before send, during request and after possible commit; restore connection and inspect record identity/result. Exercise expiry/revocation during retry. UI mocks can verify local behavior only; server idempotency needs an authorized backend test. |
| Offline state | Offline is visible; previously available content is labelled cached/older; unavailable operations stay unconfirmed. | Load shell then disconnect, cold-launch offline, retry after reconnect, and distinguish offline from denied/missing setup. Inspect service-worker/version behavior and draft storage. Never queue an invisible official action. |
| Media impact | One accepted cover ≤1MiB; non-media list-response body target ≤100KiB per page. | Measure actual transfer/compressed bytes in production and decoded dimensions/memory on device. Rejected, failed or unavailable media leaves readable listing content and retry guidance. A serialized fixture byte count is only an uncompressed payload proxy. |

Record device, build, mode, theme, route/state, cache, dataset sizes, pagination, sample count, network profile and method with every result. Do not use a single fast local observation as a percentile or a phone budget pass.

## 5. Content and voice

Write to “you” and “your”; use familiar nouns and one action per instruction. Explain consequence before mechanism. Place technical IDs, policy diagnostics and source details behind an appropriate disclosure; never print credentials or private resident payloads.

| Element | Standard | Example |
| --- | --- | --- |
| Primary button | Verb + object/outcome; distinguish request from approval. One visually dominant action per decision. | Send request; Request booking; Save contact details; Send listing for review. |
| Secondary/danger actions | Name the consequence; destructive confirmation names what changes and what remains. Never rely on “Are you sure?” or color alone. | Withdraw this booking request; Remove cover photo. State that published content is hidden pending review when applicable. |
| Error | What failed, uncertainty if any, and the next safe step. Keep the draft. Do not expose raw exception/SQL/schema payloads as customer copy. | We couldn't confirm your request. Check My requests before retrying. Your draft is still here. |
| Empty | Explain which kind of absence this is and offer a permitted next step. | No matching requests. Change the status or category to see more. |
| Partial | Name the unavailable section while leaving confirmed information usable. | Available times couldn't be loaded. Your facility and date are still selected. Try again. |
| Confirmation | Match actual authority and status; announce once and keep a durable record/link. | Request received. Office review is pending. / Sample request saved in this tab. Nothing was sent to the office. |
| Dates/times | Unambiguous written date; identify Philippine time where scheduling matters; full timestamp available when showing “ago”. | 7 November 2026 · 2:30 PM, Philippine time (UTC+8). Native date inputs may use device presentation, with an unambiguous summary before confirmation. |
| Currency | Philippine pesos, consistent separators/precision; source/period visible; units explicit in exports. Unknown is “Unavailable”, not zero. | ₱1,234.50. A confirmed zero is ₱0.00. Currency examples are formatting examples, not measured dues or rates. |
| Access/recovery | Say which next step is possible without revealing account existence or private rules. | If an account can receive a recovery email, instructions will be sent. |
| External destination | Name destination, reason and new-tab behavior. Never imply an external payment link updated local payment status. | Continue to payment provider · opens a new tab. |
| Sensitive information | Request minimum fields for the chosen purpose; private detail is never automatically public copy. | Optional business contact link, with a separate publication choice. |

### Required synthetic and inspection labelling

The guarantee is mandatory; repetition is adjustable.

- Local synthetic mode: one persistent, readable route-level banner, **“Local preview · Sample data — not an HOA confirmation.”** Put it before task content, in normal layout flow or with a measured offset so it cannot cover navigation. It must remain discoverable on narrow screens and in both themes.
- Authenticated mode can still contain sample-only modules: label the affected section **“Sample workspace data — not an official record.”** A successful login does not change a sample module into a real service.
- Keep per-item labelling on receipts/statements, approval/payment status, election figures and any artifact that could be separated from its page. Print/export carries the label inside the artifact, not only in the app shell.
- A local save says **“Saved in this tab. Nothing was sent to the office.”** It cannot say approved, paid or server-confirmed.
- Synthetic role inspection says **“Sample role preview”** and states its isolation. A browser role selector is not authentication or server authorization.
- Real-account read-only inspection says **“Viewing another account · Read-only”**, with target/expiry and an always reachable Exit. Do not falsely label real account records synthetic. The actual logged-in actor remains responsible for the inspection.
- A mocked authenticated measurement is labelled synthetic in its fixture/evidence. Its use of the authenticated rendering branch does not prove a real login, backend policy, storage delivery or live data operation.
- Do not repeat a long disclaimer in every ordinary list row when the route label remains visible. Preserve item-level labels when an item can independently look authoritative.

# Half two — current measurement against the bar

## 6. Scope, evidence and limits

This assessment uses local Windows Chromium with synthetic data only. C3 exercises **preview** and **authenticated rendering with mocked API responses**. It does not use a developer role preview as a substitute for the authenticated branch.

The supplied mode warning is reproduced by C2: **71 matching TSX lines in 30 files** contain auth.preview. C1's AST count also includes non-TSX source and is intentionally a different counting scope. Mode-specific results must not be pooled into an authenticated-app verdict.

C1 produced **158 route-obligation entries**, **948 cells per mode**, **1,896 mode-specific cells**. The matrix contains a requirement code for each. Its finite inventory includes aliases and wildcard families, not a claim to enumerate every possible record URL.

| Evidence measure | Result | Command / interpretation |
| --- | --- | --- |
| Cells with direct state evidence | 9 of 1,896 | C3; distinct route × state × mode, not screenshot count. |
| State observations with listed behavioral assertions met | 8 | C3's pass means its listed subchecks only; shown as O in the matrix. |
| Observed state criterion missing | 1 | C3; booking partial failure has no explicit failed-section retry control. Shown as F. |
| Unchecked cells | 1,887 | C8; every other mode-specific cell remains U. |
| Fully accepted cells across all requirements | 0 | No cell has complete manual, performance and variant evidence. An O is not full acceptance. |
| Preview state evidence | 3 | Requests success, filtered empty, corrupt-store error. Other preview states unchecked. |
| Authenticated state evidence | 6 | Requests loading/success/empty/error; homeowner denied Office requests; booking partial failure. Other authenticated states unchecked. |
| Role journeys defined / human pass / human failure / unchecked | 18 / 0 / 0 / 18 | C8 counts the journey ledger. No first-time participants or complete human task sessions were available. Unchecked is not failure or success. |
| Complete manual accessibility lines verified / unverified | 0 / 12 | C8; supporting automation below does not complete a manual line. |

The nine state observations were taken at a 390×900 desktop-browser viewport in light theme. Primary accessibility/keyboard probes add 1440×900 and dark-theme coverage for the populated request screen, not every state. Theme was set through localStorage and checked against document.documentElement.dataset.theme; no prefers-color-scheme emulation was used.

### What the checked cells establish

- Authenticated requests: named loading indicator and disabled creation while held; a loaded synthetic row with creation enabled; explicit empty explanation and creation action; HTTP failure alert with refresh and no false row.
- Authenticated Office requests: homeowner sees the restricted workspace explanation and safe return. This is a UI gate check, not a server refusal test.
- Authenticated bookings: a loaded facility/date remains selected when availability fails; confirmation is disabled; **explicit availability retry controls found: 0**.
- Preview requests: populated samples, an empty category filter with an available next action, and corrupt local sample storage producing an error/refresh path.
- The additional interrupted-submit probe C6 held then aborted one mocked operation: duplicate submission disabled while pending, draft retained, dialog retained and retry re-enabled. This strengthens the existing authenticated error observation; it does not fill an extra matrix cell or prove server idempotency.

### Accessibility evidence

| Supporting check | Preview | Authenticated mocked branch | Scope / limits |
| --- | --- | --- | --- |
| Primary Axe scan grid | 4 scans; 0 clean | 4 scans; 0 clean | C3: /services/requests, populated state; widths 390/1440 × dataset.theme light/dark. |
| Axe result | label-content-name-mismatch in each scan | Same rule in each scan | Rule findings, not eight distinct issue categories. Needs manual adjudication of visible label versus accessible name. No AA-conformance claim. |
| Supporting modal keyboard probe | 4 of 4 passed | 4 of 4 passed | C3: focus initially inside, remains inside after 12 Tabs, Escape closes, focus returns to trigger. Does not complete a role journey or establish spoken announcements. |
| Page-wide overflow probe | 0 of 4 configurations | 0 of 4 configurations | C3 populated request screen only; no browser zoom or physical device. |
| Rendered control box probe below 48px in either dimension | 0 in each configuration | 0 in each configuration | C3 examines positive-sized a/button/input/select/textarea/summary boxes. Not a text-size or physical-thumb assessment. |

C4 is one additional diagnostic Axe execution at preview/light/390: it reports five request-row button nodes under that same rule. Therefore **nine Axe executions ran across C3 and C4**, while the primary comparison grid remains eight. No other route's Axe, screen-reader or manual results are inferred.

### Performance and resilience evidence

C5 generated **10,000 actual synthetic request objects** in the test process, served paginated slices through a mocked API, and completed:

| Observation | Result |
| --- | --- |
| Mode / theme / viewport | Authenticated mocked branch / light / 390×900 desktop Chromium |
| Generated request objects | 10,000 |
| First-page rendered request buttons | 20 |
| Second-page rendered request buttons | 20 |
| Serialized first-page JSON body | 7,072 bytes, uncompressed fixture body |
| Local Vite navigation → first visible request | 1,080ms, one diagnostic observation |
| Next page click → next first record | 105ms, one diagnostic observation |
| Mock list requests during the probe | 2 |

This verifies bounded pagination for those pages. It does **not** measure rendering all records, first/middle/final pages, sustained memory, backend search/count queries, compressed transfer, real-media impact, device CPU, a percentile or the application-ready budget. The fixture size is a chosen stress target, not a claim about production volume.

C6's one held/aborted submission retained input and offered retry without a false confirmation. Actual offline launch, slow-network timing, intermittent upload recovery, post-commit uncertainty and backend idempotency remain **unmeasured**.

| Budget | Current result | Needed to measure |
| --- | --- | --- |
| Physical mid-range phone application-ready median/p95 | Unmeasured | Authorized production-build test environment, documented physical device, network profile, cold-cache samples and readiness trace. |
| Physical phone input/filter responsiveness | Unmeasured | Real interaction timing over the specified sample set; include screen-reader/keyboard overhead separately. |
| Complete realistic-list budget | Unmeasured | Extend the generated-dataset test to the specified domains/pages, filters, long text, memory and response-to-render instrumentation; authorized isolated backend for query costs. |
| Slow-network budget | Unmeasured | Production build plus recorded throttle/trace and actual media. Immediate local mocks are insufficient. |
| Full intermittent/offline behavior | Unmeasured | Timed disconnect/reconnect around reads, uploads and uncertain commits; test PWA cold launch and server operation identity. |
| Real media transfer/memory | Unmeasured | Allowed synthetic media served through an isolated storage test setup; measure transfer and device decoding. |
| Entire content/voice guide | Unmeasured | Route/state copy audit and comprehension sessions in both modes. Present code/style conventions do not establish consistent wording. |

## 7. Unfixed findings and acceptance blockers

No remediation was performed.

- **Partial booking recovery:** C3 reaches a facility-availability error with the selection retained and confirmation blocked, but no explicit retry control inside the booking dialog. This misses P's failed-section recovery requirement. The existing polling behavior is not a discoverable manual retry.
- **Accessible-name findings:** C3/C4 flag request-row buttons for label-content-name-mismatch. A manual label-in-name/voice-control review is required before declaring these either a confirmed accessibility violation or a false positive. Do not rewrite a spec merely to hide the finding.
- **Assurance gap:** human role journeys, complete manual accessibility and physical-device budgets remain unverified. No live privacy/security incident or urgent production defect was established by this local assessment.

The 14 stale Playwright failures documented in UI-UX-FIX-LIST.md are not classified as new regressions here. Prior review runs were closed before this task's baseline and were not used to fill this matrix. This task did not rewrite those specs or count their partial logs as measurements.

## 8. Reproduction commands

Run from the project root in PowerShell using Node/npm already installed. Do not edit source during probes. All browser helpers are project-owned synthetic fixtures; no reference source is imported or executed. The probes print counts/rule IDs and synthetic-only diagnostic labels, never session tokens, passwords or real resident data.

The document records observed results, not deterministic wall-clock timing expectations. Rerunning a timing probe can produce a different duration.

### C1 — inventory and route-obligation count

~~~powershell
@'
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const roots=/^\/(?:account|community|services|more|admin|office|developer|explore|directory|coverage|security|driver|board|sign-in|sign-out|register|recover|reset-password|workspaces)(?:\/|$)/;
const routes=new Set(['/','*','/community/:id','/account/lots/:id','/more/lots/:id','/office/lots/:id','/developer/preview/:role/*','/developer/account-preview/:session/*']);
let branchSites=0;const branchFiles=new Set();let sourceFiles=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(tsx|ts)$/.test(f)&&!/\.(test|spec)\./.test(f)){sourceFiles++;const text=fs.readFileSync(f,'utf8');const sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){let v=n.text.split(/[?#]/)[0];if(v==='/'||roots.test(v)){v=v.replace(/\/+$/,'')||'/';routes.add(v);}}if(ts.isPropertyAccessExpression(n)&&n.expression.getText(sf)==='auth'&&n.name.text==='preview'){branchSites++;branchFiles.add(f.replaceAll('\\','/'));}ts.forEachChild(n,visit);}visit(sf);}}}
walk('apps/web/src');walk('packages/shared/src');
for(const area of ['vehicles','permits','documents','elections','marketplace','training'])routes.add('/more/'+area);
for(const [file,prefix,name] of [['packages/shared/src/baseline.ts','/explore/','baselineModules'],['packages/shared/src/monitoring.ts','/developer/modules/','monitorModules']]){
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)===name&&n.initializer){let arr=n.initializer;while(ts.isAsExpression(arr)||ts.isSatisfiesExpression(arr))arr=arr.expression;if(!ts.isArrayLiteralExpression(arr))return;for(const obj of arr.elements){if(ts.isCallExpression(obj)&&obj.arguments[0]&&ts.isStringLiteral(obj.arguments[0])){routes.add(prefix+obj.arguments[0].text);continue;}if(!ts.isObjectLiteralExpression(obj))continue;const prop=obj.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(sf)==='id');if(prop&&ts.isStringLiteral(prop.initializer))routes.add(prefix+prop.initializer.text);}}ts.forEachChild(n,find);}find(sf);
}
for(const p of ['/developer/scenarios','/developer/components','/developer/runbook','/developer/modules/:module'])routes.add(p);
routes.delete('/community/water');
const sorted=[...routes].sort();console.log(JSON.stringify({routes:sorted,routeCount:sorted.length,cellsPerMode:sorted.length*6,modeCells:sorted.length*6*2,branchSites,branchFiles:branchFiles.size,sourceFiles}));
'@ | node
~~~

### C2 — branch split and isolated servers

Completed branch-count command:

~~~powershell
$branchMatches = rg -n 'auth\.preview' apps/web/src -g '*.tsx'
[pscustomobject]@{
  matchingLines = $branchMatches.Count
  files = ($branchMatches | ForEach-Object { ($_ -split ':')[0] } | Sort-Object -Unique).Count
}
~~~

Run the following in separate terminals and keep them running only for C3–C6. Explicit empty/synthetic environment settings prevent a local environment file from selecting a live backend.

Preview terminal:

~~~powershell
$env:VITE_APP_MODE='preview'
$env:VITE_SUPABASE_URL=''
$env:VITE_SUPABASE_PUBLISHABLE_KEY=''
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5194 --strictPort
~~~

Authenticated-rendering terminal, mocked endpoints only:

~~~powershell
$env:VITE_APP_MODE='authenticated'
$env:VITE_SUPABASE_URL='https://bellefort-auth-test.invalid'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_testing_only'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5195 --strictPort
~~~

These long-lived servers are infrastructure, not completed measurement commands or readiness results. They were stopped after the completed probes. The owner's existing dev server was not stopped.

### C3 — completed primary state/accessibility/keyboard probe

The helper is extracted from the current project-owned auth.spec.ts AST and compiled in memory. It supplies synthetic membership/API behavior, not a real account. Browser contexts block service workers and outbound hosts other than localhost and the reserved synthetic API. No reports, screenshots, configs or scripts are written into the project.

~~~powershell
@'
(async()=>{
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.browsers');
const {chromium,expect}=require('@playwright/test');const AxeBuilder=require('@axe-core/playwright').default;
const source=fs.readFileSync('tests/e2e/auth.spec.ts','utf8');
const sf=ts.createSourceFile('auth.spec.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const names=new Set(['uid','baseMember','identityRead','readRpc']);
const selected=sf.statements.filter(n=>(ts.isFunctionDeclaration(n)&&['api','login'].includes(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(sf))))).map(n=>n.getText(sf)).join('\n');
const helper=ts.transpileModule(selected,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const {api,login}=new Function('expect',helper+';return {api,login};')(expect);
const out={cells:[],axe:[],keyboardProxies:[],scale:null};
const browser=await chromium.launch();
async function setup(mode,theme='light',width=390){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',baseURL:mode==='preview'?'http://127.0.0.1:5194':'http://127.0.0.1:5195'});
 await context.route('**/*',r=>{const h=new URL(r.request().url()).hostname;return ['127.0.0.1','localhost','bellefort-auth-test.invalid'].includes(h)?r.continue():r.abort();});
 await context.addInitScript(t=>localStorage.setItem('bellefort-theme',t),theme);
 const page=await context.newPage();
 if(mode==='authenticated'){await api(page,{accounts:true,liveRequests:true});await login(page);await expect(page).not.toHaveURL(/sign-in/);}
 return {context,page,base:mode==='preview'?'http://127.0.0.1:5194':'http://127.0.0.1:5195'};
}
function cell(mode,route,state,pass,checks){out.cells.push({mode,route,state,result:pass?'pass':'fail',checks});}
const {context:ac,page:ap,base:ab}=await setup('authenticated');
let phase='loading',release;let gate=new Promise(r=>release=r);
const owner='11111111-1111-4111-8111-111111111111';
function row(i){return {id:'50000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),owner_id:owner,title:'Synthetic load row '+(i+1),description:'Synthetic request text for isolated UX measurement.',category:'Maintenance',status:'Open',unit_snapshot:'Synthetic unit',version:1,created_at:'2026-11-07T00:00:00Z',updated_at:'2026-11-07T00:00:00Z'};}
await ap.route('**/rest/v1/bfe_requests*',async r=>{
 if(phase==='loading')await gate;
 if(phase==='error')return r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'SYNTHETIC_FAILURE',message:'Synthetic failure'})});
 const offset=Number(new URL(r.request().url()).searchParams.get('offset')||0);
 const total=phase==='empty'?0:phase==='scale'?10000:1;
 const rows=Array.from({length:phase==='scale'?20:total},(_,i)=>row(offset+i));
 return r.fulfill({contentType:'application/json',headers:{'content-range':total?offset+'-'+(offset+rows.length-1)+'/'+total:'*/0','access-control-expose-headers':'content-range'},body:JSON.stringify(rows)});
});
await ap.goto(ab+'/services/requests');
await expect(ap.getByRole('status',{name:'Loading your community'})).toBeVisible();
await expect(ap.getByRole('button',{name:'New request',exact:true})).toBeDisabled();
cell('authenticated','/services/requests','loading',true,'Named loading status; create disabled; screen heading retained');
phase='success';release();
await expect(ap.getByText('Synthetic load row 1',{exact:true})).toBeVisible();
await expect(ap.getByRole('button',{name:'New request',exact:true})).toBeEnabled();
cell('authenticated','/services/requests','success',true,'Loaded record and enabled next action; read success only');
phase='empty';await ap.reload();await expect(ap.getByRole('heading',{name:'A clear place to follow up',exact:true})).toBeVisible();
await expect(ap.getByRole('button',{name:'New request',exact:true})).toBeEnabled();
cell('authenticated','/services/requests','empty',true,'Explicit empty explanation and enabled creation action');
phase='error';await ap.reload();await expect(ap.getByRole('alert')).toBeVisible();await expect(ap.getByRole('button',{name:'Refresh',exact:true})).toBeEnabled();
await expect(ap.getByText('Synthetic load row 1',{exact:true})).toHaveCount(0);
cell('authenticated','/services/requests','error',true,'Failure alert, refresh available, no false empty record');
await ap.goto(ab+'/office/requests');await expect(ap.getByRole('heading',{name:'This workspace is restricted',exact:true})).toBeVisible();
await expect(ap.getByRole('link',{name:'Back to my account',exact:true})).toBeVisible();
cell('authenticated','/office/requests','permission-denied',true,'Homeowner refused staff route with safe return; UI only');
await ap.route('**/rest/v1/rpc/bfe_booking_dashboard',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({rows:[],total:0,can_manage:false,can_approve:false,facilities:[{id:'85000000-0000-4000-8000-000000000002',name:'Synthetic facility',opens:'08:00:00',closes:'18:00:00',slot_minutes:30,max_minutes:120,capacity:10,renters:true,active:true,policy_reference:'Synthetic measurement policy'}]})}));
await ap.route('**/rest/v1/rpc/bfe_booking_availability',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Synthetic availability failure'})}));
await ap.goto(ab+'/services/bookings');await ap.getByRole('button',{name:'New booking',exact:true}).click();
const bd=ap.getByRole('dialog');await bd.getByRole('combobox',{name:'Facility',exact:true}).selectOption('85000000-0000-4000-8000-000000000002');await bd.locator('input[type=date]').fill('2026-12-20');
await expect(bd.getByRole('alert')).toBeVisible();
await expect(bd.getByRole('button',{name:'Submit for approval',exact:true})).toBeDisabled();
const partialRetry=await bd.getByRole('button',{name:/retry|try again|refresh/i}).count();
cell('authenticated','/services/bookings','partial',partialRetry>0,'Facility/date retained and submit blocked; explicit failed-section retry count='+partialRetry);
phase='scale';const start=performance.now();await ap.goto(ab+'/services/requests');await expect(ap.getByText('Synthetic load row 1',{exact:true})).toBeVisible();
const firstMs=performance.now()-start;const rendered=await ap.getByRole('button',{name:/Synthetic load row /}).count();
await ap.getByRole('button',{name:'Next',exact:true}).click();await expect(ap.getByText('Synthetic load row 21',{exact:true})).toBeVisible();
out.scale={mode:'authenticated',fixtureTotal:10000,firstPageRendered:rendered,secondPageRendered:await ap.getByRole('button',{name:/Synthetic load row /}).count(),localDevNavigationToFirstRecordMs:Math.round(firstMs),backend:'mocked paginated response, not a database or full-list benchmark'};
await ac.close();
const {context:pc,page:pp,base:pb}=await setup('preview');
await pp.goto(pb+'/services/requests');await expect(pp.getByRole('button',{name:'New request',exact:true})).toBeEnabled();
await expect(pp.getByText('Sample streetlight repair',{exact:true})).toBeVisible();
cell('preview','/services/requests','success',true,'Sample record and sample data label; no backend operation');
await pp.getByRole('combobox',{name:'Category',exact:true}).selectOption('Idea');await expect(pp.getByRole('heading',{name:'No matching requests',exact:true})).toBeVisible();
await expect(pp.getByRole('button',{name:'New request',exact:true})).toBeEnabled();
cell('preview','/services/requests','empty',true,'Filtered empty result; category control allows reset; creation available');
await pp.evaluate(()=>sessionStorage.setItem('bellefort-request-samples-v1','broken'));await pp.reload();await expect(pp.getByRole('alert')).toBeVisible();await expect(pp.getByRole('button',{name:'Refresh',exact:true})).toBeEnabled();
cell('preview','/services/requests','error',true,'Corrupt sample store shows error and retry instead of false success');
await pc.close();
for(const mode of ['preview','authenticated'])for(const theme of ['light','dark'])for(const width of [390,1440]){
 const {context,page,base}=await setup(mode,theme,width);
 if(mode==='authenticated')await page.route('**/rest/v1/bfe_requests*',r=>r.fulfill({contentType:'application/json',headers:{'content-range':'0-0/1','access-control-expose-headers':'content-range'},body:JSON.stringify([row(0)])}));
 await page.goto(base+'/services/requests');await expect(page.getByRole('button',{name:'New request',exact:true})).toBeEnabled();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe(theme);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 const geom=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,smallTargets:[...document.querySelectorAll('a,button,input,select,textarea,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<48||r.height<48);}).length}));
 out.axe.push({mode,theme,width,violations:axe.violations.length,ruleIds:axe.violations.map(v=>v.id),...geom});
 const trigger=page.getByRole('button',{name:'New request',exact:true});await trigger.click();const d=page.getByRole('dialog');
 const initiallyInside=await d.locator(':focus').count()===1;
 for(let i=0;i<12;i++)await page.keyboard.press('Tab');
 const trapped=await d.locator(':focus').count()===1;
 await page.keyboard.press('Escape');
 const restored=await trigger.evaluate(e=>document.activeElement===e);
 out.keyboardProxies.push({mode,theme,width,pass:initiallyInside&&trapped&&restored});
 await context.close();
}
await browser.close();
out.summary={cellsChecked:out.cells.length,cellsPassed:out.cells.filter(x=>x.result==='pass').length,cellsFailed:out.cells.filter(x=>x.result==='fail').length,axeScans:out.axe.length,axeClean:out.axe.filter(x=>x.violations===0).length,keyboardProxies:out.keyboardProxies.length,keyboardProxiesPassed:out.keyboardProxies.filter(x=>x.pass).length};
console.log(JSON.stringify(out));
})().catch(e=>{console.error(e.message);process.exit(1);});
'@ | node
~~~

### C4 — completed accessible-name diagnostic

This supplemental scan explains the rule rather than treating eight repeated configurations as eight different defects.

~~~powershell
@'
(async()=>{
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.browsers');
const {chromium,expect}=require('@playwright/test');const AxeBuilder=require('@axe-core/playwright').default;
const source=fs.readFileSync('tests/e2e/auth.spec.ts','utf8');
const sf=ts.createSourceFile('auth.spec.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const names=new Set(['uid','baseMember','identityRead','readRpc']);
const selected=sf.statements.filter(n=>(ts.isFunctionDeclaration(n)&&['api','login'].includes(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(sf))))).map(n=>n.getText(sf)).join('\n');
const helper=ts.transpileModule(selected,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const {api,login}=new Function('expect',helper+';return {api,login};')(expect);

const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});await context.addInitScript(()=>localStorage.setItem('bellefort-theme','light'));await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const page=await context.newPage();await page.goto('http://127.0.0.1:5194/services/requests');await expect(page.getByRole('button',{name:'New request',exact:true})).toBeEnabled();const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();console.log(JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}))));await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
'@ | node
~~~

### C5 — completed generated-record pagination probe

The dedicated scale result in section 6 comes from this command, not C3's single-row/state fixture timing.

~~~powershell
@'
(async()=>{
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.browsers');
const {chromium,expect}=require('@playwright/test');const AxeBuilder=require('@axe-core/playwright').default;
const source=fs.readFileSync('tests/e2e/auth.spec.ts','utf8');
const sf=ts.createSourceFile('auth.spec.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const names=new Set(['uid','baseMember','identityRead','readRpc']);
const selected=sf.statements.filter(n=>(ts.isFunctionDeclaration(n)&&['api','login'].includes(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(sf))))).map(n=>n.getText(sf)).join('\n');
const helper=ts.transpileModule(selected,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const {api,login}=new Function('expect',helper+';return {api,login};')(expect);

async function setup(mode,theme='light',width=390){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',baseURL:mode==='preview'?'http://127.0.0.1:5194':'http://127.0.0.1:5195'});
 await context.route('**/*',r=>{const h=new URL(r.request().url()).hostname;return ['127.0.0.1','localhost','bellefort-auth-test.invalid'].includes(h)?r.continue():r.abort();});
 await context.addInitScript(t=>localStorage.setItem('bellefort-theme',t),theme);
 const page=await context.newPage();
 if(mode==='authenticated'){await api(page,{accounts:true,liveRequests:true});await login(page);await expect(page).not.toHaveURL(/sign-in/);}
 return {context,page,base:mode==='preview'?'http://127.0.0.1:5194':'http://127.0.0.1:5195'};
}

const browser=await chromium.launch();const owner='11111111-1111-4111-8111-111111111111';
function row(i){return {id:'50000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),owner_id:owner,title:'Synthetic load row '+(i+1),description:'Synthetic request text for isolated UX measurement.',category:'Maintenance',status:'Open',unit_snapshot:'Synthetic unit',version:1,created_at:'2026-11-07T00:00:00Z',updated_at:'2026-11-07T00:00:00Z'};}

const data=Array.from({length:10000},(_,i)=>row(i));
const {context,page,base}=await setup('authenticated','light',390);let requests=0;
await page.route('**/rest/v1/bfe_requests*',r=>{requests++;const offset=Number(new URL(r.request().url()).searchParams.get('offset')||0);return r.fulfill({contentType:'application/json',headers:{'content-range':offset+'-'+(offset+19)+'/'+data.length,'access-control-expose-headers':'content-range'},body:JSON.stringify(data.slice(offset,offset+20))});});
let t=performance.now();await page.goto(base+'/services/requests');await expect(page.getByText('Synthetic load row 1',{exact:true})).toBeVisible();const firstMs=Math.round(performance.now()-t);const firstRows=await page.getByRole('button',{name:/Synthetic load row /}).count();
t=performance.now();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Synthetic load row 21',{exact:true})).toBeVisible();
console.log(JSON.stringify({mode:'authenticated',theme:'light',width:390,generatedRecords:data.length,firstPageRows:firstRows,secondPageRows:await page.getByRole('button',{name:/Synthetic load row /}).count(),firstPageBytes:Buffer.byteLength(JSON.stringify(data.slice(0,20))),navigationToFirstRecordMs:firstMs,nextPageToRecordMs:Math.round(performance.now()-t),requestCount:requests,productionBenchmark:false}));await context.close();await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
'@ | node
~~~

### C6 — completed held/aborted submission probe

The operation is intercepted and aborted; it cannot create a live request. Synthetic form text and the operation are kept within the browser/test process.

~~~powershell
@'
(async()=>{
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.browsers');
const {chromium,expect}=require('@playwright/test');const AxeBuilder=require('@axe-core/playwright').default;
const source=fs.readFileSync('tests/e2e/auth.spec.ts','utf8');
const sf=ts.createSourceFile('auth.spec.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const names=new Set(['uid','baseMember','identityRead','readRpc']);
const selected=sf.statements.filter(n=>(ts.isFunctionDeclaration(n)&&['api','login'].includes(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(sf))))).map(n=>n.getText(sf)).join('\n');
const helper=ts.transpileModule(selected,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const {api,login}=new Function('expect',helper+';return {api,login};')(expect);

async function setup(mode,theme='light',width=390){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',baseURL:mode==='preview'?'http://127.0.0.1:5194':'http://127.0.0.1:5195'});
 await context.route('**/*',r=>{const h=new URL(r.request().url()).hostname;return ['127.0.0.1','localhost','bellefort-auth-test.invalid'].includes(h)?r.continue():r.abort();});
 await context.addInitScript(t=>localStorage.setItem('bellefort-theme',t),theme);
 const page=await context.newPage();
 if(mode==='authenticated'){await api(page,{accounts:true,liveRequests:true});await login(page);await expect(page).not.toHaveURL(/sign-in/);}
 return {context,page,base:mode==='preview'?'http://127.0.0.1:5194':'http://127.0.0.1:5195'};
}

const browser=await chromium.launch();const {context,page,base}=await setup('authenticated','light',390);
let release;const gate=new Promise(r=>release=r);let attempts=0;
await page.route('**/rest/v1/rpc/bfe_create_request',async r=>{attempts++;await gate;await r.abort('failed');});
await page.goto(base+'/services/requests');const trigger=page.getByRole('button',{name:'New request',exact:true});await expect(trigger).toBeEnabled();await trigger.click();const d=page.getByRole('dialog');
await d.getByLabel('Title',{exact:true}).fill('Synthetic interrupted submission');await d.getByLabel('Details',{exact:true}).fill('Synthetic details kept after an interrupted connection.');
const submit=d.getByRole('button',{name:'Submit request',exact:true});await submit.click();await expect(submit).toBeDisabled();release();await expect(d.getByRole('alert')).toBeVisible();await expect(submit).toBeEnabled();
const preserved=await d.getByLabel('Title',{exact:true}).inputValue()==='Synthetic interrupted submission'&&await d.getByLabel('Details',{exact:true}).inputValue()==='Synthetic details kept after an interrupted connection.';
console.log(JSON.stringify({mode:'authenticated',width:390,theme:'light',fault:'held then aborted mocked submission',attempts,duplicateSubmitDisabledWhilePending:true,draftPreserved:preserved,retryControlEnabled:true,dialogStillOpen:await d.count()===1,backendConfirmed:false}));await context.close();await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
'@ | node
~~~

### C7 — completed environment command

~~~powershell
@'
const fs=require('fs'),os=require('os');
const names=['@playwright/test','@axe-core/playwright','typescript','vite'];
const versions=Object.fromEntries(names.map(n=>[n,JSON.parse(fs.readFileSync('node_modules/'+n+'/package.json','utf8')).version]));
console.log(JSON.stringify({node:process.version,platform:os.platform(),versions}));
'@ | node
~~~

Observed: Node v22.14.0, win32; Playwright 1.64.1; Axe Playwright 4.14.0; TypeScript 5.9.3; Vite 7.3.7. Desktop Chromium was launched from the local .browsers installation; no physical phone, WebKit, screen reader, zoom or network throttle is implied.

### C8 — completed document ledger validation

This command counts the inventory/matrix, role ledger and manual-check ledger in this document. The counts are exact for these declared entries, not an estimate of actual feature quality.

~~~powershell
@'
const fs=require('fs');
const text=fs.readFileSync('docs/UX-STANDARD.md','utf8');
const lines=text.split(/\r?\n/);
const rows=lines.filter(l=>l.startsWith('| ')&&l.split('|')[1].trim().startsWith(String.fromCharCode(96))&&['/','*'].includes(l.split('|')[1].trim()[1]));
const marks=rows.flatMap(l=>l.split('|').slice(3,9).map(s=>s.match(/\b([UOF])\/([UOF])\b/)).filter(Boolean));
const observations=marks.flatMap(m=>[m[1],m[2]]);
const journeys=lines.filter(l=>/^\| [HRABSD][123] \|/.test(l));
const manual=lines.filter(l=>/^\| M\d\d \|/.test(l));
console.log(JSON.stringify({
 routes:rows.length,
 definedModeCells:observations.length,
 observed:observations.filter(x=>x!=='U').length,
 observedSubchecksMet:observations.filter(x=>x==='O').length,
 observedRequirementMissing:observations.filter(x=>x==='F').length,
 unchecked:observations.filter(x=>x==='U').length,
 journeys:journeys.length,
 journeysUnchecked:journeys.filter(l=>l.includes('Unchecked')).length,
 journeysPassed:journeys.filter(l=>l.includes('| Pass |')).length,
 manualLines:manual.length,
 manualUnverified:manual.filter(l=>l.includes('Unverified')).length
}));
'@ | node
~~~

Expected from this measured revision: routes 158; defined mode cells 1896; observed 9; observed subchecks met 8; observed requirement missing 1; unchecked 1887; journeys 18, all unchecked, none passed; manual lines 12, all unverified.

### C9 — file-scope verification method

A read-only SHA-256 snapshot was taken before writing this standard; the final comparison used the same traversal. Only this new file and the required UTF-8 append to docs/vault/Verification.md are permitted differences for this task. Previous-task artifacts were already present at baseline and are not part of this task's deliverable.

There is no Git checkout to supply a trustworthy git diff. The comparison covers project source, public files, scripts, schemas, documentation and configuration. It excludes dependency/build/test caches, raw reference/private-import directories and the private environment file. No output contains file contents or secret values. Generated tool caches are not source edits.

To reproduce the method, run this once with node - before before editing, then repeat with node - after after the documentation append. The baseline metadata file stays in the OS temporary directory, not in the project.

~~~powershell
@'
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const skip=new Set(['node_modules','reference','.private-imports','dist','.artifacts','.browsers','.npm-cache','test-results','playwright-report','.git']);
const current={};
function walk(p=''){
 for(const e of fs.readdirSync(p||'.',{withFileTypes:true})){
  const q=path.join(p,e.name);
  if(e.isDirectory()){if(!skip.has(e.name))walk(q);}
  else if(e.isFile()&&e.name!=='.env.local')
   current[q.replaceAll('\\','/')]=crypto.createHash('sha256').update(fs.readFileSync(q)).digest('hex');
 }
}
walk();
const baseline=path.join(os.tmpdir(),'bellefort-ux-standard-hashes.json');
if(process.argv[2]==='before')fs.writeFileSync(baseline,JSON.stringify(current));
else{
 const previous=JSON.parse(fs.readFileSync(baseline,'utf8'));
 const changed=[...new Set([...Object.keys(previous),...Object.keys(current)])].filter(p=>previous[p]!==current[p]).sort();
 console.log(JSON.stringify({changed,unexpected:changed.filter(p=>!['docs/UX-STANDARD.md','docs/vault/Verification.md'].includes(p))}));
}
'@ | node - before
~~~

The after comparison must have no unexpected changes. Do not delete or reset unrelated pre-existing work to force that result.

## 9. Maintaining the standard

For the next assessment, rerun C1/C2, update the route obligations when routing changes, then exercise states with controlled fixtures in each actual rendering mode. Add dated evidence with device/theme/role/state and full outcomes. Expand journey and accessibility evidence with humans rather than promoting locator automation to user testing. Use a production build and isolated authorized test services for performance and backend authority checks.

Retain unknowns explicitly. An unchanged stylesheet, a successful typecheck, a clean partial log, an owner-reported migration result or a previously passing sample screen cannot fill an unchecked cell.

**Least-confident single number: 158 route-obligation entries as a completeness denominator.** C1 reproduces that exact set, but its granularity combines aliases, named descendants and parameter/wildcard families. Computed child screens can deserve additional rows even when their parent wildcard already supplies a contract. It is a planning denominator, not “158 independently tested screens.” The observed state/probe counts are more directly grounded.

