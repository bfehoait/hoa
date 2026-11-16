> Current scope - 16 November 2026: this document describes the original UI design task. Its presentation-only/no-SQL limits apply to that historical task, not all future development. Follow the current owner request, AGENTS.md and docs/CO-DEVELOPER-GUIDE.md. Claude and Codex may implement authorized local behavior and wiring fixes while preserving server permissions and protected workflow checks. Production actions still require owner authorization.

# Admin console design spec (self-contained — rebuild the artifact blind)

**Audience:** Codex / engineers. This document contains **every** design detail of the
approved artifact so it can be rebuilt without opening the artifact link.
**Source mock (reference only, do not ship):** single-file `bellefort-console.html`
— a data-driven mock: a `WS` registry (workspaces → modules) + a `RENDER` map
(view type → renderer) + a modal engine. This doc transcribes all of it.

**Golden rule:** this is a **presentation** target for the real app. Preserve every
query, RPC, submit handler, zod schema, validation, route, permission, notification
destination, and the account-creation `created`/`member_linked` confirmation. No
SQL/auth/migration changes. All sample numbers/rows below are **placeholders** — wire
them to the existing live data and keep real loading/empty/error/pending/
permission-denied states (never invent values). Scope styling to the admin console
(`[data-staff-ui="true"]`) so resident screens are untouched. Reuse `lucide-react`,
existing components, tokens and CSS Modules — no Tailwind/component kits.

---

## 1. Design tokens (exact)

Artifact palette == `apps/web/src/styles/tokens.css`. Use tokens; these are the
artifact's literal values for reference.

**Light:** brand `#8b002b`, brand-strong `#6d0021`, brand-soft `#fbeef2`,
on-brand `#fff`; bg `#f4f4f6`, surface `#fff`, soft `#f7f7f9`, wash `#eeedf1`,
ink `#1c1a1d`, muted `#75707a`, line `#eceaee`, line-strong `#d7d3da`;
green `#1f9d57`/bg `#e7f6ee`, amber `#c0871b`/bg `#fbf1dd`, blue `#2f6fd6`/bg
`#e9f0fc`, red `#d23b4a`/bg `#fceaec`; chart: teal `#1f9d8f`, amber `#d9941a`,
slate `#8b93a7`, gray `#e6e5ea`.
**Dark:** bg `#141215`, surface `#1d1a1e`, soft `#211e23`, wash `#2a2630`, ink
`#f5f1f5`, muted `#a79fa8`, line `#2f2b33`; brand `#ef9fba`, brand-soft `#33232c`,
on-brand `#3a1020`; green `#67d39b`, amber `#e3b765`, blue `#8fb6f0`, red `#f2969f`.
**Shape:** radius card `16px`, small controls `11px`, pill `999px`.
**Shadow:** card `0 1px 2px rgb(24 18 24/.05), 0 1px 3px rgb(24 18 24/.04)`;
overlay `0 24px 60px rgb(24 18 24/.16)`; dark = none / `0 24px 60px rgb(0 0 0/.5)`.
**Type:** Manrope; body 15px; weights 400–800; headings 800 with `-0.02em` tracking.

---

## 2. Already applied by Claude (keep / extend) — presentation only, builds green

- `styles/global.css` — `[data-staff-ui="true"]`: soft card elevation (`--shadow-sm`),
  `.panel` 16px+shadow, **carded tables** (`.table-wrap` surface/border/radius/shadow,
  washed `th`, 14–18px cells, no trailing divider).
- `features/office/StaffHome.tsx` + `.module.css` — tools dropdown → always-visible
  card gallery (icon chip + title + description).
- `features/office/OfficeWorkload.module.css` — home KPI trio: accent top strip +
  colored icon chip (burgundy/amber/green).
- `features/office/People.tsx` — status badge tone by meaning.
- `features/developer/AccessManager.tsx` — action-specific confirm ("Deactivate X?" /
  "Revoke committee assignment?") with red danger button.

---

## 3. Shell

**Frame:** two columns `264px` sidebar + fluid content; max-width `1340px`; card
radius 16; overlay shadow; collapses to one column < 760px (sidebar hidden).

