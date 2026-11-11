# Customer submissions: review, approval and resulting behavior

Implementation follow-up (10 November 2026): the publication, issuance, household relationship and calendar changes are now prepared locally in migrations 041-044. See [setup and remaining boundaries](SUBMISSION-OUTCOMES-SETUP.md). The assessment below records the earlier state.

10 November 2026. Assessment only, based on the current frontend and prepared migrations through 040. No application code, SQL behavior, live records, permissions or deployment changed during this assessment. The owner reported 040 installed; installed function bodies and live end-to-end outcomes were not queried.

## Main conclusion

Office queue discovery is implemented, but queue visibility does not establish that every workflow fulfills the customer's request. Publication, private approval, account linking, service completion and financial verification require different outcomes. A generic Reviewed status cannot stand in for all of them.

“Connected” below describes source implementation, not successful live certification.

| Customer feature | Result after the authorized decision | Current source assessment |
| --- | --- | --- |
| Membership application | Create/link a real sign-in account and member record; notify/provide sign-in instructions through the established process | Connected approval/account creation path through registration review and manual-account service. This does not independently verify a lot or entitle historical receipts. No invitation email is sent by the current manual account path. |
| Account/lot claim: owner, renter, household | Approved private relationship to the verified lot | Connected membership review with independent-approver checks. Owner receipt entitlement is a separate, deliberate financial-data access review. No legal ownership transfer or automatic receipt access. |
| Buy & sell | A reviewed public listing appears in Livelihood | Published-only feed exists; Reviewed is not Published. The current generic decision flow has a publication dead end described below. |
| Local business | A reviewed directory listing appears in Livelihood | Same publication behavior/gap; permitted reviewed links can accompany the listing. No automatic business permit. |
| Jobs & referrals | A reviewed job/referral listing appears in Livelihood | Same publication behavior/gap. Publishing is not hiring or approving a job application. |
| Garage sale listing | A reviewed sale listing appears in Livelihood | Same publication behavior/gap. Publishing is not a separate event/facility/permit approval. |
| Workshop listing | A reviewed activity becomes visible in the training/workshop feed | Publication path exists. Listing approval/publication is distinct from confirming attendance. |
| Booth or workshop application | Confirm places on an existing published activity | Dedicated participation decision validates membership, activity availability and capacity, updates participation and notifies the applicant. It does not independently issue a permit, facility reservation or payment confirmation. |
| Amenity reservation | Confirm the requested facility/time and show the decision in booking views | Dedicated Pending → Approved/Rejected decision exists. Booking/calendar/availability reads use that store; no public marketing post is created. Customer calendar currently reads only the first dashboard page. |
| Visitor, gate and small-delivery pass | Make the pass approved for the authorized gate workflow | Dedicated approval and gate lifecycle exists; Security performs later entry/exit steps. Approval does not perform a physical gate/hardware action. |
| Vehicle/sticker request | Register/update the approved vehicle and issue, renew, replace or remove a sticker as appropriate | Review-only generic record today. The review procedure does not write a vehicle/sticker register or issue a sticker. Route capability mismatch also exists. |
| Construction, renovation, move-in/out or other permit | Issue a private clearance/permit with its official reference and validity | Review-only generic record today. No permit document/reference issuance is performed by generic approval. Required issuance rules remain an owner policy decision. |
| Household/occupancy change | Apply the verified private household change to its authoritative record | Generic review stores an outcome; it does not automatically update the household roster, occupancy or account/lot relationship. |
| Payment evidence | Verify evidence and, only through approved accounting logic, reconcile/allocate it | Generic review only. It cannot establish cleared payment, settle an invoice or change the balance. Existing receipt access is a separate entitlement workflow. |
| Complaint, concern, maintenance, support and document request | Staff reply, work on the request, then resolve it | Connected Helpdesk lifecycle and conversation. These are follow-up tasks rather than publications; resolving a document request does not generate an official PDF automatically. |
| Shuttle request | Driver accepts and advances the pickup lifecycle | Connected dispatch workflow, not a generic Office approval or public post. Demo stop maps do not create real bookings by themselves. |
| Carpool map demo | No real booking/driver assignment | Main experience is explicitly illustrative. Legacy backend carpool publication/interest workflows exist, but that does not make the map demo a real matching/dispatch service. |
| Community announcements | Authorized staff publish directly | Existing direct-publication exception must be preserved. Residents read audience/expiry-eligible posts; no resident announcement-approval flow is needed by default. |
| Community documents / candidate information | Residents read the permitted published information | Primarily staff-curated publication. Document publication can expose a reviewed private-storage PDF to its eligible audience; this is separate from issuing a requested resident clearance or running an election ballot. |

