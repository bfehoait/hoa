# HOA.xlsx implementation and rollout

Updated 26 November 2026, Asia/Manila. Source: owner-supplied `HOA.xlsx`, To do's and Process flows columns. This is local implementation, not a report that production has been updated.

## What changed

| Workbook area | Implemented behavior |
| --- | --- |
| A2-A3: wording | Shared page/form headings use Title Case; affected neighbor/color wording uses American spelling. Stored data keys are preserved. |
| A4-A8, B2-B9: passes | Visitor and small-delivery requests go to Security. Gate passes need Office approval, then Security approval. Security can create a walk-in against a searched household. Approval requires confirmation of ID and, for vehicle arrivals, plate checks. Multi-day start/end dates remain supported; no new 24-hour limit. Existing approved passes stay approved. |
| A11-A30, B11-B15: amenities | Manual date input remains visible; time controls explain Philippine time and minimum durations. Court minimum is one hour; hall minimum is two hours. The arbitrary configured maximum is removed for recognized amenities, while opening hours, capacity and slot boundaries remain enforced. Sunday 10:30 AM-1 PM is blocked for all amenities. Existing court/pool Sunday closing hours still apply. Exclusive pool bookings block the whole morning/evening session when confirmed, even if a shorter time was selected. |
| Booking fee and checkout | Known guideline rates produce a visible **Total Booking Fee** and minimum reservation payment before submission. Hold Booking and Pay Now first save a pending booking with an SP/BC/FH reference. A pencil request lasts three days and does not guarantee capacity. Office verifies payment and enters the official receipt before approval. The payment is credited toward the total, not charged again as an extra reservation fee. |
| A31-A36, B18-B24: Helpdesk | Community and Maintenance Issue, Shuttle topics and damaged/leaning street signs added; Document request and Support/Community services removed from new-form choices. Historical requests remain readable. Maintenance goes to Maintenance, Complaint to Grievance, Concern/Idea to Board, and Support to Livelihood/IT. Team members can use Team Helpdesk without becoming admins. Category and capability checks are enforced on the server. Replies, handling changes and status changes notify the resident. An owner-scheduled job sends deduplicated reminders after three days without staff feedback. |
| A37-A40, B25-B31: vehicles/permits | Add Vehicle and Construction/Renovation Permit wording. Vehicle approval tells the owner to visit Office for sticker installation. Move requests need Office review, then Security approval before issuance. Issued permits have a printable download based on actual issuance data. |
| A41-A51, B33: carpool | Separate My Carpool Offers / My Carpool Requests and creation actions. Offers and requests retain automatic publication. Blue Offer / green Request indicators include text labels. End Carpool removes a published ride; existing departure-date expiry remains. Filtering is applied before pagination. Private submission fields are not copied into the public projection. |
| B34-B38: documents | Mandatory documents can be viewed; downloads require Office approval. Right to Inspect viewing and download require an approved, unexpired request. Existing approval/audit services are reused. |
| A54-A56, B40: Livelihood | Removed All Listings selector and repeated Local Businesses text below business names. Existing review/publication capability checks remain; no unrequested member assignments are created. |

## Fee rules and missing official content

- Excel says at least **20% of Total Booking Fee**. The implementation uses the displayed rental/admission plus refundable bond total. Paying more, up to the full total, is allowed. Uploading proof never marks a payment as verified.
- Office confirmation requires **both** calendar approval and Finance payment approval permissions. A role name alone does not bypass those checks. Approval atomically records the fee and verified payment; Other and Total balance show the remaining amount due. A repeat of the same successful confirmation does not post twice.
- Published rates are prefilled when the source determines the amount. Missing court day/night cutoffs, mixed/intermediate package rules and Sunday pool package rates remain **Office confirmation needed**. No invented hourly prorating or missing rate is presented as official.
- Official payment instructions, QR artwork and bank/GCash destinations were not supplied. Online payment cannot be activated until official instructions are configured. Current support displays those instructions as text, including any supplied URL; it does not generate a bank QR or payment-provider integration. Office can still verify an in-person payment without online settings.
- Existing document files include clearly labelled samples. The document viewer change is application workflow gating; publicly hosted sample files are not confidential storage. Before publishing confidential Right to Inspect records, supply the real files and protect delivery with private storage/server authorization. Do not claim the current static sample URLs secure confidential files.
- Printable permits are escaped HTML containing the actual issuance reference and validity, downloadable and printable/saveable as PDF. They do not invent an official signature, seal or signed PDF template.
- Existing approved bookings, posted charges and payments are not backfilled or rewritten. Older pending bookings without checkout metadata keep their previous review flow. Previously reviewed move records are not silently backfilled into the new Security queue.

