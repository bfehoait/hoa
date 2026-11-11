# Portal improvements — 6 November 2026

This list tracks the screenshots and requests received in this conversation. Work is local; no deployment or live database change is implied.

| ID | Request | Progress |
| --- | --- | --- |
| UI-01 | Clearer dues account example and Buyani button | Implemented; Buyani handoff regression passed |
| UI-02 | Compact member picker, useful search and missing-unit labels | Implemented; account preview regression passed |
| UI-03 | Consistent developer shell on Office and Community routes | Implemented; desktop and mobile browser checks passed |
| UI-04 | Stable sidebar group order and scrolling | Implemented; route transition preserves sidebar scroll in browser checks |
| UI-05 | Workflow toolbar hierarchy and less technical primary copy | Implemented: grouped toolbars, visual section controls, clearer page titles and optional technical details |
| UI-06 | Shuttle availability, tabs, summaries, request cards and empty states | Implemented; lifecycle and history regression passed |
| ACCESS-01 | Per-person tabs: hidden, view-only, edit; editable role/committee defaults; designated admin management | Implemented locally; migration 014 installation required |
| MARKET-01 | Homeowner listings, approval before member publication, links and cover pictures | Implemented locally; migration 015 installation and actual Storage smoke test required |
| BOOK-01 | Facility/date/time picker, occupied slots disabled, conflicts prevented | Implemented; reserved-slot selection and server overlap checks passed |
| BOOK-02 | Keep booking identity private from other residents | Existing availability response exposes times only; preserve this boundary |

Recommended marketplace structure: business directory, buy/sell/services, jobs, garage sales, workshops and booth events. Use one cover image initially, explicit contact-publication choices, a moderation queue, and review again after changes. No invented HOA policy or reference application design is copied.

See [setup and operating instructions](UI-ACCESS-MEDIA-SETUP.md). No new official facility hours, fees or committee powers are assumed. Existing baseline permissions remain until deliberately configured. Publication and approval are separate permissions from ordinary editing. Legacy policy hardening and real Storage delivery are not claimed complete by local browser mocks.

## Follow-up: preview overlap and booking/marketplace entry

- UI-07: Account-preview sidebar now follows the measured banner height, including wrapped names and viewport changes.
- BOOK-03: Booking dialog uses a wider desktop calendar/time layout and the native date picker on narrow devices. Facility/date changes clear times; reopening starts a fresh form; invalid/reserved intervals cannot be submitted. Clear-time and range feedback improve selection.
- BOOK-04: Empty/unavailable facilities show setup guidance instead of opening an unusable form. Authorized staff can open facility setup. Empty lists hide pagination.
- MARKET-02: Developer monitoring now links to the actual marketplace posting/review workspace, retaining the booth-event section. Admin/developer route access to that workspace is corrected without granting household finance access or bypassing server permissions.
- UI-08: Connected booking/marketplace pages use the account-record data label; read-only preview explains that real submissions require direct sign-in.

No new migration is required for this follow-up. The owner reported that 014–015 installation verification returned the expected three private tables, five Storage guards and true flags. Actual facilities/hours must still be configured by authorized staff.

## Follow-up: action hierarchy and dialog chrome (7 November 2026)

Reported: buttons look inconsistent across tabs, and dialogs read poorly on
both phone and desktop. No migration is required for any of this work.

- UI-09: One action vocabulary. `Button` now takes a `tone` of `primary`,
  `secondary`, `danger` or `quiet`, and a new `ButtonLink` gives a destination
  the same shape. Before this there was no vocabulary for "link that acts like
  a button", so screens improvised and visual weight stopped matching
  importance. The existing `secondary` boolean still works, so the 43 call
  sites using it were not disturbed. `tone` wins when both are set.
- UI-10: Sign out was the weakest control on screens where it was the most
  consequential one — a bare text link beside bordered buttons. It now carries
  the `danger` tone in the developer console, both auth gates, the member
  profile and the More hub.
- UI-11: Developer console actions. "Open audit monitoring" and "Back to home"
  shared one class and therefore one weight, although one is a page's next step
  and the other is shell navigation. The audit action is now primary and moved
  into the empty state it answers, instead of floating above an unrelated card.
- UI-12: `ActionLink` used a hardcoded 12px corner against the 8px token, so
  two bordered actions on one screen curved differently. It now uses
  `--radius-sm`.
- UI-13: Dialog actions are reachable. `Modal` accepts a `footer` that sits
  outside the scroll area, and a `.form-actions` row inside any dialog body is
  pinned to the bottom edge at every width. Previously that pinning existed
  only below 767px, so on desktop a long form could scroll its confirm step out
  of view. This covers all 23 dialogs without restating it in each one.
- UI-14: Dialog focus no longer opens on Close. The dialog container takes
  focus, so the title is announced first and the first keypress is not aimed at
  the dismiss control.
- UI-15: Dialog chrome. The description moved into the header so it stays
  visible while the body scrolls, the phone sheet gained the drag handle its
  bottom-sheet shape implies, and a first child's own top margin no longer
  stacks on the body padding — that stacking opened a dead band across every
  dialog leading with a list.
- UI-16: `--red-line` token added for both themes so the danger tone has a
  border that is not reused from an unrelated scale. The first value chosen was
  a soft tint that measured 1.57:1 against the surface, leaving the control with
  no perceivable edge; it is now 3.75:1 in light and 3.65:1 in dark, clearing
  WCAG 1.4.11 and sitting at the same weight as the existing `--line-strong`
  (3.18:1 and 4.69:1). Danger text measures 5.81:1 and 7.50:1 on its own fill.

Size variants keep a 48px target. A `small` action reduces padding and type
only, because the working rules require the target regardless of visual weight.