Legacy complaint/concern feature creation was retired in favor of Helpdesk. Legacy generic gate/walk-in creation was replaced by dedicated passes. Old records remain inspectable; future work should not create duplicate submissions in both stores.

## Confirmed gaps in source

1. **Approval and publication can diverge permanently.** `bfe_review_feature` in 014 allows Submitted → In review → Reviewed or Published. It does not allow Reviewed → Published. The frontend labels Reviewed as Approved, and the new pending inbox intentionally excludes completed Reviewed records. A publishable listing can therefore be called approved, leave the pending queue and never appear in the marketplace. Public feeds in 029/035 require Published. Recovery/transitions for existing affected records need explicit review, not bulk automatic publication.
2. **Approval copy overstates fulfillment.** `LiveFeature.tsx` says “Approved — the request is granted.” The generic server function updates the feature record, audit and notification only. Vehicle issuance, permit issuance, household application and financial allocation are not implemented by that status change. Labels must reflect the real result before presenting these as completed services.
3. **Vehicle capability mismatch.** Migration 018 defines vehicles with Property capability. Current vehicle route metadata and review routing use Security. A staff account with only one of those capabilities can see a misleading destination or be denied by the protected procedure. Align route/read/create/review policy deliberately; do not solve this by broad new grants. Permits already use Property in the current Office routes.
4. **Read access, review access and publishing access differ.** Read-only staff may inspect queues without deciding. A publisher-only account can also be blocked by a review-dialog button that checks `can_review` even when the server would accept publication from In review. Buttons and permitted transitions need per-action treatment without bypassing server checks.
5. **Visibility after a decision is not universally instant.** Marketplace and feature feeds poll every thirty seconds. Some other readers rely on remount/focus/manual refetch. Invalidation currently targets particular query families; complete the destination-reader map before claiming instant cross-account updates. Notifications also usually lead to the generic notifications page rather than the exact decided record.
6. **Customer calendar completeness needs assessment during wiring.** `CommunityCalendar.tsx` requests booking page zero only. The staff calendar in 039 has full-month counts and daily pagination, but that alone does not fix omissions in the customer's calendar when their record count exceeds twenty.

## Recommended implementation plan (not executed)

1. Agree on the outcome and staff action for each family. Use Publish listing, Confirm reservation, Approve pass, Verify lot link, Issue permit, or Resolve request instead of one ambiguous approval result.
2. Fix the generic decision labels/transitions and vehicle capability mismatch. For public listings, offer an authorized explicit approval/publication outcome with consent, reviewed public text, audience, image-readiness and expiry checks. Keep reject/return reasons and safe recovery for existing Reviewed listings. Preserve staff direct announcement publication.
3. Verify one complete resident → Office → result → resident loop for each of the four marketplace listing types. Check unpublished drafts/private fields, rejection, unpublishing, audience restrictions and refresh behavior as well as the successful public post.
4. Exercise the already dedicated booking, pass, participation, registration and lot-link workflows rather than rebuilding them. Check role-restricted actors, conflicts/capacity, independent review, cancellation, permissions withdrawn during review, stale versions and repeated requests. Complete destination cache/notification/reader pagination coverage.
5. Design vehicle/sticker and permit issuance as private authoritative records with owner-approved fields, validity, references and lifecycle rules. Decide whether approval and issuance are separate steps. A generic review must not silently claim physical issuance or legal clearance.
6. Define household-change application and financial verification separately. Do not infer ownership, clear payment or calculate balances from approval of a text submission.
7. Treat real carpool matching/booking and other demo-only capabilities as separate projects. Do not send illustrative map actions into live approval queues.

No migration is required to read this assessment. Follow-up implementation and live verification remain outstanding.
