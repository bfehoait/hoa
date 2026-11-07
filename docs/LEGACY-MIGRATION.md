# Remaining legacy records

The user authorized assessment and preparation of the remaining legacy information on 6 November 2026. No agent connection to the reference backend, source-code reuse, publication or live migration was performed.

## Workbook already connected

The operator confirmed 921 lots, 4,314 receipts and 566,005,850 centavos. Every receipt stores the canonical lot UUID resolved from its physical ID by the importer. Offline revalidation found receipts for 637 lots and no supplied receipts for 284 lots. The example lot `1-01-010` has no receipts in the assessed workbook; this is not an unpaid determination. A later operator screenshot confirms another lot's connected receipts and monthly totals.

Recorded homeowner names, admin references and all 42 source fields are available under existing property evidence permissions. ORs, dates, amounts, account series, payers and provenance are retained. Account ownership and historical receipt entitlements require separate approval.

Local navigation now links receipt rows to the canonical lot's Receipts section and collection lot totals to a filtered lookup. Profiles show source transaction counts to property viewers and distinguish a source-zero empty state for finance staff. No repeat import or new migration is needed.

## Next operator action

**Current decision (6 November 2026):** when asked whether the saved bookings, complaints, requests, passes and dues were real operational data or demos, the user answered "test records". Exclude those test records from production workflow migration. Do not delete them from the source, infer real balances from them, or create account/lot relationships from them. No additional assessment SQL or import is required for those sections. The remaining assessment instructions below are historical/reusable tooling, not a request to rerun them. Announcements, budget, ledger and other material not explicitly classified by that answer remain unverified and are not approved real records by implication.

The operator ran `scripts/assess-legacy-data.sql` and supplied its full aggregate result on 6 November 2026. It confirms 921 active lots, 4,314 active receipts, 566,005,850 centavos, 637 lots with receipts, 284 without, zero receipts without an active lot and zero source count mismatches. No live query was performed by the agent.

The operator ran the first lot-link assessment: all 925 unit records lacked a recognized candidate under its strict numeric rules, with no duplicate unit-reference groups. Across the nine operational sections, 30 of 62 records matched one legacy unit label but had no recognized canonical lot; 32 had no matching label or physical ID. The two pass lists have no matching nonempty IDs. This does not prove physical information is absent or that the pass lists have no semantic duplicates. It supersedes earlier assumptions about crosswalk readiness; actual formats are still unverified.

The operator supplied the updated `assessment_version: 2` result: 921 unit records each have one canonical lot candidate; four have no candidate; zero conflicting or unmatched candidate IDs and zero duplicate unit-reference groups were reported. This counts individually matched records, not a proof of a globally one-to-one crosswalk. Among 62 operational records, one dues record has a unique legacy-unit lot candidate, 29 match a unit without a usable physical identifier and 32 have no matching unit/lot. No links or imports were created. Since the operational records were subsequently identified as test data, do not promote even the one dues candidate into real finance records.

The first read-only query remains available for repeat structural assessment. It returns active registry counts, exact centavos, receipt-link discrepancies, legacy storage types/counts, duplicate nonempty IDs, malformed items, allowlisted field names/types and snapshot digests.

It returns no source names, emails, descriptions, attachment values or arbitrary object keys. Nested ledger entries are not assessed individually; objects are counted as one object. Digests detect changes, not authenticity.

The supplied aggregate result confirms: units 925; household 1; announcements 6; bookings 9; complaints 4; concerns 3; requests 6; tickets 1; gatePasses 5; passes 5; incidents 0; budget 5; dues 28; expenses, collectionsHistory and lotPayments 0. Ledger is an object. All reported array items are objects and no duplicate nonempty IDs were found within sections; this does not establish that every item has an ID or that sections do not overlap. Bookings have nine dates/facilities/statuses/unit strings, but only five numeric start values and five numeric end values. Dues have 28 amount/status/unit values, with 20 null paidAt values and eight objects requiring date interpretation. Budget/ledger fields remain insufficiently assessed by the initial allowlist.

## Mapping before import

Reuse the 921 canonical lots. Earlier operator assessment found all their physical IDs among the 925 legacy units, with four unidentified units. Preserve unmatched records for review. Match operations by explicit physical ID or a reviewed legacy-unit crosswalk; generic lot numbers repeat across blocks/phases. Names and payer labels do not establish ownership.

Review announcements for notices, bookings for reservations, complaints/concerns/requests/tickets for a request taxonomy, passes for security, and household for verified relationships. Similar section names do not prove duplicates. Preserve source IDs, sections, timestamps and snapshot references; do not fabricate authors, approvals or audit events.

Keep the 28 legacy dues separate from receipts: earlier assessment found missing/ambiguous unit links and no verified receipt allocations. Source Paid labels are not new confirmed payments. Budget is not expense evidence. Bank reconciliation remains unavailable without bank records.

Do not prepare an operational import for the excluded test data. Future real operational imports require verified records, private field review, identity/lot mapping and approved workflow semantics. Coordinate legacy `portal_data` policy hardening before exposing additional private sections; registry checks do not secure those old endpoints. This assessment did not complete a production migration of the legacy operational modules.