## Owner/Kate rollout steps

1. Review the diff and validate against the installed migration history. This work assumes the existing checkout baseline through **098**, including publication audiences **073** and the earlier booking/accounting/request services. Do not blindly rerun historical migrations. If production differs, inspect it first.
2. Apply these **new** migrations once, in order, using the owner's SQL workflow:

   1. `supabase/migrations/202611260099_excel_pass_workflows.sql`
   2. `supabase/migrations/202611260100_excel_amenity_booking.sql`
   3. `supabase/migrations/202611260101_excel_carpool_permits.sql`
   4. `supabase/migrations/202611260102_excel_booking_payments.sql`
   5. `supabase/migrations/202611260103_excel_helpdesk_routes.sql`
   6. `supabase/migrations/202611260104_excel_property_clearances.sql`
   7. `supabase/migrations/202611270105_workspace_access_editor.sql`

3. Fill the official instructions and policy reference in `scripts/configure-excel-booking-payments.sql`, review, then run it to enable online proof submission. No credentials belong in this script. Do not execute its unfilled template; it deliberately fails without official values.
4. Assign the intended real members to Maintenance, Grievance, Livelihood or IT/data-governance through the existing access-management workflow. Review existing explicit grants/tab overrides; the new defaults do not override an explicit restriction. No migration makes a resident an admin.
5. To enable automatic three-day reminders, review/run `scripts/schedule-excel-helpdesk-followups.sql`. It requires an existing `pg_cron` installation. Without scheduling, the reminder function exists but does not run by itself.
6. Deploy the frontend after SQL. **No `bfe-create-account` Edge Function redeployment is required.** No account-creation source changed. This rollout does not require a new Edge Function.
7. Run the focused acceptance checks below on both the Vercel URL and the GHL `/portal` embed. No live SQL, deployment, commit or push was performed by this implementation session.

## Local checks actually performed

```powershell
npm.cmd run build
npx.cmd vitest run supabase/tests/excel-workflows.test.ts packages/shared/src/amenity-guidelines.test.ts packages/shared/src/baseline.test.ts packages/shared/src/feature-records.test.ts packages/shared/src/accounts.test.ts
# Targeted ESLint and Prettier were also run on changed TS/TSX/CSS files.
git diff --check
```

- Build including TypeScript and PWA generation: passed. Existing large-chunk and upstream annotation warnings remain.
- Targeted suites: **56 tests passed** across five files. The SQL workflow suite installs 099-104 into an isolated synthetic PGlite database, with selected real historical definitions. This is not a connection to production.
- Tests cover pass decision stages and ID checks, booking references including four-digit counters, pencil expiry, minimum duration, pool exclusivity, atomic charge/payment posting and retries, private proofs and minimum payment, category-limited Board/team replies, reminder deduplication, Security-before-move issuance, permit access and carpool public-field filtering.
- Changed TypeScript files: targeted ESLint passed. Formatting applied with Prettier.
- Mocked local Chromium and mobile WebKit assertions passed for manual dates, court minimum duration and mobile page width. Playwright reported each case `ok`; its Windows server teardown then hung and was interrupted. This is a passed focused browser assertion, not a clean full E2E suite run.
- No full cross-role live acceptance, real payment upload, confidential document delivery, production migration run, Android device/keyboard check or real GHL iframe authentication check was performed. These remain owner/Kate checks.

## Focused acceptance checklist

Use test accounts and approved test records; do not record a fictitious payment in the live books.