- UI-17: Disclosure targets. A native `<summary>` renders about 25px tall, and
  15 of them across the app carried no sizing, so nearly every disclosure was
  under the 48px minimum. `/office/access` alone reported seven targets at
  24.8px. The convention already existed as `.source-details summary`; it is now
  a base element rule at the lowest specificity, so any module that styles its
  own summary still wins.

Verified: typecheck, ESLint and `vite build` pass, and 257 unit tests across 21
files pass. An axe scan of an open dialog at 390px and 1440px in light and dark
returned zero WCAG 2.1 AA violations, with focus confirmed on the dialog rather
than its close button. Danger-tone contrast measures 5.81:1 and 7.50:1 for text
and 3.75:1 and 3.65:1 for its border.

Browser suite (chromium): 62 passed, 14 failed, from 57 passed and 19 failed
before this work. A set comparison of the two runs shows five tests fixed and
none newly broken. One of the five was a regression this work caused: the
dialog focus test asserted that opening focuses the close button, which is the
behaviour UI-14 deliberately changed, so that test now asserts the stronger
property instead — focus inside the dialog, never on the dismiss control,
contained through tabbing, and restored to the trigger on Escape. Its stale
"Save preview request" assertion was removed because that control cannot appear
on that route.

The remaining 14 failures were not introduced here and are not fixed here. They
are tests written against an earlier UI. The largest cluster follows from
`Services.tsx` returning the connected `RequestDesk` for `/services/requests`,
which makes the preview form's "A short title" field and the
"Streetlight near Block 08" fixture unreachable on that route. Others wait on
"Report a concern", "Synthetic old review" and "Sample community ride requests",
none of which exist in the source, and `/explore` now exposes two `role="status"`
regions that an assertion does not disambiguate. These deserve a dedicated pass;
rewriting them to match current behaviour without that review risks masking a
real regression.

Authenticated-mode screens were checked by typecheck and lint only; the local
preview renders different components for those routes, so they were not
visually confirmed here.

## Follow-up: account services without local sample fallbacks (7 November 2026)

- UI-18: Authenticated home/services use member identity and permitted destinations, without sample balances, activity or a hardcoded announcement count.
- UI-19: Unfinished services show Not available yet; existing access restrictions remain authoritative. Legacy workspaces cannot silently render sample records after login.
- UI-20: Local sample query and mutation hooks reject normal account use. Developer roles open actual access management; authenticated role-simulation URLs are unavailable. Actual account preview remains read-only.
- UI-21: Release builds always select authenticated mode. Explicit local development samples remain isolated and labelled.

Typecheck/lint/build and 304 unit tests passed. Eighteen focused browser cases passed across Chromium/mobile WebKit using synthetic API mocks; no live service certification or full-browser-suite pass is claimed. No new migration or database cleanup was performed. See AUTHENTICATED-SERVICES.md for scope and remaining release checks.

## Follow-up: member-first access and working service navigation (7 November 2026)

- UI-22: Reused AccessManager and TabAccess: one searchable member list; selecting
  a name opens their Read/Edit matrix, scoped rules, explicit reason/save and the
  existing roles/status/committee controls. Role and committee defaults have a
  separate disclosure. Inherited access is mixed, not falsely shown as granted.
- UI-23: Reworked the existing Shuttle screen with vehicle availability selection,
  pickup/destination and a truthful trip-progress timeline. Existing RPCs and
  lifecycle controls remain; no decorative map, fake ETA or extra subsystem.
- UI-24: ModuleMonitor uses View details and links to existing operational pages.
  Announcements has a direct Create announcement entry into the existing review
  workflow. Permission refusal and unsupported legacy editing are explicit.

No reference code/assets were reused, no backend was connected and no SQL was
added. Current validation and limitations are in the dated Verification vault entry.

## Permission state clarity (7 November 2026)

- UI-25 supersedes the mixed/dash controls in UI-22. Current server-reported access
  is separate from labelled native radio choices: Use defaults, No access, Read
  only, Read & edit. The selected rule has a checkmark and visible border. Partial
  editing rights name the allowed/blocked actions; unknown access says Not reported.
- Unsaved selections remain marked and do not change current-access labels. Returning
  to the saved selection clears the draft. The save bar appears only for a draft.
- Prepared 016 extends the existing manager-only read with effective capabilities;
  it changes no account rules or grants. Older servers remain usable with explicit
  missing-summary guidance. The existing verification script checks installation.

309 unit tests, typecheck, lint and build passed. Six focused browser cases passed
across Chromium/mobile WebKit, including keyboard selection, denial recovery,
older-server fallback and group defaults. Screenshots and axe were checked at
390/1440 in both themes. No live backend was connected; 016 was not applied live.

## Labelled permission toggles and developer posting (7 November 2026)

- UI-26: Replaced UI-25's radio appearance with the requested labelled On/Off
  switches for No access, Read only and Read & edit. Only one level is on at a
  time; switching it off restores defaults. Use defaults remains separate and
  visibly selected. Current server permissions remain separate from draft rules.
- UI-27: Developer overview links to existing announcement creation and the
  submission/review workspace. Tests use developer-only accounts, rather than
  relying on an added admin role. No duplicate forms, new authority rules or
  migration beyond 016 were introduced. Unsupported legacy editing stays unavailable.

See the latest Verification vault append for measured checks and limitations.

## UI-18 — Access toggle finished (7 November 2026)

Continued the Codex toggle work in `features/developer/TabAccess`. What Codex
delivered was sound: the box is gone (`.ruleChoice` is borderless and transparent),
the control is a rounded track with a circular knob, `role="switch"` carries the
state, and each option has a plain-language hint — "Hide this tab and block
changes", "View records without changing them", "View, create and update records".
Typecheck, lint and 313 unit tests were already clean.

