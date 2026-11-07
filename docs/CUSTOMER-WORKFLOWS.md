# Customer workflow installation and acceptance

Owner update: migration 006 and the named Cron job were reported installed successfully (job ID 1). Verify actual job runs in Cron; do not reinstall successful migrations. New feature wiring in migrations 007–011 has separate instructions in [FEATURE-SERVICES.md](FEATURE-SERVICES.md), including the exact remaining production gaps.

Prepared locally on 6 November 2026 after the user's assessment and implementation authorization. The agent has not connected to a live database, applied SQL, configured real drivers, committed, published or deployed. Existing lot/receipt data and excluded legacy test records are not imported, deleted or changed by this work.

## Install in the already approved target

1. Back up the target. Migrations 001-005 must already be installed; do not rerun them or the private workbook imports.
2. In SQL Editor as postgres, review and run the **complete** `supabase/migrations/202611060006_customer_workflows.sql` once. It adds private shuttle tables/functions/audit, private in-app shuttle notifications and the Helpdesk Idea category. It seeds no accounts, fleet, permissions or operational records. A failure rolls back the transaction; preserve the error and use `ROLLBACK;` before a corrected complete retry. Do not bypass constraints or RLS.
3. Enable Supabase Cron in the approved target, then run the complete `scripts/install-shuttle-expiry-job.sql` as postgres. It schedules only `bfe-shuttle-expiry` every minute. [Official Supabase Cron instructions](https://supabase.com/docs/guides/cron/quickstart). Verify that job runs succeed in the Cron dashboard. Running the job installer again updates the named job; it does not create a second differently named sweep.
4. Refresh the local app/tunnel. This does not update an independently hosted deployment. Install SQL and refresh clients together because notification/category schemas have changed.
5. Sign in with your real developer account and open **Shuttle service**, or `/driver/dispatch`. Choose **Manage authorized shuttles**. For each approved vehicle choose Shuttle 1, Shuttle 2 or Alternate Shuttle, an existing active driver account, its approved public driver display name, verified passenger capacity, optional approved operational phone in international `+` format, an authorization reference and the enabled checkbox. Never publish a personal phone without approval. Only explicitly driver-assigned active accounts appear in the selector; no role is created by configuring the roster.
6. Each authorized driver signs in, opens Shuttle and chooses **Go on duty**. Keep that page connected and foregrounded when taking requests. Duty presence refreshes every 30 seconds while the page is visible; after two minutes without a recent connection the server stops offering that driver for new submissions/acceptances. Going off duty requires resolving the current assignment. Roster edits reset duty, requiring the driver to opt in again. Configure actual service hours operationally; this release does not invent an official timetable.
7. Use the existing developer **Roles & committee access** screen to grant `transport / view / association` only to approved operator/BOD reviewers who should see private service history. Board role or a summary grant alone does not grant this access. Drivers see their assigned closed requests; approved association reviewers also see unassigned unserved cases. Developers can review/configure, but cannot progress a trip unless separately authorized as an active rostered driver.

The sweep persists expired outcomes, audit and in-app notifications even when no browser is open. Server read filters and mutation checks apply the exact arrival deadline independently of the sweep; the job's once-a-minute frequency does not allow late acceptance. Cron/push delivery are distinct: this implementation supplies in-app notifications, not SMS, email, browser push, GPS or in-app voice calling. A paused/unavailable database cannot operate a shuttle service; operational contacts and monitoring are still required.

## What changed

### Shuttle

Resident route `/more/transport`; driver routes `/driver` and `/driver/dispatch`; authorized board review `/board/shuttle`. Private carpools remain separate under `/directory/transport` and are not accredited shuttle offers.

One page contains today's requests, approved vehicle availability and, where authorized, a Service history view with an Outcome filter. No separate tab per status or vehicle. Shared community information is the fleet and waiting count. Residents get only their own request details. The server returns the necessary queue details to active rostered drivers and private history to explicit reviewers.

Immediate pickup requests only: Waiting for Shuttle is automatic. Driver actions progress Accepted -> On the way -> Arrived -> Confirm pickup. The recorded served outcome is Picked up, not Completed. Arrival does not claim boarding. A Passenger absent action becomes possible five minutes after recorded arrival and remains distinct from operator non-service. A resident may cancel only their own active request.

Closing a pickup request does not free its vehicle. The shuttle remains marked busy until its driver confirms **Ready for next pickup** once the vehicle is free and safely parked. Readiness is blocked while an unresolved assignment exists, and another acceptance is blocked until readiness is confirmed. This separates pickup service history from actual vehicle availability without reintroducing a Completed request status.

The server starts a 60-minute arrival deadline on creation; acceptance does not restart it. Waiting/accepted/on-the-way requests lapse at the deadline. They leave Active Requests and appear in authorized history as Lapsed / Unserved, with their original timestamps and reason. Arrived requests require explicit pickup/cancellation/no-show resolution, even if the hour subsequently passes. No automatic retry creates a second request.

The server uses Asia/Manila calendar dates. Older requests leave the resident Today queue. An unresolved prior-day assignment remains in its driver's view, and the owner gets a compact resolution/cancellation notice; neither can silently abandon an assignment or submit a duplicate. Active driver assignments are prioritized, then waiting requests are oldest first; history is newest first.

The server validates identities, capacity, duty/presence, expiry and status transitions. It locks assignment/roster changes, checks versions, prevents concurrent acceptance and multiple active driver/resident assignments, deduplicates creation retries and limits repeated submissions. Raw shuttle tables and audit have no browser write/read grants; narrowly scoped security-definer RPCs enforce access. The original serving driver's name is retained on the request after later roster edits. Capacity is owner-approved roster information; no capacity is seeded as an official value.

Calling uses the approved operational number via the device's telephone handler. Drivers should only respond when safely parked. A call does not create or resolve a request. Availability and the maximum wait do not guarantee a pickup time; no ETA is fabricated without an ETA source. This is not a vehicle tracker or emergency service.

### Helpdesk

One form and one conversation workflow at `/services/requests`, with staff review at `/office/requests`: Issue (HOA facilities), Complaint (neighbour matters), Concern (office/BOD/officer review), Idea (system/service improvements). Existing Document/Support categories remain valid for historical records. An Issue retains the established backend Maintenance value; only its user-facing label changes. Ideas require migration 006. The existing owner-scoped request thread, staff permissions, idempotency, audit and status protections remain in effect.

Private complaints do not enter a community feed. Authorized handlers must review routing; no unspecified officer or committee is automatically assigned/notified by category. This change does not certify the unrelated legacy portal_data policies or implement private file attachments.

### Finance and Buyani

Office finance has two main navigation choices: **Collections & AR** and **Reports**. Collections & AR groups Collected, AR Aging and Delinquency in a selector. Reports groups recorded collections, Balance Sheet, Income and Expense Statement, Budget vs Actual, Reserve Fund, AR Aging, Delinquency and Bank Reconciliation in one selector. Existing expenses/reconciliation deep links remain available; the duplicate Financial reports sidebar entry is removed. Preview accounting examples remain labelled synthetic.

Only receipt-based collections are connected to the imported real data. The other report entries are readiness states, not implemented accounting calculations or fabricated zero balances. Required inputs are listed in each view: approved invoices and allocations for AR; approved delinquency/dispute rules; ledger and opening balances for statements; approved budget/category mappings; reserve movements; bank statements and matches. These verified sources have not been supplied. Old test dues are excluded. Future accounting posting/calculation/import is still required before those reports can operate.

Your Account and individual lot overview offer **Pay your dues**, the supplied `https://pay.buyani.com/` destination, concise formatting instructions and Copy account number for a viewed lot. Format: BF{phase}-{three-digit block}-{three-digit lot}; Phase 1 / Block 19 / Lot 26 gives BF1-019-026. This is the user-specified provider format; actual provider account acceptance must be checked by the operator. Original imported agency identifiers/suffixes remain unchanged. No resident values are sent in URL parameters, and opening/returning from Buyani never marks a bill paid. This is an external payment handoff, not a gateway/webhook integration. No payment was submitted during testing.

## Pilot acceptance after installation

Use separate approved resident A/B, driver A/B, reviewer and developer accounts in the authorized environment. The following checks must pass through authenticated clients:

- No roster or off-duty/disconnected drivers: no false availability or silently accepted new request.
- Resident A cannot read/update B's details, change fleet/duty, or set driver statuses. Public viewers get counts/approved fleet only.
- Two drivers cannot claim one request; a driver cannot claim a second active request or exceed approved capacity. A developer/reviewer without the actual driver role/roster cannot progress it.
- At exactly 60 minutes without arrival, the request is absent from Active, late updates fail and history reports Lapsed / Unserved. The sweep records one outcome/notification only. Test with controlled staging timestamps, not by changing production financial or resident records.
- Arrival stays active until boarding/cancellation/no-show. Passenger absent is blocked before the five-minute grace. Prior-day unresolved assignments remain actionable by the assigned driver and privately cancellable by their owner.
- Pickup closes the request but keeps the shuttle busy. Only its rostered driver can confirm readiness, and another acceptance stays blocked until then.
- Cron runs with no browser open; notifications are recipient-scoped. Test disconnected/reconnected devices and suspended driver accounts. Drivers must safely stop before using controls.
- Helpdesk Idea saves and its thread remains invisible to another resident; staff action permissions remain separate from viewing. Complaint handling follows approved confidentiality rules.
- Mobile keyboard/focus/48px controls, narrow screens, light/dark contrast and reduced motion remain usable. Local automated checks do not replace older residents' real-device testing.
- Buyani displays the correct registered provider account before anyone pays. The portal never claims payment confirmation from an external-link click.
- Every unavailable finance report stays unavailable until its required approved source exists. Existing 921 lots / 4,314 receipt totals remain unchanged.

Live installation, actual account refusal tests, Cron delivery, real operational contacts, service hours, provider account validation and hosting acceptance remain operator work. Do not call the entire portal production-certified on the basis of local tests.
