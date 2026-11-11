# Livelihood and submission outcomes

Local implementation, 10 November 2026. No live database, hosting or real account was changed.

## Install in order

After the already installed 040, run each complete file once in the owner's Supabase SQL Editor:

1. `supabase/migrations/202611100041_livelihood_approval_publication.sql`
2. `supabase/migrations/202611100042_request_issuance.sql`
3. `supabase/migrations/202611100043_resident_calendar_month.sql`
4. `supabase/migrations/202611100044_household_relationship_application.sql`

Install all four before using the new UI. They add no sample records, broad permission grants, official references or automatic approvals. Existing migrations through 040, including 037's reviewed account–lot linking service, must be installed. No Edge Function change is required. Refresh the updated frontend after SQL succeeds; deployment remains owner-controlled.

## Resulting workflows

| Submission | Office action and actual result |
| --- | --- |
| Businesses, buy & sell, jobs, garage sales, workshops, booth activities | **Approve & publish** saves curated public text, audience and expiry. All six appear in the Livelihood feed. Submitted and legacy Reviewed listings can be explicitly published. Consent, current version, permissions and completed cover uploads are checked. |
| Workshop/booth application | The existing confirmation service commits places subject to capacity. **My applications** is now inside Livelihood, separate from **My listings**. Opening an activity carries its selection into the application form. |
| Vehicle/sticker or permit/clearance | Approve the request, then open **Follow-up & dispatch → Vehicle / sticker issuance** or **Permit / clearance issuance**. **Record issuance** records the actual official reference and validity dates in a private immutable ledger with a snapshot of the reviewed request. A vehicle-removal request records removal instead of issuing a sticker. |
| Household change | Complete the evidence review, then open **Follow-up & dispatch → Verified household relationships**. **Apply verified relationship** searches real accounts, checks the physical lot, displays the recorded homeowner, and requires a relationship and evidence reference. The existing independent-review service creates or confirms the approved membership. The request records the actual membership result. |
| Amenity reservation | Existing approval remains authoritative. Pending and Approved reservations block overlapping slots; rejection/cancellation releases them. The resident calendar now reads the complete selected month, including bookings crossing midnight. The Office calendar continues using 039. |
| Visitor, gate, delivery pass | Existing approval remains separate from Security's entry/exit processing and its current membership/validity checks. |
| Registration and lot claim | Existing reviewed account creation and independent membership approval remain authoritative. Historical receipt entitlement remains separate. |
| Payment evidence | Office records review, then uses Finance for independent reconciliation against accounting records. Review never clears a payment, creates an official receipt, allocates invoices or changes a balance. The UI now says accounting follow-up instead of claiming payment approval. |
| Complaints, maintenance and document requests | Existing Helpdesk response/resolution workflow remains. Resolving a document request does not manufacture an issued document. |
| Shuttle / carpool | Shuttle retains driver dispatch/completion. Carpool remains an explicitly labelled interactive demo. |

Staff announcements retain direct publication. Activity publication does not create a facility reservation or confirm an applicant automatically.

## Important boundaries

- Existing permissions decide who may post each category. Residents can apply to staff-published booth events; this update does not silently grant event-management rights.
- Registered owner names, other occupants, legal ownership and receipt access are not changed by household application. New relationships take effect now; future-dated proposals must wait. Removing/revoking an earlier relationship remains an explicit Lot register action.
- Issuance records document the actual Office action. They do not generate a signed PDF, charge a fee, send a sticker to a printer or change gate hardware. Issued/applied requests cannot be withdrawn to conceal a completed outcome. Corrections/revocations need a dedicated audited workflow; these ledgers cannot be overwritten from the UI.
- Direct resident sign-in can read their own issuance/application results. Developer account preview keeps its existing audited RPC allowlist; the new private outcomes require direct sign-in. Calendar preview retains its existing limited read service.
- Local successful mutations invalidate affected lists, queues, histories, notifications, participation and calendars. Open destination screens also poll where supported. A different signed-in browser generally sees changes on its next 30-second refresh, not by an invented real-time guarantee.
- Vehicle routes now use **Property**, matching the installed database definition. No Security/Property grants were expanded.

## Verification performed

- TypeScript and production build passed. Existing Zod annotation and large-chunk warnings remain; these do not prevent a build.
- Twenty isolated PGlite tests pass across submission outcomes, household application and Office review aggregation. These include publication/consent/media/version checks, private immutable issuance and retry safety, complete own-month bookings, independent household linking through the actual 037/005 functions, and correct pending/follow-up queue counts. Identity/capability and Storage services are synthetic fixtures.
- Four targeted existing service tests pass for booking overlap holds, independent booking decisions, Security entry/exit/version checks and participation capacity. Other tests in that file were deliberately skipped.
- Synthetic browser checks pass in Chromium at 1440px and 390px, and WebKit at 390px: six categories, legacy learning redirect, selected activity, approve/publish, issuance, household application, and no document overflow or page errors. Requests were intercepted against a synthetic backend; no live submissions were made. This is browser-engine coverage, not physical iOS/Android certification.

## Owner verification after install

1. Sign in directly as an authorized resident. Browse all six categories and submit an allowed listing with a cover and consent.
2. In Office, open Review inbox, inspect the text/image and **Approve & publish**. Confirm it appears in the resident's Livelihood feed after refresh. Recover any older Reviewed listings explicitly; installation does not bulk publish them.
3. Apply to a workshop/booth activity from Livelihood. Confirm places in Office and verify the applicant sees Confirmed. A full activity must reject over-capacity confirmation.
4. Approve a vehicle or permit request. Confirm it moves to follow-up, then record a genuine reference and dates. Verify the resident sees the issuance and the follow-up queue clears.
5. Review a household request. Use another authorized staff account to select and verify its real account/lot relationship. Apply it, then verify the target's property records. Do not use this as a legal owner correction or receipt entitlement shortcut.
6. Approve an amenity booking. Verify both calendars, its unavailable time range for another resident, and that cancellation/rejection releases the hold.

If a step fails, retain the saved request and report the action/error; do not create duplicate requests to work around it.

## Resident Property permission correction (045)

If a directly signed-in homeowner or renter sees an access-denied message on Vehicles or Permits, the original 023 base defaults omit Property own-scope view/create even though 018 places both request types in Property. Apply `supabase/migrations/202611100045_resident_property_requests.sql` after 044, then refresh the app to reload permissions.

045 adds only own-scope Property view/create for active homeowner/renter roles. It does not grant association review, approval, issuance, management or access to another household. The existing tab layer remains authoritative: hidden, view-only and explicit action denials are preserved. A missing approved lot relationship is not invented. Existing household-request definitions also use these own Property permissions; applications still need the verified independent review flow.

The updated migration recognizes both 023 and the exact owner-supplied installed definition reviewed on 10 November, plus their already-patched equivalents. It changes only the calendar permission clause to include Property, preserving the rest of the installed function and its metadata. Other customized definitions are rejected. If that guard fails, retain the error and review the installed policy; do not rerun older access migrations to bypass it.

Six isolated tests using the established permission stack and the owner-supplied policy pass for homeowner/renter reads/submissions, cross-household privacy, protected staff decisions, hidden/read-only rules, explicit denials, inactive accounts and the customization guard. No live permissions were changed by the agent.


## Follow-up installation: 046 and 047

After 045, install 046 for Office member management and 047 for fulfillment notification route compatibility. See [Office member management setup](OFFICE-MEMBER-MANAGEMENT-SETUP.md). The earlier 042/044 notification destinations were outside the installed database allowlist; 047 repairs their destination while retaining the confirmation and access rules. Both should be installed before live issuance/household verification.