| Role/screen/action | Expected result |
| --- | --- |
| Resident / Visitors Passes: visitor and small delivery; Security / Visitors: check ID and plate | Resident request stays pending; Office cannot approve these; Security approval requires the checks. Vehicle requests require a plate. Rejection notifies the resident. |
| Resident gate pass, inbound/outbound with items; Office review; Security decision | Office approval alone does not authorize entry. Security must then approve. Invalid order and unauthorized callers are denied. |
| Security walk-in: search a verified household, enter visitor/vehicle details | Search returns permitted active lots; creation uses the selected household and still requires Security checks. |
| Resident / Amenities: court 30 min then one hour; hall below/two hours; Sunday Mass period | Invalid durations/times cannot be submitted. Manual date is visible. Sunday 10:30 AM-1 PM is disabled. Existing closing hours remain respected. |
| Two residents: overlapping pool-exclusive pencil requests, then Office confirmation | Pending holds are not guaranteed. First verified/approved booking blocks the entire session. Second conflicting confirmation fails without a second payment/charge posting. |
| Resident Pay Now / Hold Booking | Reference persists when reopened. Known fees and 20% minimum appear. Official instructions appear only after configuration. Missing-rate cases ask Office rather than inventing a total. |
| Resident uploads valid proof, another account attempts to read it | Own proof is available; another resident is denied. Proof upload alone does not confirm payment. Files above 8 MB/unsupported formats are rejected. |
| Authorized Office verifies actual payment, enters receipt, approves | Confirmed booking, receipt and payment appear. Other/Total reflect unpaid remainder. Full payment leaves zero remaining for that charge. Duplicate receipt/retry cannot post twice. User without Finance approval cannot confirm payment. |
| Resident Helpdesk; each responsible committee/Board desk | Handler sees the assigned category, can reply/change status, and cannot open another category through a direct request. Resident notifications open the request. Three-day reminder is sent once per unanswered resident message after the job runs. |
| Vehicle approval; move Office approval then Security approval; permit issuance | Vehicle notification directs Office installation. Move cannot be issued before Security approval. Owner can download the actual issued record; unrelated account is denied. |
| Homeowner and renter / Carpool | Both ride types publish with consent/valid date; own Offers and Requests tabs filter correctly; labels/colors differ; End Carpool removes it; expiry hides older rides. |
| Documents | Mandatory view works before download approval. Right to Inspect remains gated until approval and expires afterward. Real confidential files must use protected delivery before release. |
| iOS/Android browser and installed PWA; GHL embed | Fields/buttons remain reachable with keyboard open, sheets scroll, no horizontal overflow, role switching and notification destinations work, refreshed assets show the new frontend. |

If a check fails, capture the screen, role, action and RPC error code/message without passwords, tokens or personal data. Preserve the record and inspect whether the operation saved before retrying a payment/approval.


## Pre-rollout regression review ? 27 November 2026

Use the latest local 099?105 files, including the fixes below, rather than previously copied SQL.

- Fixed a legacy-RPC checkout gap in 100: all newly inserted bookings now receive a checkout record, including requests created through older booking RPCs. An older approval endpoint cannot skip the new payment-verification requirement. Existing historical bookings are not backfilled.
- Hardened 102: installation rolls back if a pre-existing payment-proof bucket is public, has no/too-large size limit, or allows unrestricted/unapproved file types. It never silently reuses unsafe settings. Review the bucket if this guard stops installation; do not remove the guard.
- Corrected older isolated test fixtures to install the actual 101 permit metadata update. Their old choices disagreed with the current Construction Permit / Renovation Permit forms. New tests verify required conditional fields as well.
- Added tests for excessive payments (no charge/approval on failure), legacy approval blocking and proof-bucket privacy.
- Added `scripts/verify-excel-rollout.sql`: read-only prerequisite and installed-marker inventory, tested against the isolated migration chain. Before applying SQL, run this inventory in the owner's editor. Prerequisites should be present and new installation markers normally absent. A marker is not proof that every migration statement matches; investigate partial/previous installations.

Validation: `npm.cmd test` passed 422 tests across 39 files. After adding the read-only inventory check, `npx.cmd vitest run supabase/tests/excel-workflows.test.ts` passed all 22 workflow checks. Targeted test ESLint and `git diff --check` passed. The final TypeScript/Vite/PWA build result is recorded in the verification vault note.

Owner next steps: check the inventory, apply new 099 through 105 once in order, configure official payment instructions, assign intended role/committee permissions, optionally schedule reminders, then deploy the frontend. No BFE/Edge redeployment is needed. Follow the resident/Security/Office/Board acceptance table above and the permission editor checks in `docs/WORKSPACE-ACCESS-EDITOR.md`. Test real approval/payment flow only with authorized actual records or an isolated environment. Physical phone keyboards, real Storage uploads, deployed authorization and GHL iframe sessions remain unverified locally.
