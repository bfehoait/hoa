# Office record management assessment

Implementation follow-up: member editing, direct Office property linking and history are now prepared in 046, with fulfillment notification compatibility in 047. See [setup](OFFICE-MEMBER-MANAGEMENT-SETUP.md). The assessment below records the earlier state and remaining module priorities.

10 November 2026. Source assessment only; no application behavior, live accounts, permissions or database state changed. The owner reported successfully running updated 045. That is not a live workflow check by the agent.

## Main findings

The Office member details modal in `People.tsx` displays the directory record and registration actions. It has no general member correction form or direct individual property-link action. Backend account/lot matching and linking exist in 037; 044 connects verified linking to reviewed household requests. Workbook matching is exposed elsewhere through the developer account picker rather than being a clear everyday Office member action.

Three relationships must remain distinct:

- Member record to authenticated sign-in account: `members.user_id` identifies the sign-in account. Changing a recorded email does not change or verify the authentication email.
- Account to property: approved `bfe_lot_memberships` establish the permitted owner/renter/household relationship. Typed unit text does not establish that relationship or legal ownership.
- Approved owner relationship to individual historical receipts: explicit receipt entitlement remains separate.

Profile preferences are another distinct store. `bfe_save_profile` writes `bfe_profiles.display_name/phone/bio`; the Office directory reads member fields. A resident profile update does not synchronize those member fields. Staff need to see that distinction, and a source-of-truth decision is needed before introducing automatic synchronization.

## Recommended member workspace

Use **Office → People & accounts → View member** as the primary entry. Keep a compact summary, then provide:

1. **Details**: recorded identity/contact information, sign-in-account status, clearly identified profile preferences. An authorized correction form should show before/after values and require a reason.
2. **Properties & household**: verified current relationships, **Link property**, and explicit expiry/revocation actions. Search the physical lot, select the verified relationship, show the recorded homeowner and check supporting evidence before confirmation. Reuse 037, including independent approval for the staff member's own account.
3. **Requests & records**: scoped links to the person's bookings, passes, vehicle/permit requests and actual fulfillment records. Each underlying service must authorize the read independently.
4. **Access & status**: show assigned roles and account status. Editing remains restricted to the existing access manager service; an ordinary contact editor cannot assign roles or elevate access.
5. **History**: who changed which field, previous/new values where appropriate, reason/reference and time. Avoid copying sensitive evidence into broadly visible audit messages.

Keep detailed work available in the Lot register and Roles & permissions; these should be contextual links into the same records, not duplicate implementations with different rules.

## Changes after a relationship or detail correction

Editing a member's name must not rewrite historical receipt payer evidence. Changing a display name must not silently replace the recorded member name. Changing a typed address must not transfer property access. Linking a second property must not automatically revoke the first; the system supports multiple relationships.

Moving out/revocation needs an impact preview: current lot access, separate receipt entitlements, future bookings, current passes and other active requests. Current pass processing already rechecks membership at protected transitions. The source does not establish a complete automatic cancellation or transfer policy for every other record. The owner must define those consequences before automation; retain historical records and make cancellations/revocations explicit.

## Other Office workflows

| Area | Existing capability observed | Assessment / needed management flow |
| --- | --- | --- |
| Member details | Directory read; resident profile preferences; protected role/status service | Missing everyday staff contact/identity correction flow and clear authoritative fields. Authentication email needs a separate verified account operation. |
| Property relationships | Match/link services, household application, membership review/revocation and recorded homeowner correction | Put individual linking in People. Show current relationships and impact before revocation. A recorded homeowner correction is distinct from a membership link and is not a legal ownership transfer. |
| Vehicle/sticker and permit/clearance | Request review plus private immutable issuance records | Add explicit correction/replacement/revocation with reason and linkage to the earlier issuance. Do not overwrite an issued record or reuse generic withdrawal as revocation. |
| Amenities | Booking approval/rejection, cancellation, availability and facility configuration | A reschedule/amendment flow must validate availability again before replacing the booking. Facility configuration already has safeguards around future bookings. Cancellation/notification policy needs to remain explicit. |
| Visitor/gate/delivery passes | Approval and separate Security entry/exit lifecycle | Corrections to dates, destination or guest details need a deliberate amendment/review policy. Retain entry/exit history; never silently rewrite an already-used pass. |
| Livelihood listings | Existing edit/resubmit path for businesses, buy/sell, jobs and garage sales; all six have publication | Make revision behavior consistent where supported for workshops/booth activities, including existing applicants. Publication edits must not silently change confirmed attendance or reservations. |
| Announcements/documents | Direct announcement publication, unpublish/history, document attachment/publication | Need a clear published-content correction/version workflow. Current announcement submission form uses `editing=null`; do not assume a complete published editing UI exists. Old issued or published versions need history and deliberate replacement behavior. |
| Helpdesk | Staff response and status/resolution workflow | Preserve conversation and resolution history; determine whether reassignment/reopening is required rather than treating generic request editing as complete case management. |
| Finance | Existing imported receipts and explicitly scoped receipt access | Do not directly overwrite original financial evidence or mark a balance paid from a contact/request edit. Corrections and reconciliation need their own authorized accounting workflow. |
| Roles and status | Existing protected access manager and optimistic snapshot checks | Reuse these services from the member context; preserve independent authority, explicit denials and protected developer accounts. |

This assesses the main connected Office workflows. It is not a claim that every governance, elections, transport or external integration has received a complete amendment-policy audit.

## Shared requirements

Every substantive edit should identify the actual record being updated, its authoritative service, the staff capability, expected version/snapshot, reason and audit trail. If another staff member changes the record during editing, require refresh and review rather than overwriting it. Retried confirmations must not duplicate an applied change.

Use the same interaction pattern across modules: **View → permitted action → impact/before-and-after review → confirm → server result → history**. Names such as **Update contact details**, **Link property**, **Reschedule**, **Replace issuance** and **Revoke relationship** communicate the effect better than a generic Edit button.

After confirmation, invalidate the relevant member/directory/detail caches and affected property/request/notification/calendar views. Keep changes keyed to account and record identifiers; do not use global local state or browser storage as proof that an HOA action succeeded. A failed save should preserve the draft and clearly state that confirmation is missing.

## Implementation order for approval

1. People member workspace with direct property linking and current relationship/history views, reusing 037/044/005.
2. Authorized member detail corrections and explicit separation of recorded details, profile preferences and authentication email.
3. Relationship expiry/revocation and impact previews for active services.
4. Corrections/replacement/revocation for issued vehicle/sticker and permit records.
5. Booking/pass amendments and consistent listing/activity/publication revisions.
6. Dedicated accounting correction/reconciliation work after the owner confirms accounting rules.

No new code or migration is proposed as already implemented by this assessment. No test run is claimed for these proposed flows.