**Sidebar** (surface, right hairline, flex column):
1. **Brand** — 34px rounded-10 tile, brand→brand-strong gradient, white glyph +
   soft brand shadow; name 16/800 with uppercase 10px tracked `.16em` subtitle.
2. **Search** — 40px, soft bg, 11px border, search icon + input + `⌘K` kbd chip.
3. **Workspace switcher** — tiny uppercase label "Workspace"; button (30px brand-soft
   icon chip + name 700 + chevron that rotates when open; focus ring = 3px brand-soft);
   dropdown menu (surface, shadow) listing all 5 workspaces as rows (icon chip + name
   700 + "N modules" + check on selected; selected row brand-soft bg, brand icon chip).
4. **Nav** — uppercase 11px tracked section label (the workspace name); nav rows =
   20px muted icon + 14px label (+ optional count badge, amber pill, right-aligned).
   Active row: brand-soft bg, brand text 700, brand icon.
5. **User** — top hairline; 34px round brand-soft avatar initial + name 700 + role.

**Top bar** (content header): breadcrumb `<workspace b> · <module>` (13px; workspace
in brand); right side: "Sample data" chip (surface, line-strong border, muted) +
theme toggle + notification bell. Page title `h2` 26/800 `-0.02em`.

**Content body:** padded 14×26px; `.intro` = one-line muted blurb under the title;
`.seclab` = 16/800 section labels between card grids.

---

## 4. Card system

`.cardgrid` = `repeat(auto-fill, minmax(270px, 1fr))`, gap 16.
`.ucard` = surface, 1px line, radius 16, padding 18, column flex gap 9, card shadow.
`.ucard.wide` spans the full row. `.ucard.caction` = brand-soft→surface gradient +
brand-soft border (the "action" emphasis card). Card header `.ucardh` = optional
30px brand-soft **icon chip** + title 14/700 + optional right chevron `.cgo` (navigates).
Big number `.cbig` = 34/800 `-0.025em` (KPI variant 30px).

**Card kinds** (one object → one card):
| kind | renders |
|---|---|
| `kpi` | icon chip + title + `.cbig` value + colored `delta` (green/amber/red). |
| `action` | `.cbig` count + description + **primary button that navigates** (`to`). Uses `caction` emphasis. |
| `metric` | `.cbig` value + delta **or** description + optional **mini bar chart**. |
| `radial` | centered ring gauge + caption (tone-colored). |
| `donut` | donut + legend (see §5). |
| `progress` | `.cbig` %+ linear bar (`.prog`/`.progf`, 8px, brand fill) + caption. |
| `status` | 10px colored dot (green/amber/red/blue) + text. |
| `list` | feed: rows of 32px soft icon chip + title 14/700 + sub 12/muted + (status chip **or** time). Rows with `to` are clickable → navigate. `wide` for full width. |
| `quick` | full-row flex of ghost buttons (icon + label) → open action modals. |

---

## 5. Charts (exact math — inline SVG, token colors)

- **mini bars** (`metric.bars`): flex row, `height:52px`, 6px gap; each bar
  `height = max(v/maxV*52, 4)px`, radius `4 4 2 2`, fill gray; **last bar brand**.
- **radial** (`radial.pct`): SVG 104 viewbox @112px. Track circle r42 stroke-width11
  `--wash`; value arc same r, stroke `--brand`, round cap, `dasharray = pct/100*2πr`,
  rotated −90°. Center text `pct%` 23/800 ink.
- **donut** (`donut`): SVG 120, r46 stroke-width15. Segments in order using palette
  `[brand, teal, amber, slate]`, each `dasharray = v/100*C` (minus 2px gap),
  `dashoffset` accumulates, rotated −90°. Center "Total" 11 muted + `total` 17/800 ink.
  Legend rows: 10px swatch + name + bold value (right-aligned). ≤4 parts.
- **column chart** (`chart.collections`): SVG 560×210, margins L42/T18/B28/R12.
  3 gridlines at 0, max/2, max (hairline `--line`) with y-labels. Bars width
  `min(24, band*0.52)`, radius-top 4 / square base, fill gray **except the peak bar
  = brand** with its value label above; x-labels under each. One axis only.
