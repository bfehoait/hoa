# Office member editing and property linking

Local implementation, 10 November 2026. No live records or hosting were changed by the agent.

## Owner installation

After successfully installed 045, run these complete files once, in order:

1. `supabase/migrations/202611100046_office_member_management.sql`
2. `supabase/migrations/202611100047_fulfillment_notification_routes.sql`

Then refresh the updated frontend. No Edge Function change is needed. Neither file creates a member, changes a contact, links a property, grants receipt access or approves a request on installation.

046 adds protected member workspace/detail-correction services, a private correction ledger and a member-bound wrapper around the existing 037 linking service. 047 corrects the notification destinations in the earlier 042/044 functions without replacing their approval logic or expanding the database notification allowlist. Those earlier destinations were not allowed by migration 006/the supplied live schema; an attempted issuance/application would otherwise roll back at notification insertion. Existing notification, permission and record checks stay enforced.

## Staff workflow

Open **Office → People & accounts → Members → View**.

- **Details → Edit details**: correct the recorded name, mobile number, address text or position. Enter a reason and use **Save changes** in the same window. The same label/value rows become editable in place, while email, roles/status and sign-in details remain visible. A persistent footer keeps Edit details and Refresh member visible while scrolling. During editing, Save changes and Cancel replace those actions; Save changes remains associated with the original form and its field validation. There is no second edit popup or separate review step; the server still records before/after history. Login email, roles, status and resident profile preferences are not edited here.
- **Properties → Link property**: enter phase, block and lot, check the candidate and recorded homeowner, choose the verified owner/renter/household relationship and enter an evidence reference. Confirm only after verification. The server creates/confirms the actual independently approved membership through 037.
- **Properties → Open lot & relationship review**: manage an existing relationship through the established Lot register workflow. Adding a relationship does not revoke a different property, transfer legal ownership or grant historical receipts.
- **History**: see paginated recorded-detail corrections with previous/new values, staff name, reason and time; see the latest 50 permitted property-link events. The full lot history remains in the Lot register.

The window stays open after a correction even if the corrected member no longer matches the directory search. The directory and affected workspace/property/auth/notification queries refresh after confirmation. On mobile this longer workspace uses the existing full-screen task presentation.

## Authority and record boundaries

- Reading the workspace requires an active account and People `view` at association scope.
- Correcting details requires People `view` and `manage` at association scope. Existing hidden/read-only restrictions remain authoritative. Ordinary staff cannot correct protected developer account details.
- Linking requires People `view`, Property `view/manage` at association scope, an active uniquely linked target account, and a different reviewer from the target. Missing or suspended sign-in accounts cannot be linked to property from this screen.
- Correction history requires People management or Audit viewing authority; property rows/history additionally require association Property viewing access. Raw correction tables are private.
- Recorded contact details, authentication identity and resident-maintained profile preferences remain separate. The window shows the preferences explicitly as a separate read-only section. Editing recorded address text does not create a property relationship.
- A full member snapshot protects corrections and Office linking against stale saves, including changes to name, contact fields, user ID, email, roles or status. Existing 037 checks independently protect the lot version and relationship review.
- Unlinked member records can have their recorded details corrected by authorized staff, but account creation/repair must be completed before property linking. This implementation does not reassign an Auth account based on a matching name or typed email.
- Identical correction retries create no second correction entry. Existing approved property links are reused. Linked members receive a notification; linked account corrections also create a concise account audit event without copying the old/new contact data into that broader audit stream.
- The recipient's member record refreshes through the existing focus/reconnect/60-second membership refresh. No instant cross-browser update or external email delivery is promised.

## Verification and owner checks

Seven isolated database tests use the established permission stack and the actual 005/037 link-review functions. They cover recorded-field corrections, profile/access preservation, safe retries, stale snapshots, invalid inputs, protected developer records, read-only restrictions, private tables/history pagination, real property linking and member-row binding.

Four household/application tests additionally include the actual notification route constraint. They reproduce the pre-047 rollback, verify the repaired issuance/household confirmations, check repeat installation, and retain independent approval and future-date safeguards. Identity/permissions in those isolated fixtures are synthetic; no production connection was used.