Four defects fixed on top:

1. **No reduced-motion guard.** The 160ms knob transform ran unconditionally,
   against the AGENTS.md mandate. Now wrapped in
   `@media (prefers-reduced-motion: no-preference)`.
2. **Off-state border failed WCAG 1.4.11.** Measured `--line-strong` on `--wash`
   at **2.77:1** in light mode, under the 3:1 a control boundary needs. The track
   fill is 1.15:1 against the surface, so that border was the only edge the control
   had. Changed to `--muted`: 5.86:1 light, 7.30:1 dark, and it matches the knob.
   Dark mode had already passed at 4.09:1 — light mode alone was failing.
3. **Visible hint marked `aria-hidden="true"`** while also being the
   `aria-describedby` target. Contradictory; the explicit `aria-label` on the input
   already prevented double-reading. Removed.
4. **Magic radii** (12px, 5px, 4px) replaced with `--radius-lg` / `--radius-sm`.

### Not verified

**The toggles were never seen rendered.** `/office/access` and `/developer/access`
show the synthetic placeholder in preview mode — "Real account permissions are not
loaded here" — so the matrix only exists in authenticated mode. Screenshots at
390px and 1440px in both themes found **0 elements with `role="switch"`**, and axe
reported 0 violations on a page that does not contain the control. Contrast above
is computed from tokens, not sampled from pixels. Geometry, hit area and the knob
animation remain unconfirmed; they need a pass in authenticated mode.

## UI-19 — Homeowner summary restored on the signed-in home (7 November 2026)

Removing the sample data also removed the household summary, leaving the
signed-in home as a bare list of service links. New
`features/home/HomeownerSummary.tsx` restores it for `area="home"` in
`ConnectedHome`, reusing `Home.module.css` so the connected and preview homes
look the same.

- **Balance shows ₱0.00**, not the old synthetic ₱1,800. Billing has no
  connected server source (no invoice RPC exists; `bfe_lot_receipts` records
  payments, not charges), so the figure is a real zero and the card says
  "No charges are recorded in your account yet" with the footnote "Billing is
  not connected yet · this is not a bill". Nothing claims a bill was issued or
  settled.
- **Shortcuts are permission-filtered** through `canOpenPath` and
  `permissions.allowsPath`, so a resident only sees tiles they may open. The
  grid is hidden entirely when none are allowed.
- No fixture import, so the signed-in build stays free of sample data.

Verified: tsc, ESLint, Vitest 315/315 across 22 files, vite build (85 precache
entries). Not visually confirmed: the authenticated home does not render in
preview mode.

## UI-20 — Vehicles and permits connected (7 November 2026)

Both are request-and-approve workflows with the same shape as gate passes, so
they reuse the feature-record machinery (submit, review, audit, notifications,
workflow history) instead of adding tables or endpoints. Migration
`202611070018_vehicle_and_permit_requests.sql` inserts the two definitions with
`resident_create=true` and capability `property`; no schema change.

- **Vehicles & stickers** — new/renew/replace/remove, plate, type, make, colour,
  unit, owner. Conditional: driver (household member or tenant), company
  (company-owned), lost report (replacement only).
- **Permits & clearances** — construction/renovation/move-in/move-out/other,
  unit, dates. Conditional: scope and contractor and worker count (construction
  or renovation), mover (move-in or move-out).
- New `features/connected/ResidentFeature.tsx` renders one workflow as a
  resident sees it; review and approval stay office-only and server-enforced.
- Removed both from the `unavailableService` list and updated the home tiles.
- Fees, sticker numbers and required documents are deliberately absent; they are
  association policy and stay unavailable until supplied.

Evidence line numbers for both modules were read from the reference file rather
than invented: vehicles 2782/2808/5178/7913/8114, permits 1040/1079/3170/6054.

Verified: tsc, ESLint, Vitest 315/315 across 22 files (the SQL suite runs the new
migration under PGlite and confirms the stored definitions match the TypeScript),
vite build 86 precache entries.

### Still not connected

- **Calendar** — `/services/calendar` currently renders the same bookings desk as
  `/services/bookings`, so enabling it would duplicate a screen rather than add
  one. A real calendar means merging `bfe_booking_dashboard` with published
  `events` records into a month view. No migration needed; both endpoints exist.
- **Settings** — no table and no endpoint.
- **Billing** — no invoice table anywhere. `bfe_lot_receipts` records payments
  made, never charges owed, which is why the home balance is a real zero.
  Needs association rates and policy before it can be built.

## UI-21 — Community calendar built (7 November 2026)

`/services/calendar` previously routed to `OperationsDesk kind="booking"`, which
renders "Facility bookings" — the same screen as `/services/bookings` under a
second name. Un-blacklisting it would have duplicated a screen, not added one.

New `features/connected/CommunityCalendar.tsx` is a real month view combining
two sources that already carry their own authorization:

- the household's facility bookings (`bfe_booking_dashboard`), excluding
  cancelled and rejected ones;
- community events the office has published (`bfe_feature_dashboard` on the
  `events` module, published view).

Published records deliberately expose only curated public text, so an event had
no date and could not be placed on a calendar. Migration
`202611070019_published_event_dates.sql` widens that projection by exactly four
keys — date, start, end, venue — and only for the `events` module. The `fields`
key is still absent entirely for every other module, so the existing test that
published rows never carry private fields still passes unchanged.

Dates and times render in Asia/Manila through `Intl`, not by string slicing.
Today is marked. On phones the grid becomes a single column and empty days are
hidden, so the month does not become a wall of blank cells. A legend
distinguishes bookings from events, so the two are not told apart by colour
alone.

