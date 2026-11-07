# Local database refusal tests

The suite now contains 27 PostgreSQL tests: the fifteen original request/module-monitoring cases below plus twelve committee-permission cases in permissions.test.ts. The latter execute migrations 001/002/003 and test exact action/scope grants, deny precedence, expiry/revocation, no self-provisioning, immutable provisioning audit and request read/write separation. No people are provisioned by the migrations; the 204 committee cells are nonpersonal planning metadata only. Legacy database policy hardening remains outstanding.

Run `npm.cmd test` to execute the versioned request migration in an embedded PGlite PostgreSQL instance with invented Auth/member rows. These tests never read `.env.local`, contact Supabase or import legacy records. The dev-only test dependency is not imported by the application bundle.

Fifteen tests cover resident/anonymous isolation, forbidden direct admin writes, idempotent submissions/replies, private thread reads, office-only transitions, stale-version refusal, developer monitoring without operational authority, revocation/duplicate membership and transaction rollback on invalid input. Module-monitoring tests also cover pagination, source allowlists, missing/empty sections, credential/proof/nested-field exclusion and election ballot exclusion. The suite uses simulated auth.uid() context and real PostgreSQL privileges/RLS; it does not reproduce Supabase's gateway/JWT verification, storage, actual mail delivery or multi-connection contention. It cannot certify the existing project's broader policies.

`202611050001_request_workflow.sql` is prepared locally, not applied by the agent. Real project acceptance still needs separate resident A/B/admin/developer accounts and direct API refusal checks after owner review and installation. Older legacy JSON requests are not automatically migrated. New release migrations and relevant refusal tests belong here; temporary inspection SQL remains in conversation at the user's request.

The future suite must prove: anonymous users cannot read registrations or member data; residents cannot read another household’s rows, alter roles, record payments, perform approvals, or invoke office RPCs; view-only restrictions and explicit overrides apply on the server. Registration approval, audit writes and invitation queue creation need transaction and idempotency tests. Election secrecy needs a separate approved design.

These local tests are not a production security certification. Database tests must become a required CI job before any production backend release.

Accounts follow-up: accounts.test.ts adds 13 local PostgreSQL tests for profile/notification isolation, pagination, read state, idempotency, explicit developer operations/grants, stale member changes and legacy-admin escalation/last-developer protection. There are now 40 SQL cases. npm test also includes the chart-palette regression guard in CI. No live database was contacted.