Synthetic browser interactions cover Chromium desktop/mobile and WebKit mobile: direct correction/save in one window, retention of the open window after search mismatch, phase/block/lot checking, verified linking, history, read-only controls and viewport bounds. This is browser-engine coverage, not physical iOS/Android certification. TypeScript and the production build passed. Existing dependency annotation/chunk-size warnings remain.

After installing both files, verify in your environment:

1. Use an authorized Office account to open a member, correct one approved detail with a reason, and confirm it appears in History and after refresh.
2. Use a second staff session to modify the same record while the first has an edit open. Confirm the stale change is refused.
3. Link a verified lot for another active account. Confirm the approved relationship appears both in this workspace and the member's property records. Check that a second lot is not silently removed and receipts are not automatically entitled.
4. Use a staff account limited to viewing. Confirm editing/linking is unavailable and direct mutation attempts are rejected by the server.
5. Confirm a permitted sticker/permit issuance and a reviewed household application now finish successfully and deliver their Notifications-page entry.

Do not create duplicate members or requests to work around an error. Keep the saved record and report the operation/error instead.


## No active property candidate

Check property searches the existing active imported Lot register; it does not create a lot from typed numbers. The no-match state provides a scoped Lot register link. For an owner-only diagnosis, use `scripts/verify-property-link-candidate.sql`: replace its three NULL inputs with the requested phase/block/lot and run the complete read-only script. It distinguishes a missing imported row, a withdrawn batch and inconsistent address mapping without returning names or account data. Do not assume the address is invalid from the no-match message alone. No new migration is required for the direct Save changes interaction.

### 11 November 2026: capture form values before pending state
Owner reported that the checked relationship and reference were rejected by property linking. Source review identified that PropertyLink passed its live HTML form to an asynchronous mutation, which read FormData after the pending render could disable its fieldset. Disabled controls are excluded, producing missing relationship/reference values despite visible input. Submission now snapshots FormData synchronously before onBusy/mutateAsync. Editing a linking field also clears the previous validation error.

The same live-form mutation pattern was corrected in accounting save/decision, household occupant, association/contact settings, property attributes, shuttle estimate, Helpdesk handling and garage-item save/decision forms. Server relationship validation, independent review, stale-record checks and permissions remain intact. Member expiry labels use the last query-refresh timestamp rather than Date.now during render.

Targeted ESLint and TypeScript checks passed. No automated test suite, browser run or live mutation was performed; owner should refresh and retry the existing property-link form. No new SQL migration is needed. Owner-supplied readiness output already reported all 25 checked service functions ready and all four metadata checks true; that metadata result does not establish browser workflow success.
### 11 November 2026: owner-approved household receipt policy and complaint form fix
Owner explicitly selected automatic visibility of all existing and future receipts for each current approved household link. Prepared migration 061 adds household-linked Finance view/own eligibility and extends the receipt predicate and optimized 036 history query. Active imports, active account, started/unexpired approved household membership, property visibility, configured access and explicit denials remain binding. Owner entitlements, approvals, exports and balance calculations remain separate. Overlapping owner entitlement/household access does not duplicate rows or totals. New history access is read dynamically; no receipts or memberships are seeded or modified on installation.

Customer Properties now labels the action Link another property when an approved own link exists. The complaint-screen crash was independently identified in the shared Field helper: a child array containing input/help text was cast to one element and child.props.id dereferenced. Field now locates the control safely, generates an ID where needed and associates labels/error descriptions while retaining helper children.

Checks: migration 061 compiled in isolated synthetic SQL; selected checks passed for past/new receipt visibility, unrelated lots, single-receipt/history agreement, export refusal, revoked/expired/future links, explicit Finance denial and duplicate-free overlapping paths. The actual Field function rendered locally with input/helper/error and generated-ID cases. No automated test suites, E2E browser runs or live database changes occurred. See docs/HOUSEHOLD-RECEIPT-ACCESS.md for rollout and owner verification. Owner must run 061 after installed 060, then refresh and verify live outcomes.