Verified: tsc, ESLint, Vitest 315/315 across 22 files, vite build 87 precache
entries. Not visually confirmed — the connected calendar does not render in
preview mode.

## UI-22 — Complaints were unreachable; modal and calendar work (7 November 2026)

**The owner could not find how to file a complaint.** Investigation found two
parallel systems for the same thing:

- `bfe_requests` (Helpdesk) already accepts categories Maintenance / Complaint /
  Concern / Document / Support. Complaints worked — but the only entry point was
  a button labelled "New request" whose category dropdown defaults to "Issue".
- The `complaints` and `concerns` feature-record modules are a second
  implementation, linked nowhere outside the developer workbench.

Fixed the discoverability rather than adding a third path:

- `?new=<category>` now maps any helpdesk category, not just `concern`.
- New "Raise it with the office" group in the More hub: File a complaint, Raise
  a concern, Report an issue, Your requests — each deep-linking to the Helpdesk
  with the category pre-selected.

**Open question for the owner:** `complaints`/`concerns` feature modules
duplicate the Helpdesk. Migration 017 set `resident_create=true` on them. They
should probably be office-only, or the Helpdesk categories retired. Left as-is
pending that decision rather than changed silently.

### Also in this pass

- **Calendar and facility bookings merged** at the owner's suggestion. One
  screen: month view above, booking desk below. Both routes render it.
- **Dialog double scrollbar** — body and dialog both scrolled. `.dialog` is now
  `overflow: hidden`.
- **"Required" stacked under every label** — `.form label` is a grid, so the tag
  became its own row. Now inline beside the label.
- **Dialog width** 640 → 720px default, 920px for submission forms, two columns
  at ≥900px with textareas spanning. Phone layout unchanged.
- Removed a stray bullet from the household balance card.

Verified: tsc, ESLint, Vitest 315/315, vite build 88 precache entries. The
homeowner summary, vehicle form and calendar were confirmed rendering in
authenticated mode from owner screenshots — the first visual confirmation in
this project.

## UI-23 — Record card, and a conditional-field bug it exposed (7 November 2026)

The owner submitted a real Construction permit and the record card listed
**"Moving company or crew — Not supplied"**. That field is hidden for
Construction, so the card was reporting an omission for a question nobody was
ever asked. The card mapped `definition.fields` directly; it now filters through
`fieldVisible` using the record's own answers, matching the form and the server.

Card redesign:

- Grid layout with `.card > * { margin-block: 0 }` — the same non-collapsing
  margin problem fixed earlier in the forms.
- Header row pairs the status badge with the submission date (Asia/Manila via
  `Intl`, not string slicing).
- Title and detail get a real hierarchy instead of a default `h2` and `p`.
- "Record reference" and "Submitted fields" were rendering as full-width
  bordered rows that read like headings. They are now quiet disclosures with a
  top rule; the reference UUID is monospaced and muted.
- Submitted fields render as cards on `--wash` rather than a bare list.

Verified: tsc, ESLint, Vitest 315/315, vite build 88 precache entries.

## UI-24 — Settings built; facility and shuttle configuration (7 November 2026)

**Settings** (`/more/settings`) was listed unavailable and had no screen for a
signed-in account. New `features/more/Settings.tsx`, using endpoints that
already existed:

- **Appearance** — a light/dark switch writing the same `bellefort-theme` key
  and `documentElement.dataset.theme` the app already uses, so it agrees with
  the header toggle rather than competing with it. Stated plainly as a
  per-device preference, because that is what localStorage is.
- **Contact details** — display name, phone and bio through `bfe_save_profile`,
  which validates server side. The page says that name-on-record and unit are
  office-set, so nobody expects to change them here.
- **Notifications** — explains that per-notification preferences do not exist
  yet rather than showing switches that do nothing.

Inputs carry `type`, `inputMode`, `autoComplete` and `enterKeyHint`, which the
UX review found missing on 85 of 95 inputs app-wide. The switch reuses the
access-toggle reasoning: `--muted` border for WCAG 1.4.11, reduced-motion guard
on the knob.

The preview keeps its existing state gallery at the same path; only signed-in
accounts get the real screen.

**Facility and shuttle configuration** is `supabase/seed-test-configuration.sql`
— deliberately not a migration. Every value in it is a placeholder, labelled
`TEST CONFIGURATION` in the policy/approval reference so it is visible as such
in the database and in the app. Hours, capacities and rosters are association
decisions. The shuttle block is commented out because it needs a driver account
that does not exist yet.

**Billing remains unbuilt.** There is no invoice table in nineteen migrations,
and building one means defining dues rates, billing periods and how payments
allocate against charges — association policy, not a coding decision. The home
balance stays an honest zero until that exists.

Verified: tsc, ESLint, Vitest 315/315, vite build 88 precache entries.

## UI-25 — Office finance was serving synthetic money to real accounts (7 Nov 2026)

The role readiness assessment flagged `/office/finance` and `/office/requests`
as allowlisted but routed to fixture-backed components. Confirmed, and the
finance case was the more serious of the two.

`features/admin/Admin.tsx` builds `ledger`, `total`, `collected`, `remaining`,
`buckets` and `pct` as **module-level constants from `data/fixtures`**. There is
no preview branch in that file. So a signed-in office account opening
`/office/finance` saw fabricated collection totals, an aging breakdown and a
collection percentage rendered as association finance, with only a small error
notice at the foot of the page where the live data would have gone.
`office/FinanceReports.tsx` is the same — `buildFinanceReport(householdLedger…)`
— and `/office/finance/reports` was allowlisted too.

