# Registration and amenities — 11 November 2026

Local implementation only. Owner requested SQL preparation. No live database connection, SQL application, Edge deployment, commit, push or publication occurred.

## Registration and Office

Shared editable numeric fields enforce Phase 1–3, Block 01–19 and Lot 001–111, with visible range guides and a mobile numeric keyboard. Non-digit edits are rejected; valid values are zero-padded on leaving the field (block `1` becomes `01`, lot `5` becomes `005`). Invalid ranges block native form submission and are also rejected by the shared schemas. Display/account payload use `1-01-005`; registration sends numeric parts and migration 066 constructs canonical `registrations.unit` server-side. Shared Zod validation also runs in the account Edge function. Residents require all three parts; staff may omit all three, but partial addresses are refused. Street remains optional supplementary information. Recorded address grants no property access.

Older valid `P1 B1 L5` or unpadded hyphenated application addresses populate the numeric fields. Unknown/out-of-range addresses require staff review. Historical database addresses are not rewritten.

The public submission inserts Pending into `public.registrations`; Office Registration Inbox reads the same table through `bfe_staff_directory`. The review summary counts Pending rows and links to `/office/registrations?status=Pending`. Permissions/filters still apply. Existing client/email/member/Auth matches intentionally receive the same public receipt without a second insertion. A received response alone does not prove a new Inbox row exists or create a sign-in account.

## Amenities source

Reviewed all three pages of the owner-supplied **BFE - Amenities Guidelines_As of October 21 2025.docx (1).pdf**. The PDF is not copied into the repository. Shared summaries in `packages/shared/src/amenity-guidelines.ts` are labelled with the guideline date.

| Facility | Philippine-time schedule | PDF capacity |
| --- | --- | --- |
| Function Hall / Clubhouse | 8 AM–10 PM; Sunday noon–5 PM reserved for Mass | Not specified |
| Basketball / Open court | Mon–Sat 7 AM–10 PM; Sunday 7 AM–noon | Not specified |
| Swimming pool | Tue–Sat 9 AM–9 PM; Sunday 7–11 AM; Monday maintenance | 40 people |

Displayed rates:

- Hall: daytime 9 hours ₱3,500 / 2 hours ₱1,000; nighttime 5 hours ₱3,000 / 2 hours ₱1,500; extension ₱500/hour; reservation fee ₱2,500; refundable bond ₱2,500.
- Court: exclusive sports ₱250/hour daytime or ₱300/hour nighttime, no sports bond listed; special functions ₱350/₱400 per hour with ₱2,500 refundable bond. Unit owners have 2 free daytime sports hours without electricity, subject to Office eligibility and same-day request except advance 7–9 AM booking.
- Pool: exclusive daytime 8 hours ₱5,000 / nighttime 5 hours ₱4,000; extension ₱1,000/hour; reservation fee and refundable bond each ₱2,500. Individual child/adult admission: daytime ₱80/₱100; nighttime ₱100/₱120.

Expandable rules cover water-bill verification, Office agreement/deposits, fee/date restrictions, setup/cleanup, damage liability/bond refund, adult supervision, prohibited activities, Sunday Mass, hall layout/extensions/pool exclusions, court equipment/attire and pool safety/hygiene/attire/containers/event layout.

Unresolved source details remain with Office: reservation fee credit toward rental, court day/night cutoff, child-price age band, Sunday pool packages and the five-hour night package versus 5:01–9 PM pool window (likewise 5:01–10 PM hall window). Package prices are reproduced as information, not calculated charges. No extension overrides closing. No hall/court capacity or free-use entitlement is invented. Behavioral rules, payments, individual admission and total on-site attendance require Office supervision.

Slots intersect configured hours/alignment with guideline windows, including the Sunday hall break. Pool input uses the lower of configured capacity and 40. Hall/court configured booking limits are distinguished from unspecified guideline capacity. Migration 067 enforces schedules/pool cap for Pending/Approved inserts and changes, including Office creation and approvals; cancellations/rejections remain possible. Existing identity, permission, duration, configured capacity, rate-limit and overlap checks remain.

Exact name aliases after trimming/lowercasing: Clubhouse / Function Hall; Basketball court / Open court; Swimming pool. Unrecognized names retain the previous 7 AM–10 PM guard and need review. No facility rows/configuration/fees are seeded or silently changed.

## Owner rollout

1. Confirm migrations through 065, including 063. Apply **066**, then **067**. Registration patch checks the reviewed 063 body and fails closed on differences; do not bypass the guard or replay old migrations.
2. Update the existing `bfe-create-account` Edge function from `docs/setup/bfe-create-account.editor.txt`, regenerated from canonical sources. Native Deno checking/deployment was not performed.
3. Run `scripts/verify-registration-amenity-readiness.sql` for read-only metadata/counts. It submits no application and configures no facilities.
4. Review names, configured hours, slots, duration, renter access, capacity and policy reference. Pool's full weekly envelope is 7 AM–9 PM; daily guards narrow this. Narrower existing configuration remains narrower. Configuration refuses changes with unresolved future reservations. Obtain hall/court capacity from the owner. Existing reservations are not retroactively cancelled by 067; review future conflicts before rollout.
5. Publish frontend through the normal authorized process. Favicon/PWA/Apple touch icons now use the existing Bellefort logo on a white square. Verify installed-device refresh; reinstall may be needed.

## Executed checks and limits

Frontend TypeScript and `git diff --check` passed. Local Chromium at 390/1440px checked registration options, canonical display, overflow and synthetic intercepted submission. Shared Office schema checked valid/invalid/optional staff cases and legacy conversion; guideline date calculations checked. Inspected mobile synthetic registration and 192px logo icon.

A synthetic browser component check also expanded the pool guideline and confirmed Sunday pool start slots before 11 AM are enabled while 11 AM and noon starts are disabled. This used a local fixture, not authenticated Office configuration.

Follow-up: replaced lot dropdowns with guided numeric text fields at the owner's request. This final input change was source-reviewed and TypeScript/whitespace checked; prior dropdown browser checks do not cover it. Owner should verify typing, non-digit rejection, empty/zero/out-of-range refusal, blur padding, mobile keyboard, optional staff address and successful submission in both forms. No additional migration or Edge update is needed for the input change.

Isolated PGlite applied actual 063/066 patches, checked bounds/fractional rejection/canonical lower and upper values/duplicate retry, and returned the Pending record through the actual Office directory function. Migration 067 compiled and checked valid boundaries, Sunday Mass/court/pool closures, Monday maintenance, early hall/pool use and the 40-person cap including updates. Role helpers were stubbed; this does not establish live Auth/RLS, migration state or access configuration.

Still required: authenticated Office account creation/approval, live public registration with a new synthetic email and Inbox row/count, filters/refresh/permission behavior, actual rollout, configured booking dates/rules and installed-device icons. No automated suites or axe sweep were run.