- **segmented bar** (`chart.aging`): 30px flex row, 2px gaps, radius 8; each part
  `flex:<share>`, palette color, white inline `<share>%` when ≥9%; legend below =
  swatch + name + bold amount + share%.

Rules: single hue for magnitude; categorical in fixed order; never dual-axis; ≤24px
bars; hairline solid grid; legend for ≥2 series; selective direct labels; status
colors reserved.

---

## 6. Views (the 8 renderers)

- **overview** — sequence of `{title, cards[]}` sections: `.seclab` + `.cardgrid`.
- **chart** — optional KPI `.cardgrid`; then `.cols` (1.4fr/1fr) = column-chart panel
  (header + "Export" link) and segmented-bar panel; optional recent-records table.
  Panels = surface, 16 radius, header hairline.
- **table** — toolbar (pill search left; filter chips; **primary action top-right**);
  result count `<b>N</b> noun`; carded table; hidden empty row "No matches. Try a
  different search." shown when search clears all; rows clickable.
- **inbox** — two columns `340px | 1fr`. Left = header "N waiting/open" + scroll list
  of rows (36px icon chip + title + sub + status chip + time; selected = brand-soft
  bg + 3px brand inset marker). Right = detail: 46px icon header + title 20/800 + sub;
  fields `<dl>` on soft panel; a blue **"what happens next"** note; **Approve/Reject**
  (reject=ghost) — both open a confirm. Thread variant: chat bubbles (me=brand right,
  other=soft left) + reply input + Send.
- **cards** — toolbar (count + optional primary action); `.cards` grid of `.pcard`
  (38px icon chip + title + description + footer = status chip + ghost "Open").
- **calendar** — month grid 7 cols; day cells min-height ~92; today = brand circle on
  the number; event chips (brand-soft default, green `g`, blue `b`); **legend**
  Facility / Community event / Maintenance.
- **log** — count line + timeline rows: tone dot (muted/green `g`/amber `a`/red `r`)
  + title 14/700 + sub + right-aligned time.
- **form** — titled section (`h3` + help line) + fields (`fld`: input/select/textarea,
  46px controls, 11px radius) with `row` pairs in a 2-col grid; Save changes / Cancel.

---

## 7. Modals, drawer, confirm

**Engine:** scrim `rgba(18,14,18,.46)` grid-centered; `.modal` surface, 18 radius,
max 520 (`lg` 640), max-height 88vh, header/body(scroll)/footer. Header = icon chip +
title 18/800 + one-line description + ✕. Footer (soft bg) right-aligned ghost Cancel +
primary. Dismiss: scrim click, ✕, **Esc**. Success state replaces body with a centered
green check, title, note, and a single Done.

**Centered modals (action → fields → submit):**
- **Create account** (`people`) — info note "No email will be sent. Share the sign-in
  details privately." Fields: Full name; Email; **Role select** with a live
  **description line** that changes per role; **Lot address** = 3 inputs Phase/Block/Lot
  + "Numbers only. Lot access is approved separately."; **Initial password** with
  Show/Hide toggle + "At least 12 characters. Share privately."; Reason for creation.
  Primary "Create account" → success: "Account created — the sign-in account and member
  record are linked. No email was sent — share the details privately and ask them to
  change their password in Profile." (Map to the real CreateAccount flow — keep its
  server confirmation; do not weaken it.)
- **Register vehicle** (`vehicles`): Plate number; Vehicle (make/model/color);
  Owner/lot; Sticker type [Resident/Household/Service]. → "Register vehicle".
- **New announcement** (`community`): Title; Audience [All residents/Homeowners only/
  A specific phase]; Message (textarea); When [Publish now/Save as draft]. → "Publish".
- **Upload document** (`docs`): Title; Category [By-laws/Minutes/Guidelines/Financial];
  File. → "Upload".
- **New committee** (`access`): Committee name; Scope [Association-wide/Assigned records
  only]. → "Create committee".
- **Record payment** (`finance`): Lot; Amount ₱; Period [months]; Method [Cash/Bank
  transfer/GCash]. → "Record payment".