The figures carry "Sample ledger" labels, so this was not undisclosed. But a
synthetic collection rate on a production office screen is the kind of number
that gets screenshotted and repeated, and there is no invoice table behind it.

Fixed:

- **`/office/requests`** now renders `RequestDesk office` for signed-in staff —
  a connected view of `bfe_requests` that already existed and was simply not
  wired here. The fixture-backed Admin stays for preview.
- **`/office/finance` and `/office/finance/reports`** are now marked
  unavailable. Honest: billing has no backend, so the correct answer is "not
  connected yet", not a synthetic number. The blanket
  `/^\/office\/(lots|finance)/` allowance was removed; `/office/lots` keeps its
  own, since the lot register is genuinely connected.

The availability test asserted `/office/finance/collections` was a connected
surface. That expectation was wrong and now asserts the opposite.

Verified: tsc, ESLint, Vitest 316/316 across 22 files, vite build 88 precache
entries. Not visually confirmed.

## UI-26 — Submission-to-staff chains wired (7 November 2026)

The owner asked that a resident submission reach the right staff workspace.
Most chains already existed; this records what was verified and what was added.

| Resident action | Reaches staff at | State |
| --- | --- | --- |
| Complaint / concern / issue (Helpdesk) | `/office/requests` | **Wired this pass** — now `RequestDesk office`, a connected view of `bfe_requests` that existed but was not routed here. |
| Vehicle & sticker request | `/office/vehicles`, `/security/vehicles` | **Wired this pass** |
| Permit & clearance request | `/office/permits` | **Wired this pass** |
| Any feature submission | `/office/review` | Already connected |
| Facility booking | `/office/bookings`, `/office/calendar` | Already connected |
| Visitor pass | `/office/visitors`, `/security/gate` | Already connected |
| Shuttle request | `/driver/dispatch` | Connected; blocked only by an empty `bfe_shuttles` |
| Marketplace / workshops / carpools | `/office/review` | Already connected |

Blocked routes are down from ten to seven.

### Correction to UI-25

UI-25 claimed `/office/finance` served fixture-built figures to signed-in
accounts and blocked it. **That was wrong and has been reverted.**
`office/Office.tsx:90` routes finance to `RecordedFinance` for non-preview
accounts, which reads real receipts through `ReceiptPanel` and states plainly
that accounting statements need verified records. The fixture-backed `Admin`
path at line 171 is only reached in preview, because the earlier guard catches
it first.

The error was reading a later branch without checking whether an earlier one
already handled the case. `/office/requests` in the same entry was a genuine
gap and that fix stands.

### Still blocked, with reasons

- `/office/registry` — `FlowDesk area="registry"` has no connected branch.
- `/office/history` — `bfe_workflow_history` is per-record; an office-wide
  activity view needs a new endpoint.
- `/office/settings` — needs a connected screen over `bfe_configure_facility`.
- `/explore/imports` — `bfe_import_registry` exists and nothing calls it.
- `/board/reports`, `/security/incidents`, `/explore/calculator` — no backend.

Verified: tsc, ESLint, Vitest 315/315, vite build 88 precache entries. None of
this was visually confirmed; no staff workspace has ever been opened signed in.

## UI-27 — Naming, redundancy and a map (7 November 2026)

- **US spelling throughout.** "Neighbourhood", "colour", "centre" and
  "organised" replaced across 8 files, including the sidebar heading and the
  marketplace eyebrow. The Philippines uses US English; the British forms were
  a leftover.
- **"Around the neighbourhood" is now "Livelihood & marketplace"**, which says
  what the group actually contains.
- **Community directory tile removed** from the More hub — it duplicated
  Marketplace, which reaches the same published records.
- **`components/CommunityMap.tsx`** shows the office address on a map, added to
  the shuttle screen. Deliberately an OpenStreetMap embed rather than a mapping
  library: no dependency, no API key, no account, free tiles with attribution,
  and nothing about the viewer reaches a commercial mapping service. The iframe
  is sandboxed, `loading="lazy"` and `referrerPolicy="no-referrer"`. Dark mode
  softens the tiles rather than inverting them, which would make the labels
  unreadable. The pin is marked approximate because the coordinates only centre
  the view and were not surveyed.

Address used: Bellefort Estates Sales Office, Ph3, Molino IV, Bacoor, Cavite.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries.

### Requested but not done, with reasons

- **12 shuttle stations** — needs the actual station list. A `stations` module
  exists; inventing twelve station names would put invented stops in front of
  residents.
- **Documents viewable without downloading** — board records are text-only;
  there is no document storage behind them, so there is no file to render. This
  needs a storage design first.
- **Incident records and board reports** — no table and no endpoint for either.
  Genuine ground-up work.
- **Mobile app feel beyond the home screen** — a fixed bottom navigation
  already exists (`App.module.css:363`). Making the rest feel native is a design
  pass, not a fix, and should be scoped on its own.

## UI-28 — Incident records and board reports built (7 November 2026)

Both were listed as needing a table, an endpoint and a screen. They needed none
of those: each is a record-and-review workflow with the same shape as vehicles
and permits, so both became feature-record modules. Migration
`202611070020_incidents_and_board_reports.sql` inserts two definitions; no
schema change, no new endpoint.

**Incidents** — capability `security`, `resident_create false`, not publishable.
Type, date, time, location, severity, action taken. Conditional: plate for a
vehicle incident, injury detail for a medical one, damage detail for property.
Filed by security or the office; residents never see them, and the definition
states plainly that an incident record carries no penalty or finding.

**Board reports** — capability `documents`, `resident_create false`,
publishable. Type, period, audience, summary. Conditional: which committee, for
a committee report. Publication goes through the existing review path, so only
a reviewer can publish and only the curated public text reaches members. The
definition says figures stay unavailable until verified accounting records
exist, so a report cannot imply numbers the association has not produced.

