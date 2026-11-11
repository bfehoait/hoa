# Resident access and onboarding follow-up — 9 November 2026

This note supersedes conflicting historical claims in the handoff and older
readiness assessments. It records local preparation, not a live installation.

## Resident service permissions

`202611090023_resident_service_access.sql` preserves the permission correction
the owner reported applying from chat on 7 November. Apply it after 022 when
bringing another environment up to date. Do not replay older migrations over
the owner-applied correction. The new migration replaces the latest
`bfe_legacy_can_for` definition, retaining the board-approved-summary grants.
It does not replace `bfe_can_for` or bypass configurable tab access.

Homeowner and renter roles receive `view` and `create` at `own` scope for
security and transport. These are module-level permissions: transport includes
the existing shuttle and carpool services. There is no new association-wide
read, approval, publication, management, export, or gate-entry authority.
Explicit denials and hidden/read-only rules continue to apply. Visitor-pass
creation still requires an approved, active lot membership. A typed profile
address does not create that membership. Existing records are not altered.

## Owner browser checks

Use directly signed-in accounts, not developer account preview. Use separate
browser profiles when switching accounts. Mark every check not performed as
unverified.

1. As a homeowner, open Visitor passes and Carpooling. Repeat as a renter.
   Verify the pages load and available submission controls match permissions.
2. A visitor-pass request without an approved lot link must be refused. After
   an authorized reviewer approves the correct link, submit a future visit.
   The result must await authorized review; it must not authorize gate entry.
3. As each resident, open `/office/residents`, `/office/registrations`,
   `/office/finance`, `/developer/access`, and `/security/gate` directly. They
   must be denied, unless the account has a separately authorized staff role
   and the corresponding grants.
4. Use two synthetic households in a test environment. A resident must not
   read the other's private visitor passes, requests, lot details, or receipts,
   including by changing record IDs. Published community content is separate.
5. For carpooling, use a published, unexpired future activity. A seat request
   must be pending until authorized confirmation. A resident must not publish
   the activity or confirm participation through staff endpoints.

These checks have not been performed in the deployed application by the agent.

## Facilities

`supabase/seed-test-configuration.sql` is now disabled by default. Its opt-in
setting is for an isolated test database only. Facility names explicitly start
with `SYNTHETIC TEST -`. No old rows are renamed or deleted by this change.
Existing unlabelled placeholder rows, if the owner previously inserted them,
need separate review. Do not run the seed on the resident-facing production
database. Use approved facility names, hours, capacities and policy references
through the existing configuration workflow for real operations.

An empty facility list blocks a successful booking; it does not prevent
checking the empty state, route access, or unrelated published calendar events.

## Registration: reuse the existing inbox

The authenticated `/office/registrations` page already reads applications via
`bfe_staff_directory`. `/register` still only gives office-contact instructions;
resident application submission and account onboarding are not implemented.
Do not create a parallel application table or open raw anonymous table writes.

Before implementing signup, the owner should run
`scripts/verify-registration-readiness.sql` and review the result. It returns
schema metadata only. This repository does not define the legacy registration
table in full, and live Auth/member triggers are not established by the local
test fixtures. Table existence alone does not establish safe signup behavior.

Required follow-up: confirm actual column types and constraints, inspect the
listed Auth/member/registration trigger functions privately, verify email
confirmation and signup settings, and establish server-owned application
review and activation. Signup must not make an applicant an active member or
grant lot, payment, staff, or developer authority. Use the existing Applications
inbox for review and the protected lot-membership workflow for household links.
An unreviewed applicant must be able to reach the application/status screen
without gaining resident or staff access. Account credentials must go through
Auth, never the registration record or application logs.

Registration remains unavailable until that backend contract is verified; no
new public signup control is presented as working in this change.

## Collections and assessment corrections

Authenticated Finance already renders `RecordedFinance` and `ReceiptPanel`;
Requests renders `RequestDesk`. Neither should be described as necessarily
fixture-backed based on the older role assessment. Recorded collections read
imported receipts; billing, balances, aging and reconciliation require separate
approved accounting sources. Live failure details remain unverified.

Existing automated tests contain some permission and household-isolation
checks. They are not proof of deployed browser behavior. No suites were run
for this follow-up under the owner's current working preference.

## Work boundaries

The workspace is a checkout of the committed rebuild on `bfehoait/hoa`.
`AGENTS.md` now reflects that fact and the owner's manual-browser/typecheck
workflow. No commit, push, deployment, live database connection or policy
decision is authorized merely by a handoff. Reference source remains read-only
and must not be executed or reused. Preserve unrelated work in progress.


## Manage access link

Migration `202611090024_exact_access_member_lookup.sql` extends the existing
access-manager-only picker with exact email matching and lookup-mode metadata.
Apply after 023; the owner must run this SQL before direct account opening works.
It does not expose user IDs through the record monitor or grant new privileges.
The existing editor opens only for one exact, uniquely linked result. Missing
accounts, duplicate emails and older endpoints show explicit messages.
The editor now opens in a focused side panel over the source table; group defaults and technical reference are outside that member flow. Save controls and the reason field stay in its footer. Unsaved changes require an explicit discard before closing.
No lookup submits or saves permissions. Manual name/unit selection remains
available. Owner browser verification is pending.
