# Data model

[[Connected workflows]] adds typed per-actor messages and per-thread read cursors, generated synthetic media descriptors, and per-item garage review records tied to current item text/index. These default safely when reading older compatible workspace data. Garage edits invalidate prior item reviews. Supported content publication has a separate guarded local operation; financial/access/operational authority remains unavailable. None of these browser shapes substitutes for production relational models or RLS.

The later [[Feature baseline]] uses the existing version-1 workspace store: `kind: baseline`, module identifier and validated string metadata, local status and timestamped events. Thirty module definitions validate contacts, links, numeric bounds and time ordering; linked interests require an active local parent. CSV imports stage draft batches in one storage write after validation and local duplicate checks. These are local preview contracts, not normalized production tables, authorization or a financial ledger. Dates/currency strings in proposals are not official monetary postings.

**Observed** — Implemented preview shapes: invoice (integer centavos, due date, amount, recorded receipts), local service record (kind, title, detail, status, timestamp, optional date/category), sample profile, saved notice IDs, and local activity entries.

**Observed** — Financial aging subtracts receipts from invoices and measures actual UTC calendar-day differences between date-only due dates and the snapshot date. Due today is current. Age bands are a preview reporting convention, not approved HOA policy.

**Unknown** — Production schemas, identifiers, ownership rules and migrations have not been approved.

Proposed production entities, not implemented: profiles, households, properties, memberships, roles, role grants, page overrides, registrations, invoices, receipts, receipt allocations, credits, expenses, requests and events, amenities, booking requests, visitors, gate events, incidents, announcements, protected documents, marketplace listings, training enrollments, trips, election configuration/eligibility/ballots, invitation outbox, immutable audit events.

Money needs integer centavos or exact SQL numeric, not floating point. Payments, approvals and role changes must be server-owned. Household-scoped rows need RLS; protected files need equivalent storage policies. Ballot identity separation needs an approved secrecy design. See [[Roles and permissions]] and [[Product questions]].

## Planned entity groups

These are design candidates to specify per phase, not migrations or an approved schema. See [[Master implementation plan]].

| Group | Proposed records / integrity boundary |
| --- | --- |
| Identity and access | Profile, active/suspended state, role/capability grants, scoped overrides, registration review and invitation-outbox records; trusted session/membership checks |
| Registry | Properties, households, effective-dated memberships, vehicles and approved registry-change history; avoid conflating identity with ownership or dues liability |
| Finance | Billing configuration versions, issued invoices/lines, receipts, allocations, explicit credits/unapplied amounts, reversals, expenses and reconciliation entries; exact money and retained history |
| Operations | Requests, assignments, resident/internal messages, workflow events, evidence references and delivery jobs; approved state transitions |
| Amenities/security | Amenities and booking state/intervals, visitor requests/passes, gate events, vehicle reviews, incidents and permit applications/decisions; atomic conflicts/authorization |
| Community | Draft/published announcements, audience rules, approved document versions, private file metadata and notification jobs |
| Extensions | Listings/moderation, sessions/enrollments, routes/trips/seats and a separately reviewed election/eligibility/ballot model |
| Cross-cutting | Server-owned audit events, delivery attempts, operation idempotency and appropriate concurrency/version fields |

Database relationships and constraints must follow approved workflow/permission definitions. The election model needs its own secrecy design; do not implement a generic user-to-choice ballot table by default. The old schema export, if later provided, is evidence for review and never permission to connect to Kate’s environment.

**Observed** — [[Source coverage ledger]] now inventories the authorized GitHub snapshot: 50 root state properties, 64 static structure descriptions, 18 record-construction shapes and the limited registration SQL evidence. These include UI state, credential-related field names and whole-collection storage; they are not a 50-table production schema. Four table call sites and two browser RPC names do not establish their deployed definitions. Source data values, passwords and ballots were not migrated.


## Lot registry implementation (6 November 2026)

Migration 005 adds normalized lots, immutable original source evidence, effective-dated approved memberships, exact-cent receipts, per-membership receipt entitlements, private import stages/batches and server-owned audit events. Authenticated reads use field-limited functions with current membership/capability checks; raw browser tables are revoked. A name correction does not transfer access. Receipts are source evidence, not invoices or bank clearance. Read the operator instructions in docs/LOT-MIGRATION.md for provenance, recovery and known legacy-policy gaps. No real workbook values are in source; no live migration was performed.

## 6 November 2026 - customer workflow data

Migration 006 prepares private bfe_shuttles, bfe_shuttle_requests and bfe_shuttle_audit tables with no direct browser grants. The roster stores approved driver identity/display name, capacity, optional operational phone, enablement and approval reference. Driver-owned duty/presence is distinct from roster accreditation. Requests retain server timestamps, a fixed one-hour expiry, versioned sequential status, original serving-driver name, passenger count and private pickup/destination. All writes use validated RPCs and append server audit. Closed requests are retained; no legacy operational test records are imported. Shuttle events add recipient-scoped in-app notifications. Helpdesk Idea extends the established category constraint; no accounting ledger or payment allocation is invented. The agent has not installed this migration live.

## Protected feature services, 6 November 2026

Migrations 007-011 add private feature definitions/records/audit, facilities/bookings/audit, visitor passes/audit, and activity participation/audit. Raw browser table/sequence access is revoked and RLS enabled. Validated SECURITY DEFINER operations use an empty search path, current active roles and scoped permissions. Published projections omit source metadata and owner IDs and enforce audience/expiry/consent. Own/association histories are checked independently. See docs/FEATURE-SERVICES.md for installation and the exact remaining implementation gaps.

## Member inspection data, 6 November 2026

012 adds bfe_member_inspections (developer/target/client IDs, private support reason, fixed ten-minute expiry and ended timestamp) and bfe_member_inspection_audit (actor, session, Started/Viewed/Ended action, section and time). Session IDs remain in component memory. Published source/legacy data is not imported. Raw browser reads/writes are revoked; the owner can review these audit records separately. Read-only installation script scripts/verify-member-inspection.sql is tested locally and returns only counts/permission flags.