Screens: `/security/incidents` renders the incidents desk, `/board/reports` the
published report list. Both removed from `unavailableService`.

Evidence line numbers were read from the reference file, not invented:
incidents 1022/1831/1947/2318/2790, board reports 743/939/940/941/944.

**Blocked routes: 7 → 5.** The remainder are `/office/registry`,
`/office/history`, `/office/settings`, `/explore/imports` and
`/explore/calculator`. Only the calculator has no backend; it waits on billing.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries. The SQL
suite runs the new migration under PGlite and confirms the stored definitions
match the TypeScript.

## UI-29 — Dark mode was purple; workflows all looked alike (7 November 2026)

**Dark mode.** The owner said it read as purple rather than dark. Measured, and
they were right: every dark surface sat at hue 322–331° with **11–13%
saturation** — a magenta tint across the entire background, not a neutral dark
theme. At that saturation over a full screen the cast is unmistakable.

Surfaces re-cut at **3–5% saturation** on the same hue, so the theme still
feels related to the brand while the accent carries the colour:

| token | was | now |
| --- | --- | --- |
| `--bg` | `#191417` | `#151314` |
| `--surface` | `#251d22` | `#1e1b1d` |
| `--wash` | `#32272e` | `#292527` |
| `--line` | `#42333b` | `#3a3539` |
| `--line-strong` | `#99838f` | `#938c90` |
| `--ink` | `#faf5f7` | `#f7f4f6` |
| `--muted` | `#c4b5bd` | `#bdb6ba` |
| `--accent-soft` | `#3c2530` | `#33242c` |
| `--accent-line` | `#624052` | `#5c4350` |

Contrast re-checked against the new surface: ink 15.6:1, muted 8.6:1,
line-strong 5.2:1, accent 9.0:1, status colours 9.9–11.1:1, `--red-line`
3.79:1. All clear of AA, and the control boundaries still clear 1.4.11.

**Every workflow looked identical.** Board reports, incidents and vehicle
requests rendered the same screen because they all render `LiveFeature` — which
is exactly why they were cheap to build, and exactly why they were
indistinguishable. The description was one hardcoded string shown for every
module.

- The intro now reads each module's own `summary` from the definition, so a
  security incident log no longer describes itself as a publication workflow.
- Empty states name what is missing: "No incidents logged yet", "No reports
  drafted yet", "No vehicle requests yet", with bodies that say what the screen
  is for. Review and published views get their own wording.

This narrows the sameness; it does not remove it. The toolbar, pager and record
layout are still shared, and the workflows have genuinely different rhythms — an
incident is written in a hurry and read chronologically, a board report is
mostly read, a sticker request is one person asking about one thing. Summary
strips and per-module default views are the next step.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries.

## UI-30 — Workflow tabs: desktop and mobile layout (7 November 2026)

Follows UI-29. The feature workflows share one screen, so layout work there
reaches every tab built on it: vehicles, permits, incidents, board reports,
marketplace, workshops, carpools and the rest.

**Desktop**

- Records become **two columns above 1100px**. A single column stretched a
  two-line title across a 1900px screen; a record card is read, not scanned
  across, so two columns of comfortable measure beat one wide one.
- The **toolbar is sticky from 768px up** (`top: 12px`, with a shadow), so the
  view filter and search stay reachable while a long list scrolls.

**Mobile**

- The toolbar is **not** sticky below 768px — the bottom navigation already
  occupies fixed space, and two fixed bars on a 390px screen leaves little
  room for content.
- Tighter padding, and the primary action goes **full width** so it is one
  clear thumb target per row.

**Both**

- New `StatusStrip` replaces the bare "N records" line: the total with the
  right noun for the module (incidents, reports, records) and a breakdown by
  status. Counts are derived from the page already loaded, so it costs no extra
  request — and when more records exist than one page holds it says "counts
  cover this page" rather than presenting a partial count as the whole picture.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries. Screenshots
at 390px and 1440px in both themes: **0 axe violations** in all four, and the
dark body background reads `rgb(21, 19, 20)` — the new neutral token, confirmed
live rather than inferred.

**Not visually confirmed:** the captures land on the preview workbench, which
renders a different component. The toolbar, two-column list and status strip
belong to the connected screen and have not been seen rendering. The dark mode
fix and the US spelling were confirmed in that capture.

## UI-31 — Duplicate complaint channel retired; booking dead end (7 Nov 2026)

**Redundancy.** Migration `202611070021_retire_duplicate_modules.sql` sets
`resident_create = false` on `complaints` and `concerns`. The Helpdesk already
accepts both categories and carries threaded replies, status transitions and
office assignment, which those modules do not — so a resident filing in one of
them produced a record the office does not watch and cannot reply to.

Migration 017 had set those flags true to let residents raise complaints. The
real gap was discoverability, fixed in UI-22 by adding explicit entry points.
This reverts the flag, leaving one complaint channel. The modules are not
deleted; existing records and the office view are unaffected.

`gate-passes` and `walk-ins` are deliberately left alone. Whether a delivery of
materials is the same record as a visiting relative is an association policy
question, not a coding one.

**Facility booking.** The owner reported no action available. Investigated: not
a bug. `bfe_create_booking` requires only the homeowner/renter role and
`calendar/create/own`, which is a base grant — so any resident can already
book. `canCreate` in `OperationsDesk` additionally requires
`eligibleFacilities.length > 0`, and `bfe_facilities` is empty, so the button
is correctly hidden. **Running `supabase/seed-test-configuration.sql` is the
whole fix.**

