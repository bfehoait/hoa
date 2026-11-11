# Business form coverage and restoration assessment

11 November 2026. Business requirements extracted from the previous production UI, compared with current project source. Local restoration is in progress through prepared migration 059. No live database connection or deployment; no reference code execution or reuse.

## Conclusion

**The previous business forms are requirements, not optional legacy features.** The current restoration adds structured Helpdesk handling, household occupants, Office configuration, property attributes, accounting forms, candidate photos, transport details, staff-created bookings and per-item garage-sale review. Source implementation is not proof that those services are installed or working in the live project. Remaining gaps are listed below.

The historical `FIELD-GAP-ASSESSMENT.md` predates registration, enriched passes, announcement media, issuance and member-management work. Its missing-feature statements should not be used as the current checklist.

## Method and limits

- Reference: ignored, read-only `reference/upstream-hoa/index.html`, snapshot recorded in `packages/shared/src/reference-inventory.json`. The duplicate HOA-1 file is not counted twice.
- `node scripts/inventory-reference-forms.mjs` statically parses source and inventories literal input/select/textarea identifiers. It does not evaluate or render old code. Output is metadata only in `docs/legacy-form-control-inventory.json`.
- Extraction found **265 control occurrences, 214 distinct identifiers and 79 enclosing control-owner blocks**. These include search, filters, helpers and dialogs; they are **not 79 independent business forms**. Dynamic controls and button-only dialogs require separate inspection.
- The current shared feature catalog has **36 modules**, supplemented by dedicated Auth, registration, Helpdesk, booking/pass, participation, registry, account/access and shuttle forms. Catalog size is not a parity percentage.
- Current route handling, shared fields, form components and prepared migrations through 059 were inspected. This does not establish installed live definitions, working permissions for every role or successful end-to-end outcomes.
- No old values, contacts, credentials, assets, styles or application logic were copied. Reference symbols and line numbers below identify evidence only.

Status meanings: **Implemented** means an equivalent workflow has source UI/service support, not exact field or live parity. **Consolidated** means a replacement service intentionally covers several old entry points. **Partial** means meaningful fields or operational steps differ. **Proposal/demo** is not an authoritative service. **Missing** means no equivalent usable management form was found.

## Accounts, household and administration

| Old form / source evidence | Current destination and evidence | Assessment |
| --- | --- | --- |
| Login; static controls near 767 | `features/auth/Access.tsx`, Auth service | Implemented: sign-in and recovery flow; preview role selectors are not real authorization. |
| `registerForm` 8432; approve/reject 8527/8544 | `/register`, `Access.tsx`, `registration.ts`, `RegistrationReview.tsx`, migration 028 | Implemented with stronger address/proof/household questions. Proof reference is not an uploaded identity document. |
| `userForm` 6853; `addrFields` 6998 | Office People: `CreateAccount.tsx`, `MemberWorkspace.tsx`, `AccessManager.tsx`; 025/046 | Implemented across separate protected flows. Recorded detail editing, login setup and role changes are intentionally not one unrestricted form. Login-email amendment is not available in the inline editor. |
| `activateUser` 7209; invite/reinvite; password dialogs 7222/8409 | `CreateAccount.tsx`, Auth recovery/reset, existing account service | Partial: manual initial sign-in setup and user recovery exist; this is not full parity with staff setting arbitrary passwords or invitation/resend delivery. |
| `deleteUserForm` 7126 | `DeleteAccount.tsx`, established account service | Implemented protected removal flow; not a generic delete-row action. |
| `auditFieldsHTML` 7057 | Member correction reason/history, property-link reference, protected review/audit services | Partial: structured reasons/history exist; a text reference is not an attached supporting document. |
| `accountSettings` 3683 | `/more/profile`, `/more/settings`; `MemberProfile.tsx`, `Settings.tsx`, `accounts.ts` | Partial: display name, phone, bio and appearance exist; avatar upload and digest frequency are not equivalent. Official position is staff-managed. |
| `hhForm` 7282 | Office People -> Properties -> Household occupants; migration 051; verified account links remain in 044/046 | Implemented roster form for named occupants, including people without sign-in accounts. Current verified owner/renter links determine the household scope; roster entries do not create accounts or property/receipt rights. |
| `association` controls near 3036 | Office -> More Office tools -> Association settings; 052 | Implemented reviewed name/address/office-hours/quiet-hours editing with version checks and audit reference. No official values are seeded. |
| Access and individual overrides | `AccessPlanning.tsx`, `AccessManager.tsx`, `TabAccess.tsx`; configurable permission services | Implemented protected access management. Role, tab visibility and property ownership remain separate. |

