# Release acceptance

Status: **Planned gates — none is a record of a passed production test.**

**Observed** — Frontend preview verification is recorded in [[Verification]]. It does not establish database security, authentication, real-data correctness, delivery or production readiness. This note defines evidence required for future implementation phases in [[Master implementation plan]].

## Per-slice acceptance record

Record the approved scope/rules version, environment, source revision when available, synthetic fixture set, exact commands, counts/results, screenshots, failures and unresolved limits. “Documented”, “UI present” and “tested against the responsible backend” are different states. Do not mark a production slice done from screenshots alone.

For each implemented slice, demonstrate the allowed end-to-end operation and at least the relevant refusal, failure, retry and concurrency cases. Pair resident and office views where both participate. Confirm system state from the responsible service; an optimistic UI or timer does not prove a commit.

## Security and database refusal gates

| Actor / case | Required evidence |
| --- | --- |
| Anonymous | Cannot read member, registration, household finance, private document or incident data; only explicitly approved public operations allowed |
| Resident A vs resident B | Cannot read/write/export the other household’s private rows or obtain protected file links; cannot infer them through unrestricted aggregates |
| Resident / renter | Cannot set Paid, issue receipts, change roles, approve registration, issue passes/permits, or perform office actions without an independently approved capability |
| View-only or restricted extra-role account | Database/API refuses forbidden writes even when the UI is bypassed; combination behavior matches the approved matrix |
| Revoked / suspended / moved-out identity | Previously valid session/context loses the specified access; historical visibility matches approved membership policy |
| Security / driver / board | Only the approved fields, assigned work and scope are accessible; role label alone cannot expose unrelated finance or personal information |
| Privileged actor | Cannot delegate beyond approved authority, silently bypass mandatory audit or invoke protected operations with forged client roles |
| Storage / exports | File enumeration, unauthorized download links, stale access and cross-scope exports are refused; approved outputs preserve the correct scope |

Run tests against an actual authorized development database. Test migrations from empty to current and safe repeated migration-tool execution; verify constraints and transactional rollback. Add concurrency and idempotency tests for approvals, allocations and slot reservations. The unused `supabase/tests` placeholder is not evidence of any passing RLS test.

## Feature-specific gates

| Slice | Evidence required before production acceptance |
| --- | --- |
| Accounts | Session establishment/expiry/revocation; real logout; protected routing and data requests; safe recovery/invites; no private Query data left for the next user |
| Registration | Approval is atomic and retry-safe; an invitation-delivery failure does not undo or duplicate approval; review evidence and audit are correct |
| Registry | Verified source provenance; duplicate and transfer handling; effective-date access; no leak to a former occupant |
| Finance | Bills/receipts/allocations reconcile; part/overpayments and reversals preserve money/history; unknown bills never appear as zero; exports match source scope |
| Payment processing, if separately approved | Real test-provider integration; verified server events; duplicated/out-of-order/cancelled/failed events; refunds/reconciliation; browser success redirect cannot settle an invoice |
| Requests | Allowed assignments/transitions; internal/resident message separation; attachments and resolution permissions; notifications have separate delivery state |
| Amenities | Simultaneous overlap requests cannot create forbidden confirmed reservations; approved capacity/fees/cancellations and pending/confirmed distinctions |
| Security / permits | Expiry, revocation, guard authorization, repeated scans, restricted incident evidence and issued-document authority; agreed offline behavior |
| Community / documents | Audience and publication rules; document versions/private access; expired links; delivery retry and duplicate protection |
| Marketplace / training / transport | Approved moderation/consent, capacity/seat concurrency and cancellation; verified staff/provider/driver duties; minimum necessary data |
| Elections | Approved secrecy/eligibility/proxy design; repeat/concurrent vote handling; server counting, access separation and publication rules; audit does not disclose secret choices |

## UI and accessibility gates

Review each required state listed in [[Screen and interaction plan]]. Check at least 360px phone and 1280px desktop, light/dark, keyboard navigation, visible focus, readable body/secondary text, 48px controls, reduced motion and no horizontal page overflow. Also check the approved compact desktop layout at a laptop height and browser zoom; preserve navigation access on unusually short screens.

Run axe with the intended WCAG 2.2 AA scope and report actual findings. Test charts/calendars with keyboard and accessible alternatives, labels/errors, screen-reader reading order, modal focus, upload feedback, text scaling and the on-screen keyboard. Automated scans alone cannot close these gates.

Before calling a supported flow ready for residents, have 3–5 actual residents aged 60+ complete it unaided on their own phones. Record task success, where help was required and issues to fix without unnecessarily collecting personal data. Include staff/guard/driver task review for the workspaces in release scope.

## Operational and pilot gates

Agree monitoring, support and incident ownership. Verify backup protection, a restore exercise, release rollback, environment separation and credential handling. Confirm privacy/retention requirements through the responsible HOA review; do not label an implementation compliant merely because a plan mentions them.

Separate UI error, server rejection, successful commit and delivery failure in monitoring. Validate interrupted networks, retries and stale sessions without caching private records in the service worker. Establish approved recovery expectations and measure them rather than inventing service guarantees.

The pilot has a defined audience, supported functions and fallback to verified office procedures. No production data import or cutover is assumed. Resolve release-blocking security, correctness and usability defects before the responsible owner authorizes release; record accepted remaining limitations explicitly.

## Deployment and native gates

Commit, push, publication and store submission still require explicit authorization. Never deploy over Kate’s environment. Verify the selected host’s SPA/deep links, HTTPS, runtime configuration, private-data handling, service-worker update path and rollback.

Native distribution has its own decision and acceptance: supported platform build environment, separate native UI if Expo/React Native is chosen, signed builds, real Android/iOS device testing, permissions/privacy disclosures, notifications/deep links if used, publisher ownership and store review. A passing Vite build or installable web manifest is not a native-store acceptance result.
