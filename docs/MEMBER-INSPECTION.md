# Developer member inspection

**Superseded interface:** the user clarified that they wanted the actual account screens. [ACCOUNT-PREVIEW.md](ACCOUNT-PREVIEW.md) describes migration 013 and the replacement one-click **Preview account** flow. Migration 012 remains installed for session/audit support; the old support-reason modal and inspection dashboard are no longer the `/developer/members` interface. Instructions below preserve the earlier implementation history.

Migration 012 adds **View member — read-only**. The existing role previews continue to use synthetic data. This feature is a dedicated support screen, not an authenticated login as another person or an exact rendering of every screen they see.

## Install and use

1. The owner reported migrations 007–011 installed successfully. Do not rerun them. In the same owner-approved target, SQL Editor as postgres, run the complete `supabase/migrations/202611060012_member_inspection.sql` once.
2. Run `scripts/verify-member-inspection.sql`. Expect `private_tables: 2`, `authenticated_endpoints: true` and `anonymous_blocked: true`. The authenticated endpoints independently require an active developer membership.
3. Refresh the local app and sign in with your developer account. Open **Developer → View member — read-only**, or `/developer/members`. There is also a link on **Role previews** and the desktop developer home.
4. Search for the member, select **View member**, and provide a support reason of 10–500 characters. The reason and member selection are recorded on the server. Do not put passwords or unnecessary sensitive details into the reason.
5. Inspect the member's recorded status, active roles, effective capability list and supported own-record sections. Select **Exit member view** when finished. The developer remains the authenticated actor throughout.

## Scope and safeguards

- Supports own Helpdesk requests, feature submissions, bookings, visitor passes, resident shuttle requests and activity applications. This is an inspection of supported own records, including historical records where included by the inspection endpoint; it is not the resident's daily Active Requests screen.
- It excludes private message bodies, files, credentials, receipts/financial entitlements, other households and shared staff/driver queues. It does not render every personalized portal page or publish a different user's session.
- The server checks the current developer role, session owner, expiry, unique target account and target's current permissions on every read. Inactive targets return no service capabilities/records. A role/grant revocation affects subsequent reads. Current permissions are reported; the browser cannot choose a target's role or grant itself permission.
- Every start, section read and explicit exit is audited. Sessions last ten minutes. Starting another inspection ends previous inspections for the same developer. Duplicate start IDs are idempotent only when member/reason match. Thirty starts per hour are allowed per developer.
- Session IDs stay in component memory; no member token/password is issued or persisted. No code rewrites `auth.uid()` or JWT claims. Regular mutations continue to run as the signed-in developer; this screen provides no member mutation controls.
- Leaving/reloading the page clears the local view; any server inspection not explicitly ended expires at its original deadline. If the exit request fails, the local view closes and reports that server closure was not confirmed. The automatic deadline remains in force.
- The browser hides cached records after a failed read or known expiry. Backend checks remain authoritative. Supported record data is not a substitute for authenticating as the member during an agreed end-to-end user acceptance session.

No target database connection or installation was performed by the agent. Local tests use synthetic identities, local PostgreSQL and mocked `.invalid` browser authentication. Owner installation and real-account permission acceptance remain separate.
