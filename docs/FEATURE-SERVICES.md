# Feature services: installation and remaining work

Owner update: migrations 007–011 were reported installed. Do not rerun successful files. The next developer member-inspection feature uses a separate [migration 012 and setup guide](MEMBER-INSPECTION.md).

Prepared locally on 6 November 2026. This is a substantial wiring increment, **not complete production parity with every legacy feature**. No source code, designs, personal information, source policies, legacy test records or example election totals were imported. The agent did not connect to a live database, install SQL, commit or deploy.

The owner reported successful installation of migration 006 and the named shuttle expiry job (job ID 1). Successful scheduled executions still need to be checked in the Cron dashboard. Do not rerun 001-006 or the lot/receipt imports to install this increment.

## Install these files in order

Use the same owner-approved target, SQL Editor, **postgres** role. Review the files and have a current target backup before installation. Run each complete file once, including BEGIN and COMMIT, and wait for success before proceeding:

1. `supabase/migrations/202611060007_feature_records.sql` — private structured submissions, server validation for 32 project-owned form definitions (149 fields), review decisions, curated audience-controlled publications and notification updates.
2. `supabase/migrations/202611060008_facility_bookings.sql` — approved facility configuration, protected booking requests, occupied-slot checks, decisions and audit.
3. `supabase/migrations/202611060009_visitor_passes.sql` — verified-lot visitor requests, office decisions, authorized security entry/exit and audit.
4. `supabase/migrations/202611060010_workflow_history.sql` — restricted history for submissions, bookings and visitor passes.
5. `supabase/migrations/202611060011_activity_participation.sql` — capacity-controlled booth, workshop and private-carpool applications, decisions, withdrawals and activity cancellation handling.
6. Run `scripts/verify-feature-services.sql`. Expect 32 form definitions, 149 field definitions, 10 private tables and true operation/access-check flags. It returns counts and configuration checks, not personal records. This check does not prove that a particular user's permission assignment is correct.
7. Refresh the local application. There is no environment/key change for these migrations. Updating local files does not update a separately hosted deployment.

If a migration fails, save its error, run `ROLLBACK;`, and resolve the error before proceeding. A successful file should not be rerun. Do not remove constraints, bypass role checks or turn off RLS to make a form work. Nothing in these files seeds accounts, approval grants, facilities, official policies or financial transactions.

## Configure roles and try the workflows

The existing Developer access controls remain the place to assign approved, limited permissions. A committee label alone grants no action. Developer accounts already have protected configuration access, but a developer role alone cannot perform a driver action or record gate entry as security.

| Workflow | Entry point | Required setup / permissions |
| --- | --- | --- |
| Business, classifieds, jobs, garage sales, workshops | `/directory/market`, `/directory/learning`, `/explore` | Homeowners have existing livelihood own-view/create defaults. Renters require explicit grants where permitted. Staff need livelihood view/status/publish at association scope. |
| Announcements and events | `/community`, `/office/announcements`, `/explore/events` | Community create/view/status/publish at association scope for the authorized staff. Publication needs explicit submission consent, public text, audience and expiry. |
| Board records / candidate information | `/more/documents`, `/more/elections`, `/directory/governance` | Documents view/approved for readers and explicit association create/view/status/publish for custodians. Board membership alone does not grant confidential document access. Candidate publication does not certify eligibility or open voting. |
| General submission review | `/office/review` or `/office/operations` | Office route needs operations view/association. Each selected form independently requires its own module capability; access to the office route does not grant all review powers. |
| Facility setup and office decisions | `/office/calendar` | Calendar view/manage/approve at association scope. Configure name, same-day hours, slot minutes, maximum duration, capacity, renter access and an approved policy reference. Existing future reservations block policy edits. No official facility is assumed or preloaded. |
| Resident bookings | `/services/bookings` | Existing resident calendar view/create at own scope; approved active facility. Times are Philippine time. Pending bookings hold the slot. Rejection or resident cancellation releases it. |
| Resident visitor passes | `/services/visitors` | Explicit security view/create at own scope **and** an approved, unexpired lot membership in the active registry. Typing an address does not grant permission. |
| Visitor approval and gate events | `/office/visitors`, `/security/gate` | Security view/approve at association scope for approvers. Entry/exit additionally requires the actual security role and security status/association permission. There is no physical gate/RFID connection or guard-shift enforcement yet. |
| Booth/workshop/carpool participation | Links in the relevant published section, or `/explore/booth-applications`, `/explore/participation`, `/explore/carpool-interests` | Approved published future activity, visible audience, own-view/create capability (livelihood, or transport for carpools). Reviewers need that module's view/approve association permissions. Add `?view=review` for the office application view. |