## Requests, communication and safety

| Old form / source evidence | Current destination and evidence | Assessment |
| --- | --- | --- |
| `requestForm` 5496, `complaintForm` 7958, `concernForm` 7976, `ticketForm` 8171 | Customer and Office Helpdesk; RequestDesk.tsx, RequestBusinessDetails.tsx; 048 | Consolidated with category-specific topic, location, involved-party, service and evidence-reference answers. Replies remain on the established private thread. References are not document uploads. |
| `assignForm` 5487 | Office Helpdesk -> Edit Office handling; 048 | Implemented actual handler selection and priority. Assignment requires the existing assignment capability and an eligible active Office account. |
| `resolveComplaint` 7951 | Office Helpdesk handling and existing status service; 048 | Implemented structured resolution, required before transitioning to Resolved. Handling saves and closing remain explicit separate actions. |
| `chatModalHTML` 3496, `quickMessageAdmin` 3564 | Request-scoped Office/resident conversation; generic messages proposal | Consolidated/partial: Helpdesk threads are implemented. A separate live general chat or direct-message inbox is not established; its removal was previously requested. |
| `gpForm` 4046; decline/check/hold 4153/4182/4191; security reason 4258 | Dedicated passes in `OperationsDesk.tsx`, migrations 027 and existing operations service | Consolidated: visitor/gate/small-delivery requests, lot verification, validity and entry/exit decisions exist. Old hold/mismatch sub-states and an independent household note are not exact field parity. |
| `visitorForm` 5741; `walkInForm` 7797 | Same dedicated pass service, party count and commute/vehicle fields | Consolidated: shared authoritative pass path replaces generic walk-in records. Retained legacy records are not a second new-entry path. |
| `guardForm` 4269 | Guard roster feature form; additive questions 049 | Contact and shift questions restored alongside post/date/start/end. An independently operational duty scheduler and shift-conflict engine are not established merely by these fields. |
| `stickerForm` 7912 | Vehicles feature form plus `RequestIssuance.tsx`, migration 042 | Implemented request/approval/record-issuance path with reference and dates. No physical sticker printing or gate-device integration is implied. |
| `incidentForm` 7926 | Incidents catalog/feature record | Implemented structured incident submission, richer than old basic fields; live handling still needs role verification. |
| `hotlinesForm` 4793 (dynamic controls) | Office Hotline management; customer Hotlines; 052 | Implemented reviewed phone/contact editing, publication and hiding. Approved managed entries overlay the existing configured contact list; no old contact values were imported. |

## Livelihood and activities

All six categories are now combined in customer Livelihood. Current list submission uses `FeatureSubmissionForm.tsx`, the feature catalog and publication service; actual attendance/vendor places use `ParticipationDesk.tsx`.

