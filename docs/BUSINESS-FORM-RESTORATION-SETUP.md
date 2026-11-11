# Business form restoration setup

11 November 2026. Local frontend implementation and prepared database updates. The owner applies SQL and verifies the browser; no live database or hosting changes have been performed by the agent.

The previous production forms are business requirements. This release restores the forms below; it does not claim complete parity with every old business service. See the remaining-work section of [the coverage assessment](LEGACY-FORM-COVERAGE-ASSESSMENT.md).

## Apply in order

After installed migration **047**, run each complete file **once**, in numeric order. These are transactional updates; an error must be investigated before continuing. Most contain `CREATE TABLE/FUNCTION` and are not general-purpose rerunnable scripts. Do not run a schema export as a migration.

| Update | Forms and connected outcome | Where to find it |
| --- | --- | --- |
| 048 `helpdesk_business_forms` | Category-specific answers; Office assignee, priority and resolution; resolution required before closing | Customer Helpdesk / Office Helpdesk → request |
| 049 `business_submission_questions` | Additive optional questions for listings, workshops, booths, guard roster, transport, reports and candidate preparation | Respective existing submission forms |
| 050 `activity_application_questions` | Vendor name, business, products and phone saved in the existing capacity-controlled application workflow | Livelihood → Booth events → applications; Office application desk |
| 051 `household_roster` | Named occupants, type, relationship, phone and current/ended state | Office People → member → Properties → Household occupants |
| 052 `office_settings_contacts` | Reviewed association details and hotline editing/publication/hiding | Overview → More Office tools → Association settings / Hotline management |
| 053 `property_business_details` | Reviewed area, street, HOA start, occupancy, remarks, statuses and linear-park attribute | Office Lot register → property → Overview |
| 054 `accounting_business_forms` | Dues configuration, invoice-generating billing runs, payment recording/allocation, expense categories, expenses and monthly expense reconciliation totals | Finance → Accounting records; Submitted records also appear in Review inbox |
| 055 `candidate_media` | Candidate-information photo and publication links using the private cover service | Candidate information submission and review |
| 056 `shuttle_journey_details` | Pickup instructions, assigned-driver note and arrival estimate | Actual shuttle request; assigned driver's active request |
| 057 `office_booking_creation` | Staff records a selected resident's Pending booking with source reference | Office Amenity bookings → New booking |
| 058 `carpool_offer_participation` | Prevents “Looking for a ride” posts from accepting seat applications | Community transport → Community rides / My offers & requests / My ride interests; Map demo stays separate |
| 059 `garage_sale_items` | Separate item submission, price/quantity/condition, publication, rejection, withdrawal and revision re-review | Garage sale submission → Items in this sale; Office Garage sale items; Review inbox |

Install through 059 before checking the whole restored interface. Earlier migrations 030 and 032 are required by the guarded candidate-media update. Migration 059 extends the known accounting inbox introduced by 054 and stops if that definition differs.

Then run [verify-business-form-readiness.sql](../scripts/verify-business-form-readiness.sql). It reports missing function metadata and selected additive changes without returning account or financial records. A clear result is a setup check, not a substitute for the browser checks below.

## Permissions and authority

- Existing capability checks and configured visibility/denial rules remain authoritative. Running these migrations does not grant a role, approval capability, account–lot link or receipt entitlement.
- Helpdesk handling requires an active Office admin with Requests view/status at association scope. Changing the handler additionally requires assignment authority.
- Household maintenance and property attributes require an active admin with Property view/manage at association scope. A named roster entry does not create a sign-in account or legal ownership.
- Settings require Operations association view/manage; hotline management requires Hotlines association view/manage, with active admin membership for saves. Customer contact reads retain the published-contact permission check.
- Accounting preparation requires Finance association view/create. Posting/rejection requires a **different account** with Finance association view/approve. Reversal additionally requires manage. The preparer cannot post or reverse their own entry. No new approval grants are seeded.
- Staff-created bookings require active admin membership, Calendar association view/create and People association view. The selected account must independently be an eligible active resident with its own booking permission. Creation is Pending, not approval.
- Individual item publication/rejection requires Livelihood association view/approve/publish. Residents can submit or withdraw their own items; editing a public item removes it from public view until another publication decision.
- Driver estimates require the assigned active driver. They do not extend the existing 60-minute request deadline or turn the demo map into live dispatch.
- Candidate photos restore preparation information. Eligibility, proxies, voting and certified tallies remain disabled pending supplied rules, as requested by the owner.