For a publication, submit the form, choose Office review, start **In review**, and then choose **Published**. Write separate public title/body, select the audience, and give a future expiry within one year. Private metadata, source contact email, unit labels and submitting account IDs are never copied into the published projection. Include contact information in public text only when publication has been authorized. Actual photo/document upload is not implemented by a text field describing a file.

Participation is separate from publication: a pending application does not guarantee a place. Confirmation locks the activity and checks remaining capacity. A booth application takes one booth; workshop/carpool places are whole numbers. Withdrawals release confirmed capacity. Withdrawing a published activity closes its pending/confirmed applications and notifies the affected members. Payments and refunds are not processed by this workflow.

All saves use server-owned identities, timestamps and status transitions. Repeat submission IDs return the existing record only when details match. Version checks reject stale decisions. Backend errors never fall back to saving real submissions as local sample records. Synthetic preview mode continues to use its separately labelled local workflows.

## Acceptance checks before inviting testers

Use designated test accounts and synthetic details in the approved target:

1. Submit a business with all fields. Confirm another household cannot read its private submission. Publish curated text; confirm the permitted audience sees that text and no submitted fields. Withdraw and confirm publication disappears.
2. Configure a test facility from an approved test policy. Submit overlapping bookings from two resident accounts: only one must hold the slot. Check capacity, hours and slot alignment errors. Approve/reject with an authorized account; confirm residents cannot approve their own reservations.
3. Give a test resident the visitor permissions and a test approved lot relationship. Create a pass; verify a second household cannot see it. Approve through the office. Security must reject early/expired entry, and must recheck a revoked lot relationship or suspended resident. Record entry and exit with the actual authorized security account.
4. Publish a workshop with two places. Submit applications requesting two places and one place. Confirming the first must block confirmation of the second. Withdraw the first; the second can then be confirmed. Withdraw the activity and check application history/notifications.
5. Test permission revocation, a disconnected save and a retry. Verify history and that no duplicate record is created. Check the same forms on a phone.

Local PostgreSQL and browser checks use synthetic data and mocked `.invalid` authentication only. They do not establish successful installation, delivery of notifications to real users, hosted deployment readiness or live payment processing.

## What remains incomplete

These are actual remaining implementation boundaries, not features activated merely by running SQL:

| Area | Working now | Remaining work / approved inputs |
| --- | --- | --- |
| Property and household | Protected registry/claims from 005; saved household-change submissions | Household change approval must still apply through a dedicated protected household service; no generic Reviewed state changes ownership or household authority. |
| Finance | Imported receipt collections, Buyani handoff, server-saved expense/payment/budget/billing evidence submissions | Approved invoice and allocation model, ledger posting, chart of accounts/opening balances, expense approval/payment posting, actual accounting statements, reserves and bank reconciliation. Proposal review never marks a payment Paid. No balances are inferred from receipt gaps. |
| Elections | Restricted setup/nomination submissions and curated candidate information | Approved eligibility/proxy rules, frozen voter roll, private ballot service, tally verification and certified result publication. No votes/tallies are enabled or copied. |
| Security | Verified-lot visitor requests, time-limited approval, entry/exit audit | Materials gate passes, walk-in resident confirmation, vehicle/sticker register, visitor pattern review, incidents, OIC/guard-shift authority and physical devices remain separate work. Existing labelled sample screens are not production services. |
| Livelihood | Moderated content and capacity-controlled activity applications | Business verification badges, protected photo uploads, garage item-by-item decisions/address-release policy, booth-number assignment, job external-contact buttons and direct private carpool organizer decisions. Published text can carry approved details; generic form review does not implement these actions. |
| Messaging/files | Protected Helpdesk threads from 001-006; in-app review notifications and history | Office availability routing, conversations outside Helpdesk, secure file storage, virus/content scanning, retention/deletion jobs, email/SMS/push and call/GPS integrations. |
| Accounts/legacy access | Existing Auth, account and permission controls | Formal hardening of legacy broad tables/policies, privileged Auth invitations/deletion, backup/recovery and live permission acceptance. Do not connect source application code or shared source JSON to this rebuilt app. |

The legacy sample rates, late fees, renter policies, proxy rules, phone numbers and account names are not approved configuration. Original test records remain excluded. These remaining areas must be implemented and tested before describing the whole portal as production-ready.
