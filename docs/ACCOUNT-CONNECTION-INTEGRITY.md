# Account connection integrity

## Confirmed finding

The owner found one existing member without a user_id and one Auth user matching its email. This establishes a disconnected record, not the historical cause. The record must be reviewed and explicitly connected; creating a duplicate Auth account is not a repair. Roles on a disconnected member become effective when connected, so identity and existing privileges must be verified first.

## Prevention

Migration 025 already links new manually provisioned Auth users and members in one transaction. Migration 077 strengthens that workflow:

- Preflight checks the expected deferred linking trigger, and successful retries verify exactly one active, email-matching member with effective roles. An old creation receipt alone cannot produce success.
- New deferred integrity triggers inspect the final transaction state of Auth inserts and member writes. Portal-managed accounts must retain exactly one connected member and a creation receipt. A rejected integrity check rolls back the transaction; it does not silently repair or grant access.
- Existing authorized Auth deletion remains possible because the final Auth row is gone. Existing unconnected legacy records are not automatically claimed or scanned/rewritten.
- The Edge function and frontend require explicit server confirmation of member_linked before displaying success. Existing accounts are not overwritten, passwords are not reset, and retries do not create a second account.

The invariant is scoped to portal-managed accounts. Direct dashboard Auth creation without portal metadata is not a replacement for the Office creation flow. External SQL/import tools and legacy triggers must still be reviewed. No claim is made that these changes explain the affected record's history.

## Owner rollout

1. Run **077 after 075**. The local 076 diagnostic migration is optional and not required for this change. 077 rejects an unexpected account-preflight definition rather than overwriting it.
2. **Redeploy bfe-create-account** using the full regenerated `docs/setup/bfe-create-account.editor.txt`.
3. Deploy the matching frontend. If Edge/SQL is outdated, the new frontend refuses to show account-creation success; coordinate this rollout.
4. Privately review Step 1 of `docs/setup/repair-existing-account-connection.sql`, supply the selected member record ID, and verify the returned Auth identity and existing roles. Fill the explicit Auth UUID, member ID, review reference and confirmation in Step 2, then run that transaction. The script stops on missing/unconfirmed/ambiguous/changed records and makes no role changes. Never mass-link accounts by email.

The repair preserves the member, Auth password and roles and writes a database-owner audit entry. It does not approve a property relationship. Office can review/link the property after the sign-in connection is repaired. An unresolved managed account with no creation receipt requires further inspection; the script deliberately does not invent one.

## Owner acceptance checks

- Create a clearly synthetic permitted account in a staging project using Office; verify one Auth user, one connected member and one creation receipt, then sign in and verify only assigned access.
- Retry the same submission reference; verify one account and unchanged password. Duplicate email, unsupported privilege, missing setup and invalid phase inputs must not show success.
- In a staging transaction, disconnect or duplicate a portal-managed member and force deferred constraints; verify rollback. Verify authorized account deletion, suspension and ordinary member corrections still work.
- Review registration approval as well as direct creation, since both use the same Edge workflow.
- After the explicit legacy repair, confirm the same member has effective roles and that Office can open its property-link review. Use an independent approver; self-linking stays blocked.

Initial implementation validation was TypeScript/build, targeted lint, whitespace and static SQL review. The owner subsequently reported the explicit existing-account repairs working. This does not certify all new creation and deletion paths in production.

## Required regression check for future changes

Run `npm.cmd run check:account-integrity` when changing account creation, its confirmation protocol, triggers or deployment artifact generation. This command checks the generated Edge editor file against its canonical sources, then runs the focused local PostgreSQL tests. It does not regenerate files or access Supabase.

The ten tests execute the real 025 and 077 migrations with invented accounts in embedded PGlite. They cover atomic creation, repeat confirmation, unauthorized creation, refusing an existing disconnected member, a disabled linking trigger, disconnection, duplicate links, member-only deletion, combined Auth/member deletion, suspension and a stale creation receipt. A narrow synthetic developer policy isolates connection integrity; full permission semantics, Auth Admin HTTP behavior, deployed legacy triggers and multi-session concurrency require their own checks. The combined deletion case is not an end-to-end test of the deployed account-deletion service.

The existing CI test command discovers this test file. A separate CI step checks that the deployable editor file matches canonical sources. Changes to source/schema imports must regenerate the artifact, and release notes must state the required SQL, Edge and frontend deployment order. CI configuration only takes effect once the owner commits/pushes it; remote branch protection is not configured by this change.

AGENTS.md records this workflow as protected. No blanket guarantee against every future regression is possible; these checks make the important failures repeatable and visible. Live SQL/Edge runtime and owner browser acceptance remain separate from the local regressions.
