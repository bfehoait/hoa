# Review details and pending-action badges

Prepared locally on 14 November 2026. The owner applies SQL and verifies the browser; no live database or deployment was performed.

## Detail presentation

Review inbox feature submissions show the existing conditionally visible fields directly in a compact labelled block. Optional listing photos and publication links still use ListingMedia and its signed-image reader. An absent optional photo/links no longer creates an empty section; errors and failed uploads remain visible. Record reference/history stay available, and Review submission is the primary action. Review handlers, reasons, publication audiences/consent and issuance remain unchanged.

## Installation

Run **supabase/migrations/202611140080_navigation_action_badges.sql** after the existing migrations through 079, then deploy the frontend. **No bfe-create-account Edge Function redeployment is needed for this change.** SQL adds only an authenticated read-only count endpoint. It neither approves records nor grants roles, tab access or decision authority.

## Count definitions

| Destination            | Badge scope                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Office / Review inbox  | Existing Office aggregate queues with can_decide, filtered by the shared approval-only predicate; pending plus in-review and existing issuance/relationship follow-up. Excludes Helpdesk and shuttle dispatch.                                                                    |
| Office / Helpdesk      | Existing actionable requests queues and feature queues mapped to the requests capability. Open/in-progress follow-up, separate from approvals.                                                                                                                                    |
| Security / Gate desk   | Existing association pass reader must authorize can_gate. Counts currently valid Approved passes with active owner/approved lot membership, plus Entered passes awaiting exit follow-up. A gate check is still required; this is neither occupancy nor an automatic arrival/exit. |
| Board / Shuttle review | Existing association Transport reviewer must authorize the dispatch reader; its exact total of active visible requests is used. This is oversight, not a new approval authority.                                                                                                  |
| Transport / Shuttle    | Active assigned driver only. Counts own active assigned rides plus current-day unexpired waiting requests only when the driver is available, ready, not busy and has capacity for that group.                                                                                     |

These counts are totals, not the length of a paginated response. No pending counts are invented for published-only documents, reports or election information. A role alone never bypasses the existing capability, hidden-tab or scope checks. A denied scope is omitted; a failed service shows counts unavailable, never a manufactured zero. Role previews and member inspection do not fetch real counts.

Navigation renders positive counts on accessible destinations (99+ for large counts); the workspace picker shows only workspace names, without a repeated total. View-only action destinations suppress action badges, while Board shuttle oversight can still display its authorized read count. Mobile bottom links use the same count data. One shared TanStack query polls every 30 seconds while active, refetches on focus/reconnect and invalidates after successful mutations. It does not replace server checks on opening a record or making a decision. No realtime delivery claim is made.

## Owner browser verification

After installing 080 and deploying the frontend, check each role with positive work, zero work and explicitly denied access. Confirm badge destinations open their existing queues; decisions update the badge, and another account's submission appears after the next refresh. For drivers, check on/off duty and assigned rides; for Security, check current Approved, future/expired Approved, Entered and withdrawn owner/lot access. Confirm preview/inspection makes no badge RPC. Check desktop/mobile and light/dark layouts, visible details and real photo/links/error states.

## Local checks

TypeScript, targeted ESLint, production Vite/PWA build and git diff --check passed. Prettier formatted the edited frontend files. Existing Zod annotation and map chunk-size build warnings remain. Migration 080 received static review only; no SQL execution, browser verification, automated suites, commit, push or deployment was performed.
