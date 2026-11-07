# Edge cases

**Observed** — Implemented states are distinct for due, overdue, paid, not-yet-billed, loading and failed overview data. Local storage corruption has a reset route. Write failures display an error without success. Forms validate input before persistence. Booking/visitor cancellation and request review operate on the requested local record.

**Planned** — Production failure scenarios: expired sessions, membership revoked mid-session, concurrent writes and booking conflicts, duplicate submissions, duplicate/reversed receipts, partial payments/credits, invitation delivery failure after committed approval, audit failure, file access expiry, disconnected clients, and election secrecy under authorized tallying.

**Risk** — Demo browser storage cannot prove row isolation, concurrency, secure audit, offline synchronization or transaction behavior. None is claimed. Actual test results belong in [[Verification]].


## Accounts and QA follow-up

Missing migration 004 shows unavailable account services without sample substitution. Profiles cannot set roles/unit/login identity. Notifications/read mutations are recipient-scoped. Duplicate profile/request/grant retries avoid duplicate side effects. Privileged member edits reject stale snapshots; revoked/expired assignments do not reactivate silently. Last-developer removal is refused. Busy account/request/access popups cannot close mid-save. Install preference storage failure must not block sign-in. Only legacy service-request In review states are normalized to In progress; document/registration review vocabulary is retained.


## Registry migration boundary

Identical reimports do not duplicate records. Changed evidence for an existing identity aborts atomically rather than overwriting. Source labels remain unverified; proposed charges and receipt-month counts are never bills. Independent approval is required for personal lot links and receipt entitlements. Expired/revoked links, suspended accounts and different-lot receipts fail closed. Recorded-name corrections retain original evidence and version checks and do not modify memberships. Unknown claim references return a neutral result. Withdrawal hides records originally created by a batch without deleting later corrections or audit history. Privately investigate missing OR namespaces or future reused references before importing another export.
