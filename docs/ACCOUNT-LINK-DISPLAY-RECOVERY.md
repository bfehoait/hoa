# Account-link display and screen recovery

11 November 2026. The owner confirmed an approved household relationship, then reported crashes opening both an Office lot profile and the customer account.

## Screen crash

The supplied Console error reported that PropertyBusinessDetails.tsx did not provide a default export. The source file had the export, but an HTTP check against the local Vite server returned an empty JavaScript module. Restarting its transform cache by updating the watch configuration restored the real module. File watching now waits briefly for editor writes to settle before caching transformations.

The Office property editor is also loaded lazily only on Office property screens. Customer property pages no longer eagerly import this staff editor. The global recovery screen no longer calls every session a preview or claims that a prior save did not change an account.

Hard-refresh the affected tabs. The approved relationship does not need to be created again.

## Linked address on customer pages

Home and My account previously displayed only the recorded members.unit address text. Linking an approved property does not rewrite that field. They now prefer the caller's current approved property links, including household relationships, with the recorded address retained as a fallback.

Apply **supabase/migrations/202611110060_customer_linked_properties.sql**, once, after installed 059. This adds an argument-free, private read service and extends the authorized, audited account-preview read allowlist for exactly this service. It creates no links, edits no recorded addresses, and grants no ownership or historical receipt access.

The service returns only the current caller's approved, started, unexpired relationships to active imported properties, subject to existing property visibility. Staff viewing their customer summary do not receive association-wide property addresses. Multiple relationship types on one property are grouped into one address. Revoked links are excluded. Preview reads use the selected target and restore the developer identity afterwards.

After applying 060, hard-refresh the Office and customer tabs and open the linked account. Verify the address in Home and My account, then open its Properties list. A household relationship remains a household relationship; receipt entitlements and account balances retain their separate services.

## Verification performed

- Supplied error was traced to an empty module served by the local development server. Subsequent HTTP checks returned 200 and the expected default exports for the property editor, LotRegister, HouseholdAccount and HomeownerSummary. These were source-module checks, not browser automation.
- TypeScript/production build and targeted lint passed. Build retains dependency-annotation and bundle-size warnings.
- Isolated synthetic SQL checks compiled 060 and exercised own approved links, staff scope, revoked-link exclusion and the authorized preview target/identity restoration.
- No live database connection, migration application, real account changes, browser run or automated test suite was performed by the agent. Owner browser verification remains necessary.
