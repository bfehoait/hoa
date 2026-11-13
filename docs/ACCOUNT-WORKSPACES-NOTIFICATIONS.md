# Account workspaces and notification destinations

Local implementation, 13 November 2026. No deployment, live SQL or browser verification performed.

## Approved workspaces

One sign-in account retains its server-assigned primary and additional roles. After normal sign-in, `/workspaces` offers a choice when more than one permitted workspace is available; a single permitted workspace opens directly. Homeowner/Renter, Office, Board of Directors, Security, Transport and Developer choices appear only when assigned and allowed by current module permissions. A permitted deep link after sign-in still opens its destination directly.

Resident screens now expose a workspace selector on phones and larger screens. Existing staff workspace selectors remain. Selecting a workspace changes navigation, never the member record, permissions or authentication. Public registration continues to offer Homeowner/Renter; it cannot grant Office or Board access. Office manages approved additional roles through the existing Roles & permissions workflow.

## My account and customer copy

The connected My account screen uses the member name as its main heading, with an account label, household role, profile action and linked address in a bordered identity card. Names wrap on narrow screens. The balance calculation and charge/payment rules are unchanged.

Connected Help & support now describes actual requests, bookings and workspace access. Customer-facing recovery, member, account, property and balance messages omit setup/migration instructions. Shared error feedback filters technical details on customer routes, including schema payloads and upload diagnostics; Office/Admin/Developer routes retain diagnostic error messages. Explicit developer previews keep their required synthetic-data disclosures and gated tools.

## Swimming pool

New booking choices exclude the legacy Clubhouse facility. Existing bookings retain their original facility names. Function Hall remains separate. The already prepared migration **068** retires the connected Clubhouse choice and reuses/creates the pool without moving historical bookings. Its existing safeguards stop on unresolved future Clubhouse bookings or an inactive pool needing review. Apply it only if not already installed. If there is no configured active pool, the frontend does not invent one.

No new duration, slot-size or reservation-frequency policy is introduced. Existing guideline restrictions remain; official facility configuration still needs Office review.

## Notification routing and SQL

Apply `supabase/migrations/202611130070_notification_destinations.sql` **after 069**, together with this frontend update. It is prepared for the owner to execute; it has not been executed locally or live in this pass.

The notification read service now resolves both historical and future events into destinations without rewriting notification history or changing read states:

| Event | Destination |
| --- | --- |
| Booking decision / Office booking creation | Exact owned booking |
| Visitor-pass decision | Exact owned pass |
| Helpdesk activity / assignment | Exact request through existing RLS |
| Submission / issuance / household application | Exact owned submission |
| Garage-sale item decision | Parent submission and its existing item details |
| Activity participation | Exact owned application, status, answers and history |
| Profile / account access | Profile or existing authorized access screen |
| Confirmed property link | My account |
| Accounting decision | Office Finance section |

Exact booking/pass/submission/application reads reuse the installed authorized dashboards, their current capability checks, serialization and owner filtering. A separate rank lookup locates records beyond the first page. Helpdesk reads filter by the requested UUID while retaining owner filtering, RLS and Office permission checks. Notification destinations accept only known internal paths and validated query parameters. Authorization still happens independently at route and server boundaries.

Record links mark the notification read after its subject loads. Missing or inaccessible records show a clear fallback and stay unread; users may explicitly mark them read. Links to sections use existing read-on-open behavior. A self-link back to Notifications is displayed as unavailable instead of creating a navigation loop. Existing saved notices and original booking names are retained.

## Owner browser acceptance

1. Sign in with a resident-only account: it opens directly. Sign in with an Office/Board member who also has a household role: only their approved workspaces appear. Check switching on a phone, direct links after sign-in and a denied workspace URL.
2. Check My account at narrow widths with a long name. Verify role and linked address, readable balance breakdown, profile action and existing payment/property navigation.
3. Check Help, recovery and unavailable-service messages as a resident. Ensure developer controls and setup details are absent; synthetic labels remain in an explicit preview.
4. After reviewing/applying 068 as needed, confirm new bookings offer Swimming pool and Function Hall separately. Historical Clubhouse bookings retain their original name. Review capacity, slot/duration and renter configuration; check the existing daily guideline restrictions.
5. After applying 070, open old and new notifications for a booking, visitor pass, submission, helpdesk reply and activity application. Include a record older than the first 20, an unavailable record, a revoked permission, the bell sheet, the full notification page and opening in a new tab. Confirm exact details, correct read state and working Close/Show all actions.
6. Check property-link/profile/accounting notifications open their corresponding section. Resident users must not gain Office Finance or other unassigned workspace access.

Frontend TypeScript checking, targeted ESLint and `git diff --check` passed. SQL was reviewed against the installed migration source but remains unexecuted. Automated suites, E2E, axe and browser checks were not run, per workspace rules.