| Old form / source evidence | Current equivalent | Assessment |
| --- | --- | --- |
| `marketplaceForm` 5992, `mktTypeFields` 5971 | Buy & sell form; 049 | Sale/service/rental kind, rate basis, provider and social page questions restored. Listing publication and public contact choices remain protected; no checkout or rental contract is implied. |
| `businessForm` 6046 | Local business form; 049 and existing cover service | Listed-by and social-page questions restored. The cover can serve as the business logo; separate multi-image branding management remains absent. |
| `jobForm` 6116 | Jobs form; 049 | Contact details restored alongside existing company, work type/setup, pay, deadline and application-link questions. Listing approval is not a hiring decision. |
| `garageForm` 6182 | Garage sale listing: date/start/end/location/items/visibility/contact | Implemented listing equivalent. |
| `garageItemsForm` 6223; item rejection 6246 | Sale submission -> Items in this sale; Office Garage sale items; 059 | Implemented item name/details/condition/quantity/price, individual publication/rejection/withdrawal and audit. Revising a published item returns it to review. Only published items of a visible, consented, unexpired parent sale reach other residents. |
| `trainingForm` 5823 | Training & workshops; 049 | Training category, contact details and registration/information link restored. Actual participation uses the separate capacity-controlled application service. |
| `boothEventForm` 6361 | Booth event form; 049 | Theme, vendor rules and event contact questions restored alongside existing venue/date/setup/time/capacity. |
| `boothApplyForm` 6337 | ParticipationDesk.tsx; 050 | Implemented structured vendor name, phone, business and products in the real capacity-controlled application service. Booth applications require these answers; confirmation remains separately authorized. |
| Activity attendance/application | `ParticipationDesk.tsx`, request/decision service | Implemented place confirmation; not a payment, permit or facility reservation. |
| `adminListingForm` 6254; listing reject/delete 6438/6449 | Feature review/publication, expiry, withdrawal/unpublishing and history | Consolidated/partial: lifecycle actions exist with different protections. Exact old posted-date editing or hard-delete semantics are not reproduced. |
| `lhPhotoPicker` 5922, `lhLogoPicker` 6034, `lhLinkField` 5880 | Private listing covers and up to five reviewed HTTPS publication links | Partial: one cover plus links supported; separate logo, multi-photo or all old social-link semantics are not guaranteed. |

## Transport and facilities

| Old form / source evidence | Current equivalent | Assessment |
| --- | --- | --- |
| `carpoolForm` 5603 and interests | Community transport -> connected rides / own offers & requests / interests; CarpoolHub.tsx; 049/058 | Connected form and existing publication/participation paths are accessible separately from the labelled map demo. Ride requests cannot be treated as offers with available seats. Driver vetting, verified routes, live matching and payment execution are not established. |
| `rideForm` 5660, `acceptRide` 5692, `rideOnTheWay` 5706 | Shuttle.tsx; actual dispatch service; 056 | Pickup note and assigned-driver note/arrival estimate restored with private scoped reads and audit. Estimates cannot extend the existing deadline. Advance scheduled shuttles remain absent because the current service is immediate and time-limited. |
| Station management and search near 5146 | Numbered demo stops, shuttle configuration, generic station proposal | Partial: illustrative 12-stop UI does not replace approved stop geography or every dispatcher/station management operation. |
| `bookForm` 6734; facility picker 6729 | Dedicated booking date/range/time/attendees/purpose service | Implemented resident reservation workflow and calendars; configured availability/approval determine actual reservation outcome. |
| `adminBookForm` 6759 | Office Amenity bookings -> New booking; 057 | Implemented explicit resident lookup and staff-created Pending booking, with the resident eligibility, facility rules, rate limit and overlap checks. Staff do not impersonate the resident or approve the request merely by creating it. |
| `declineBookingForm` 6803 | Booking decision with note/version check | Implemented rejection/decision equivalent. |
| `setFacRule` 6785 | Facility configuration form in `OperationsDesk.tsx` | Implemented hours/interval/duration/capacity/renter eligibility/active/reference configuration. Association-wide settings remain separate. |
| `validateForm` 6824 | No equivalent generic validation-code redemption form identified | Needs business clarification before replacement; source dialog is not enough to infer intended security authority. |

## Finance, registry and governance