- **Add reservation** (`calendar`): Facility [Function hall/Basketball court/Swimming
  pool/Clubhouse]; Date; Time; Reserved by. → "Add reservation".

**Member-access DRAWER** (`roles` icon) — right-side, full height, width `min(900px,
95vw)`, slide-in, radius on the left. Header "Access for <name>" + "Manage page
access, role and account status." Body: member summary chip (avatar + name + unit·role
+ status badge) + **tab bar** (Page access · Role & status · Committee permission).

- **Page access** (default tab): intro "Turn on Read to let them open a page, and Edit
  to let them make changes. Turning on Edit includes Read." Matrix = header (Page |
  Access) + one row per page: name + "Using defaults"/"Custom access" tag, and **two
  toggle switches Read / Edit** (40×23 track, 19px knob, brand when on). Logic: Edit on
  ⇒ Read on; Read off ⇒ Edit off. Changing a row flags "Custom" + shows "Unsaved
  changes". Footer: Done (ghost) + Save changes. Pages used in the mock: Overview,
  Review inbox, People & accounts, Finance, Operations, Facilities & calendar,
  Community, Helpdesk, Lot register, Roles & permissions.
  **⚠ In the real app keep `TabAccess`'s 3-level model (No access / Read only / Read &
  edit) + limited-edit + inherit-defaults + server save — restyle only; do NOT replace
  it with this 2-toggle (see §9).**
- **Role & status**: Role select (+ description line); Account status [Active/Suspended];
  Reason. → **Review change**.
- **Committee permission**: info note; Committee; Module; Action [view/manage/approve/
  export]; Scope [association/assigned/own]; Permission effect [Allow/Deny]; Reason.
  → **Review change**.
- **Review → Confirm** (two-step): a summary screen (Member / Change / Reason) +
  "In the live app this is recorded in the audit log with your name and the time." +
  Back / Confirm. When status = Suspended the confirm becomes **"Deactivate <name>?"**
  with the sign-in warning and a red **Deactivate account** button (already in the real
  `AccessManager`).