One real defect found while checking: with no facilities, every viewer was
offered "Open facility setup" — a link to an office page a resident cannot use.
Residents now get a Helpdesk link pre-set to the right category; the setup link
shows only when `can_manage` is true.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries.

## UI-32 — Calendar days open a booking (7 November 2026)

The owner asked why a day could not be clicked, and confirmed the intended
flow: resident books, office approves. That flow is exactly what the server
does — `bfe_create_booking` writes `status = 'Pending'` and the slot is held
immediately (`bfe_bookings_slots` covers Pending and Approved), so nobody else
can take the time while the office decides. Only `bfe_decide_booking` can
approve, and it needs `calendar/approve/association`.

The month view was read-only, which made the merged screen misleading: a
calendar sitting directly above a booking form implies the two are connected,
and they were not.

- `CommunityCalendar` takes an optional `onPickDay`. Without it the month view
  stays read-only, which is still right anywhere booking is not offered.
- Days from today forward become buttons across the whole cell, so the target
  is comfortable on a phone. Past days stay plain text.
- "Request this day" appears on hover or focus, and is always visible under
  768px because a touch screen has no hover.
- `OperationsDesk` takes `requestDate` and opens the form on that day.

The date is passed as a prop and applied by adjusting state during render on a
changed value — React's documented pattern — rather than in an effect. ESLint's
`react-hooks/set-state-in-effect` rejected the first attempt, correctly: an
effect would have caused an extra paint for something derivable from the prop.

Nothing here grants anything. The booking is still Pending, and the server
still decides.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries. Not
visually confirmed, and it cannot be until a facility exists —
`supabase/seed-test-configuration.sql` is still unrun.

## UI-33 — "Approve" was there, under another name (7 November 2026)

The owner opened a Submitted vehicle request and found only "In review" and
"Rejected" — no way to approve.

The dropdown was correct. It mirrors the server's state machine exactly
(`bfe_review_feature`, 202611060007 line 98):

```
Submitted  -> In review | Rejected
In review  -> Reviewed  | Rejected | Published
Published  -> Withdrawn
```

Approval is deliberately two steps, and **"Reviewed" is the approved state**.
Nothing in the interface said so, so a reviewer looking for "Approve" on a
Submitted record concluded it was missing. The state machine is sound — an
office should take a request in hand before deciding it — but the vocabulary
was the server's, not the reviewer's.

- Decision options now carry what they do: "In review — accept it for
  checking", "Approved — the request is granted", "Rejected — decline the
  request", "Published — make the public text visible to members",
  "Withdrawn — remove it from publication". The stored values are unchanged;
  only the labels differ, so the server still validates the same vocabulary.
- A line above the dropdown states the step: on a Submitted record, "Accept it
  for checking first. Approving or rejecting becomes available once it is in
  review."
- The record badge and the status strip show **Approved** where the server
  stores "Reviewed". A resident who asked for a sticker learns nothing from the
  word "Reviewed".

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries.

## UI-34 — Lists are entered as rows, not "one per line" (7 November 2026)

The owner showed the upstream app's forms and asked for ours to work like them.
Those screenshots are workflow evidence under the reference exception — what a
gate pass needs, how a booking is chosen — not a design to copy, and nothing
from them was reused.

The one structural difference worth taking immediately: a gate pass or a garage
sale is **a list of things**, and ours asked for it as a textarea labelled
"Sample items, one per line". That puts the formatting burden on someone
listing eight bags of cement on a phone.

New `features/connected/ItemRows.tsx` renders one input per item with remove
buttons and "Add another". **The stored value is unchanged** — newline-joined
text in the same field, submitted through a hidden input — so the server
validates exactly what it validated before and no migration is needed. Applied
to `items`, `drivers` and `positions`; labels dropped the "one per line"
instruction that no longer describes the control.

What the owner's screenshots also show, and what remains undone:

- **Per-workflow forms** rather than one generic field list. Partly addressed
  in UI-29 and UI-30 (own intro, own empty state, status strip), but the field
  layout is still generic. A bespoke form per module is a large project — 36
  modules — and should be scoped deliberately rather than approximated.
- **Slot pickers** for booking times. `BookingDatePicker` and `BookingSlots`
  already exist and do this; they are not reachable until a facility exists.
- **Cover photo plus link-out.** `ListingMedia` already implements this for
  listing modules.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries.

## UI-35 — Board summary access, and a regression the tests caught (7 Nov 2026)

The owner supplied the association's permission matrix. Checked against the
database: all 12 committees and 204 workbook rows already match the Committee
Matrix exactly, and the base role grants match the View Matrix — including
renters having no statements and no marketplace, which is deliberate policy and
not the defect the role readiness assessment suspected.

One gap was actionable. The matrix gives BOD "R — approved summaries or
authorised review" across several modules, and the `board` role held no base
grants at all, so a board member without a committee assignment saw almost
nothing. Migration `202611070022_board_summary_access.sql` grants board
view/approved on calendar, requests, finance, livelihood and documents. That
scope gates the published projection only; association-wide reads are
untouched, so a board member still cannot open a household record.

### The regression

The first version of that migration replaced `bfe_can_for` with a body copied
from migration **004**. Four tests failed immediately. Investigating showed
migration **014** had redefined `bfe_can_for` as the tab-rule layer — hidden /
view / edit modes, delegating base grants to a new `bfe_legacy_can_for`.
Shipping that copy would have **silently removed configurable tab access** from
the production database.

Rewritten against `bfe_legacy_can_for`, extracted from 014 rather than retyped.
315/315 pass.

Two lessons recorded rather than glossed: a `CREATE OR REPLACE` is only safe
against the newest definition of a function, and "which migration last touched
this" is worth checking before copying a body. The test suite caught what
reading did not.