## Accounting boundaries

Installation creates schema and form metadata, not official rates, invoices, payments, expenses or balances. Staff must enter approved source values and submit drafts; the independent reviewer decides whether to post.

Posted billing runs create invoices only for active imported properties in the selected scope. Per-area billing requires a reviewed area from 053. A due day beyond the last day of a month is clamped to that month's final day. Late-fee percentage is recorded for review but **no automatic late charge is generated**.

Payment allocation is explicit to a property and invoice month. Over-allocation and duplicate posted/imported references are refused. An unallocated payment does not settle an invoice. Reverse allocated payments before reversing their billing run. Monthly reported expense totals remain reconciliation records and are not added again to itemized expenses.

This ledger does not infer balances from imported receipt gaps, post old receipt history again, claim bank clearance, execute payments or automatically expose new ledger balances in resident accounts. Those integrations remain separate work.

## Owner browser verification

Use explicitly designated test accounts and approved test data. No real financial postings are necessary merely to verify navigation and form availability.

1. Open an actual resident Helpdesk submission with category answers; confirm Office sees them. Assign an eligible handler and set priority. Record a resolution, then close. Check stale-version and missing-resolution refusals.
2. Open a verified member's Properties tab. Add/edit/end an occupant. Check that unrelated residents cannot read the roster and that no sign-in account or property entitlement is created.
3. Review association/contact values before saving them. Check the customer hotline display after publication/hiding, including the fallback when managed contacts cannot be loaded. Existing static contacts are not silently imported into the editor.
4. Inspect new listing and vendor questions, submit once, retry unchanged after a simulated connection interruption, then verify retained answers and Office review. Confirm applications consume places only through the established confirmation service.
5. With separate preparer/reviewer test accounts, prepare an accounting draft, submit and inspect Review inbox. Verify self-posting is refused, amounts/references are correct, invoice output is available and reversal preserves history. Keep any live financial posting under the association's approved procedures.
6. Create a staff booking for an eligible resident. Confirm Pending appears in the Office calendar/list and resident records. Attempt a conflicting interval; it must fail. Approval remains a separate decision.
7. Submit a shuttle request with pickup instructions. The assigned driver may record an estimate only within the current deadline. Unassigned drivers and residents must not change that estimate.
8. Inspect connected carpool offers/requests separately from Map demo. A ride-seeking post must not appear as a seat-offering activity. This does not certify driver vetting or real-time route matching.
9. Submit a garage-sale item and review it in Office. Publish the parent sale, then publish the item. Another resident sees only the public item. Change the item and verify it disappears from their public view until re-reviewed; private review references stay private.
10. Check candidate photo upload through real Storage in the owner's browser. Local checks do not verify the deployed Storage API, bucket configuration or live session handling.

Check mobile keyboard/scroll behavior, long labels, cancel/back navigation and sticky actions on actual iOS/Android browsers and desktop. Those visual checks have not been performed by the agent in this pass.

## Checks actually performed locally

- TypeScript checking and a production build are recorded in the completion report, with their actual result.
- An isolated in-memory PostgreSQL-compatible check compiles 048–059 against a synthetic project baseline and runs selected real RPC paths: Helpdesk handling, occupants/settings/property attributes, independent accounting posting/reversal, vendor answers, private cover identity, booking conflicts, shuttle note retries/driver estimates and per-item re-review.
- Explicit refusal checks cover self-posting, resident finance access, resident item self-publication, late arrival estimates, duplicate booking intervals and direct authenticated reads of new private accounting/item tables.
- This is not a live Supabase deployment check, full policy-equivalence proof, browser test, automated test suite or complete concurrency audit. No Vitest, Playwright or axe suite was run.