| Old form / source evidence | Current equivalent | Assessment |
| --- | --- | --- |
| Billing rate controls near 2922; `billingRun` 6579 | Office Finance -> Accounting records -> Dues configuration / Billing run; 054 | Implemented Draft -> independent review -> post/reverse. Posted runs generate invoices using approved flat rates or reviewed property areas. Late-fee percentage is recorded but not automatically assessed; no official rate is seeded. Resident balance displays are not yet connected to this new ledger. |
| `payForm` 6461, `recordPaymentForm` 6491, `payDateField` 6481 | Accounting records -> Payment recording; 054; existing receipt/evidence views remain separate | Implemented reviewed payment recording, explicit property/month invoice allocation, duplicate-reference refusal and protected reversal. Posting does not assert bank clearance; imported historical receipts are not silently re-posted. |
| `expenseCategoryForm` 7599; remove category | Accounting records -> Expense category; 054 | Implemented reviewed category creation and reversal. Reversal is refused while posted expense entries depend on the category. |
| `expenseForm` 7614; expense approval 7630 | Accounting records -> Expense recording; 054 | Implemented reviewed expense posting and reversal with category, payee, date, amount, method, voucher/reference and memo. It records accounting evidence, not bank disbursement. |
| `expenseImportForm` 7700; `monthlyExpenseForm` 7767 | Monthly expense total form in Accounting records; 054; CSV import staging remains separate | Monthly total/reconciliation form implemented without double-counting individual expenses. A connected bulk expense CSV validation/import workflow remains unfinished. |
| `exportCollectionsForm` 7666 | Finance receipt date filters, month selection and reconciled CSV export | Implemented for imported receipt evidence. Does not substitute for invoice/payment-ledger exports. |
| `disclosureForm` 6537 | Board reports; 049 | Reported income, expenses, report date and report-link questions restored. Figures entered here are reported values, not a certified accounting disclosure or automatically reconciled ledger totals. |
| `unitForm` 7353 | Office Lot register -> Property business details; 053 | Reviewed administrative reference, street, HOA start, area, occupancy, remarks, additional statuses and linear-park fields added. Imported source evidence, registered ownership corrections and account links remain separate protected operations. |
| `unitImportForm` 7412 | Real registry import RPC/owner scripts (005); separate local staging UI | Partial UI parity: server import support exists, but a synthetic staging screen is not a connected staff upload/commit/withdraw wizard. |
| `announceForm` 5402; photo 5459 | `AnnouncementManager.tsx`, cover storage, audience/consent/expiry/direct publication | Implemented core publishing equivalent. Arbitrary attachments, QR content and every legacy tag/category treatment are not equivalent to a cover plus links. |
| `boardDocForm` 6837 | Board-record submission/publication and protected PDF library | Implemented core document publication equivalent; private resident-issued clearances remain separate. |
| `ruleForm` 7992 | Published document library or facility-rule proposals | Partial: publishing a policy document is possible; no dedicated authoritative association-rule CRUD/version enforcement workflow was established. |
| `candidateForm` 8047 | Candidate information form, shared credentials question and private cover service; 049/055 | Preparation fields and actual photo upload restored. Candidate information is not certified nomination eligibility. Production voting, proxies and certified results stay disabled until rules are supplied, per owner decision. |
| `myBallot` 2220; `submitBallot` 8006; withdrawal/close/reopen 8023/8031/8032 | Election preparation / candidate information only | Explicitly deferred by owner: preparation first; voting waits for eligibility, proxy and certification rules. No production ballot or certified tally authority is added. |
| `subEditForm` 8150, `addItem` 8399 and dynamically generated controls | Generic helper mechanisms, not counted as business services | Parent workflow must determine replacement; an identifier inventory cannot prove coverage for runtime-generated fields. |

## Restoration rollout and remaining work

Run the prepared updates only in numeric order after confirming migrations through 047 are installed. The detailed mapping, permissions and owner browser checks are in [BUSINESS-FORM-RESTORATION-SETUP.md](BUSINESS-FORM-RESTORATION-SETUP.md). No live changes have been made by the agent.

Still not complete:

- Connected bulk expense import and the trusted owner-run lot import management UI. Existing synthetic staging must not be counted as a live import service.
- Staff invitation/resend delivery, verified sign-in email changes, account avatar upload and digest delivery preferences.
- Security hold/mismatch semantics and dedicated household note, approved station geography, advance shuttle scheduling and a full duty roster scheduler.
- Dedicated association-rule maintenance/version enforcement and generic code redemption, whose authority cannot be inferred from an old dialog alone.
- Linking the new accounting ledger to resident statements/balances, invoice exports and any automatic late-fee assessment. No historical financial evidence was converted into balances.
- Certified disclosures and certified elections. Election preparation is restored; voting is deliberately deferred by the owner.
- Live role-by-role verification of every restored path, including resident privacy, actual file storage, rejection, stale updates, cancellation and refreshed Office/customer views.

The form inventory counts are static metadata, not a percentage of business completion. No live parity or browser QA is claimed.