### Still a decision, not a migration

The matrix gives Super admin only profile, support and hotlines, while
`bfe_legacy_can_for` returns true for everything when the developer role is
present. Narrowing that would withdraw access from the account administering
the system and is a question about who may read residents' records. Left for
the association. See `docs/PERMISSION-MATRIX-CHECK.md`.

## UI-36 — "Save tab permissions" looked broken; it was blocked (9 Nov 2026)

The owner reported the save button on Roles & committee access not working.

It was working as designed. `bfe_save_tab_access` refuses any change whose
reason is not between 3 and 200 characters, and the button mirrors that with
`disabled={!draft || note.trim().length < 3}`. With no reason typed, the button
greys out.

The defect is that it said nothing. The reason field sits well above the button
and scrolls out of view on this screen, so what the owner saw was a greyed
control beside an "Unsaved change" badge — which reads as broken, not blocked.
A second control, the permission-management toggle, carried the same silent
guard.

- The reason field now states it is required and says why: the server records
  it on the change, so it is what an audit shows later.
- A line beside each disabled button explains the block: "Add a reason above to
  save. Permission changes are not accepted without one." Linked to the input
  with `aria-describedby`, so a screen reader reaches the same explanation.
- `--amber` on the surface measures 6.50:1 light and 11.08:1 dark.

No behaviour changed. The server rule was already right; only the silence was
wrong.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries. Not
visually confirmed — this screen renders only in authenticated mode.

## UI-37 — Dead ends (9 November 2026)

The owner: "a lot of dead end on this system". Measured, and correct.

**28 `<Empty>` states; 2 had an action.** Twenty-six times a resident arrived
somewhere, was told there was nothing, and was given no way forward. The
component has supported an `action` prop the whole time.

Fixed the resident-facing ones, now **7 of 28**:

| Screen | Was | Now offers |
| --- | --- | --- |
| Every feature workflow (`LiveFeature`) | "No records in this view" | **New submission**, when the server says the viewer may create one |
| Facility bookings / visitor passes | "No records yet" | **New booking** / **New visitor pass**, with copy saying what happens next |
| Community calendar | "Nothing scheduled" | **Request a facility today**, which opens the booking form on today |
| More hub search | "No matching feature" | **Show everything** — clears search and category |
| Services search | "No matching service" | **Show all services** |

Each action is gated on the same condition as the real control elsewhere on the
page — `can_create`, `canCreate`, `onPickDay` — so an empty state never offers
something the server would refuse. The `LiveFeature` handler calls
`mutation.reset()` and `setRecordSaved(false)` exactly as the toolbar button
does, rather than a simplified version that would leave stale state.

Twenty-one remain, concentrated in preview-only screens (`Admin`,
`CommunityModules`, `FeatureBaseline`, `Inbox`) where the dead end costs a
demonstration rather than a resident.

### The wider pattern

This is the same defect as UI-36 and the facility booking button: **a control
that is correctly unavailable, with nothing saying why.** Blocked and broken
look identical. Three instances so far, all found by the owner rather than by
tests — because nothing in the suite checks that a screen offers a way forward.

Verified: tsc, ESLint, Vitest 315/315, vite build 89 precache entries.

## UI-38 — Duplicate access tab, and plainer permission wording (9 Nov 2026)

The owner: "we have a lot of redundant tabs", and asked why granting access is
spread across People & accounts, Access & roles and Roles & committee access.

**The redundancy is real and confirmed.** `DeveloperConsole.tsx:93`:

```
if (path === "access" || (path === "roles" && !auth.preview))
  return <AccessPlanning />;
```

`/developer/roles` ("Access & roles") and `/developer/access` ("Roles &
committee access") render **the same screen** for a signed-in account. Two nav
entries, near-identical names, one destination. The roles entry is only its own
thing — role previews — inside the preview build, so it is now hidden from the
navigation when signed in.

People & accounts already carries a "Manage account access" link to the same
screen, so the route from a person to their permissions exists.

### Wording

- "Data scope" is now **"Which records"**, with a line saying a permission is
  always about a kind of record and that most office work is association
  records. Options read "Only their own household's records" and "Association
  records — everyone's" instead of `own` and `association`.
- The change reason now asks **"Why are you changing this?"** and explains that
  it is kept with the change and is what answers the question next year.

### Still a design problem, not fixed

One screen holds **three different permission editors**, each writing somewhere
different and speaking a different language:

| Section | Writes to | Speaks in |
| --- | --- | --- |
| Tab access | `bfe_tab_rules` | No access / Read only / Read & edit |
| Roles & account status | `members.role`, `extra_roles` | role names |
| Committee permissions | `bfe_access_grants` | module × action × scope × effect |

Someone whose task is "let Maintenance see complaints" has to already know
which of the three that is. The audit field also appears twice under two names
— "Why are you changing this?" and "Approval reference" — both required, same
purpose.

Fixing that means deciding the three or four tasks an operator actually comes
here to do and building those, keeping the raw grid behind an advanced section.
That is design work and is not attempted here.

Verified: tsc, ESLint, Vitest 315/315, vite build clean.


## 9 November - Manage access interaction redesign

Local implementation, awaiting owner browser verification. Manage access opens one member side panel over the existing table; it no longer moves an inline editor above the page or mixes role defaults and committee reference into the lookup state. The panel separates loading, missing/duplicate account, migration setup, connection/access error, manual selection and editable-member states. Page-permission save/reason/feedback stay in its footer; drafts are guarded on close. Roles and committee grants remain Advanced. Existing account-link requirements and server authority are unchanged. Typecheck passed; no automated suites or deployment.