**confirm dialog** (generic): icon + title + body sentence + Cancel + primary (red
when destructive). Used by Approve ("Approve this request? <title> will be approved and
the resident notified in the app.") and Reject (danger; "…can fix the details and
submit again.").

---

## 8. Icon set (lucide-react names per concept)

home=House · review=ClipboardCheck · people=Users · finance=Banknote · ops=Wrench ·
calendar=CalendarDays · community=Megaphone · helpdesk=LifeBuoy · lots=Map ·
roles=KeyRound · access=ShieldCheck · connections=Link/Cable · audit=FileText ·
docs=Folder · elections=Vote · updates=Newspaper · reports=ChartColumn(BarChart3) ·
shuttle=Bus · visitors=UserCheck · vehicles=Car · incidents=TriangleAlert ·
gate=Warehouse · profile=CircleUserRound · dev=CodeXml · board=UsersRound ·
office=Building2 · plus=Plus · check=Check · x=X · send=Send · info=Info · clock=Clock ·
eye=Eye · pencil=SquarePen · chev=ChevronRight.

---

## 9. Workspaces & modules — full content (sample data = placeholders)

Each module: **view type · one-line blurb · content.** Default view blurbs:
inbox "Pick an item on the left, review the details, then take action."; table "Search
or filter, and open any row for details."; cards "Browse and open any item.";
calendar "Facility bookings and estate events this month."; log "Most recent activity
first."; form "Update the details and save."

### Developer — "Diagnostics, access configuration and system maintenance."
- **Overview** (overview): §System status = 4 `status` cards — Supabase "Connected ·
  42ms" (green), Vercel "Deployed · live" (green), Buyani "Reachable" (green), OSRM map
  "Reachable · 88ms" (green). §Activity = `metric` Audit events·24h = 148 (bars
  90,110,95,130,120,148); Members 312 "Sample records"; Committees 6 "Access groups".
  §Recent audit = wide `list` → Diagnostics: Posting trigger fired · amenity accounting
  ok · 11:04 / Access grant changed · Finance→approve · 10:41 / Member inspection
  started · 10-minute window · 10:12 / Schema reload · success · 09:58.
- **Account support** (table): noun members; cols Member·Unit·Role·Status; filters All/
  Active/Invited/Suspended; rows Aaron Cortez 1-01-005 Homeowner Active / Maria Santos
  1-02-014 Homeowner Active / Juan Dela Cruz 2-03-009 Renter Invited / Ramon Reyes
  3-01-022 Driver Active.
- **Connections** (cards): Supabase "Database, auth & RLS" Connected; Vercel "Web
  hosting & deploys" Connected; Buyani "Dues payment provider" Reachable; OSRM/OSM
  "Shuttle route geometry" Reachable.
- **Access configuration** (table + New committee): cols Committee·Members·Module·Scope;
  Finance 3 (finance·approve) Association / Operations 4 (operations·manage) Association
  / Security 2 (security·view) Assigned / Board 5 (reports·export) Association. Pair with
  the real role/committee defaults editor (`TabAccess` group mode).
- **Diagnostics & audit** (log): Posting trigger fired · bfe_amenity_accounting_effect
  ok (g) 11:04 / Access grant changed · Finance→approve (a) 10:41 / Member inspection
  started 10:12 / Schema reload · NOTIFY pgrst success (g) 09:58 / Failed sign-in · rate
  limited 429 (r) 09:20.

### Office — "Administration, people, finance and the day's operations."
- **Overview** (overview): §Needs your attention = 2 `action` cards — "Approvals
  waiting" 7 → Review inbox ("Review now"), "Open helpdesk" 3 → Helpdesk ("Open
  helpdesk"). §Collections = `radial` Collection rate 86% "+3 pts vs last month";
  `metric` Collected this month ₱77k "+₱11k vs last month" (bars 52,61,58,70,66,77);
  `donut` Dues aging total ₱383k (Current 68% ₱261k / 30 days 18% ₱69k / 60 days 10%
  ₱38k / 90+ 4% ₱15k). §This week = `metric` Amenity bookings 5 (bars 2,3,1,4,2,5);
  `progress` Requests resolved 92%; `metric` New registrations 2. §Today's worklist =
  wide `list`: Registration·Juan Dela Cruz (Review) / Function hall·Nov 22 (Approve) /
  Permit·Fence work (Review) / Street light out (Reply→Helpdesk).
  **(Real app: these counts must come from the live review-inbox RPCs.)**
- **Review inbox** (inbox): items — Registration·Juan Dela Cruz (2-03-009·Renter,
  Pending, 8m; fields Name/Unit "Phase 2·Block 3·Lot 9"/Role/Proof "Lease contract"/
  Submitted; note "Approving creates Juan's resident account and emails a welcome link.
  Rejecting asks you for a reason."); Booking·Function hall (Nov 22 9AM–12NN, Pending,
  25m; Facility/Date/Time/Attendees 60/Requested by Maria Santos; note "Approving
  confirms the function hall for Nov 22 and blocks it on the calendar."); Permit·Fence
  work (1-02-014·3 days; Type/Scope/Duration/Lot; note "…issues a 3-day construction
  permit and notifies Security…"); Vehicle sticker·ABC 1234 (Toyota Vios·Homeowner;
  Plate/Vehicle/Owner/Lot; note "…activates the sticker so the plate is recognized…").
- **People & accounts** (table + Create account): cols Member·Unit·Role·Status; filters
  All/Homeowners/Renters/Office; rows Aaron Cortez, Epifanio Santillan (both 1-01-005),
  Maria Santos 1-02-014, Juan Dela Cruz 2-03-009 Invited, Lourdes Ramos 2-05-003, Nanie
  Buhay 3-01-010 — all Homeowner/Active unless noted. Row click → member-access drawer.
- **Finance** (chart): KPI cards Collected·6 months ₱384k / Open invoices 42 /
  Unallocated ₱0. Column chart "Collections, last 6 months" (Jun52…Nov77, max90, unit
  k). Segmented "Dues aging" (Current 68% ₱261k / 30d 18% ₱69k / 60d 10% ₱38k / 90+ 4%
  ₱15k). Table "Recent invoices" (Period·Lot·Amount·Status): Nov 1-01-005 ₱800 Paid /
  Nov 1-02-014 ₱800 Due / Oct 2-03-009 ₱800 Paid. Quick action Record payment.
- **Operations** (table): cols Request·Lot·Type·Status; filters Visitor passes/Permits/
  Vehicles; Juan Dela Cruz Visitor pass Approved / Fence repair Permit Pending / ABC
  1234 Vehicle sticker Pending / LBC courier Small delivery Exited.
- **Facilities & calendar** (calendar): Nov 2026; events 13 Basketball 2–6PM, 15 Pool
  maintenance (blue), 22 Function hall AM + Assembly (green), 25 Court 4PM. Quick action
  Add reservation.
- **Community** (cards + New announcement): General assembly "Nov 22 · 9:00 AM at the
  clubhouse…" Published / Water interruption advisory "Nov 15 · 10 AM–2 PM…" Published /
  Updated amenity guidelines "Pool capacity and function-hall hours, Oct 2025" Draft.
- **Helpdesk** (inbox, unit "open"): Street light out at corner (Maintenance·Aaron
  Cortez, In progress, 1h; Category/Ref MNT-0142/Lot; thread) / Noise complaint, Block 2
  (Complaint·anonymous, Open, 1d; Category/Ref CMP-0088/Area; thread).
- **Lot register** (table): cols Lot ID·Location·Status·Homeowner; filters All/
  Owner-occupied/Rented/For review; 1-01-005 "Phase 1·Block 1·Lot 5" Verified Epifanio
  Santillan / 1-02-014 Verified Maria Santos / 2-03-009 Review — / 3-01-010 Verified
  Nanie Buhay.
- **Roles & permissions** (table + New grant): cols Subject·Module·Action·Scope; Finance
  committee Finance approve Association / Operations committee Operations manage
  Association / Security Gate desk view Assigned / Board Reports export Association. Row/
  New grant → committee-permission drawer tab.

### Board of Directors — "Governance, oversight, elections and reporting."
- **Overview** (overview): §Governance = `radial` Election turnout 41% "16 days left ·
  128 of 312 voted"; `radial` Collection rate 86% "+3 pts"; `metric` Reports ready 3.
  §Oversight = `metric` Expenses·YTD ₱1.2M (bars 160,180,170,200,190,210); `donut`
  Expenses by category ₱1.2M (Utilities 40% ₱480k / Security 30% ₱360k / Maintenance
  20% ₱240k / Admin 10% ₱120k); `metric` Board documents 24. §Recent updates = wide
  `list` → Updates: 2026 Board election opened / October minutes uploaded / Q3 financial
  report ready.
- **Documents** (cards + Upload document): By-laws (2024) Approved / October minutes
  Published / Amenity guidelines Published.
- **Elections** (cards): 2026 Board election "5 seats · voting open until Nov 30, 2026"
  Open / 2025 Board election "Completed · results published" Closed.
- **Updates** (log): Board update posted · Clubhouse renovation timeline (g) 2d /
  Reminder scheduled · General assembly Nov 22 · 3d / Policy draft shared · Parking &
  visitor rules (a) 1w.
- **Reports** (chart): KPI Collection rate 86% / Expenses·YTD ₱1.2M / Participation 41%.
  Column "Dues collection by month (%)" (Jun78…Nov86, max100, unit %). Segmented
  "Expenses by category" (same split as above). Export link.
- **Shuttle review** (table): cols Date·Route·Trips·Status; Nov 12 Gate↔Market 9 Normal
  / Nov 11 12 Normal / Nov 10 8 "1 lapsed".

### Security — "Gate activity, passes, vehicles and incidents."
- **Overview** (overview): §Gate, right now = `metric` On site now 88 "Vehicles inside
  the estate"; `metric` Movements today 124 "+18 vs yesterday" (bars 96,104,92,110,118,
  124); `donut` Entries by type total 124 (Residents 62%→77 / Visitors 22%→27 / Delivery
  12%→15 / Service 4%→5). §Watch list = `list` Expected visitors (Juan Dela Cruz "Host
  1-01-005 · 1–8 PM" Expected / Maria's guest "Host 1-02-014 · 3–6 PM" Expected) +
  `list` Alerts (DEF 4521 "Sticker expired" red Hold / Turn-away "Unlisted plate ·
  10:12" amber Logged).
- **Visitors** (table): cols Visitor·Host lot·Valid·Status; filters Expected/Entered/
  Exited; Juan Dela Cruz 1-01-005 "Nov 13·1–8 PM" Expected / Maria Santos (guest)
  1-02-014 Entered / LBC courier 3-01-010 Exited.
- **Vehicles** (table + Register vehicle): cols Plate·Vehicle·Lot·Sticker; ABC 1234
  Toyota Vios Valid / XYZ 7788 Honda Click Valid / DEF 4521 Mitsubishi L300 Expired.
- **Incidents** (log): Gate barrier check · Routine all clear (g) 11:00 / Unregistered
  vehicle turned away · North gate (a) 10:12 / Noise report relayed to office · Block 2
  (a) Nov 12 11:40 PM.
- **Gate desk** (log): Entry·Juan Dela Cruz · Visitor pass verified (g) 1:12 PM /
  Entry·ABC 1234 · Resident sticker (g) 12:48 PM / Exit·LBC courier · Small delivery
  11:30 AM / Turn-away·unlisted plate · No valid pass (r) 10:12 AM.

### Transport — "Shuttle dispatch, requests and roster."
- **Shuttle** (overview): §Dispatch = `action` Waiting request 1 "Phase 1 gate → Market
  · 2 passengers" ("Accept request"); `metric` Riders today 42 "+6 vs yesterday" (bars
  28,34,31,38,36,42); `metric` Avg wait 6 min. §Fleet = `status` Shuttle 1·Mang Ramon
  "On the way · ETA 4 min" (amber) / Shuttle 2·on standby "Ready at gate" (green).
  §Recent trips = wide `list`: Gate→Market 3 passengers 18m / Gate→Market 2 passengers
  46m / Market→Gate 4 passengers 1h.
- **Profile** (form): title "Driver profile", help "This is what the office and riders
  see. Keep it current." Fields: row[Display name "Ramon Reyes" · Shuttle code select
  Shuttle 1/Shuttle 2/Alternate Shuttle]; Contact number; row[Capacity 12 · On duty
  select On/Off duty]; Notes (textarea).

---

## 10. States & copy

- Loading `Skeleton`, error `Feedback`, empty `Empty` + guidance + create CTA where
  relevant, permission-denied text, disabled + pending buttons. Keep "Sample data"
  chips where records are synthetic.
- Status by meaning (color **and** text, never color alone): Active/Approved/Paid green;
  Invited/Pending/Due amber; Suspended/Rejected/Expired red; Exited/Closed neutral.
- Verbs that say what happens: Add homeowner, Record payment, Approve membership,
  Publish, Save changes, Deactivate account — never Submit/Proceed/Execute.

## 11. Decisions flagged for Codex (do NOT silently change)

1. **Access matrix** — keep the real 3-level `TabAccess` (+ limited-edit + inherit
   defaults + server save/optimistic concurrency); restyle only. The 2-toggle above is
   the artifact's simplification and would delete capability.
2. **Live KPIs** — every overview count/number comes from existing RPCs; show real
   empty/unavailable states, never placeholders.
3. **Permission gating** — the artifact shows all 5 workspaces + all modules to one
   user; the real app gates by permission. Preserve gating; nav/counts reflect access.
4. **Synthetic labels** — never relabel local persistence as an HOA confirmation.
5. **Account integrity** — any account-creation change: run
   `npm run check:account-integrity`, update `docs/vault/*` (reconcile `Verification.md`,
   which had uncommitted edits during Claude's pass), and preserve the `created`/
   `member_linked` confirmation.

## 12. Verification per change
`npm run typecheck` + `npm run build` green · `git diff --check` clean · light+dark,
desktop/tablet/mobile · focus + reduced motion · states intact · presentation/copy
only (no logic/route/RPC/schema drift) · owner does browser verification.
