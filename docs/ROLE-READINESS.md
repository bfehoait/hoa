# Role readiness assessment — 7 November 2026

Written before wiring anything further, at the owner's request. Every claim
below comes from reading the source and the migrations; nothing here was
confirmed by using the app except where it says so.

## The distinction that matters

Three different things look identical from the outside when a screen is empty:

1. **Connected** — the screen calls a real endpoint and works for a signed-in
   account.
2. **Preview-only** — the screen exists but reads `usePortal()` or
   `useWorkspace()`, both of which **throw** for a real account
   (`data/usePortal.ts:11`, `data/workspace.ts:756`: "Local demonstration data
   is unavailable in your account"). These cannot work signed in, no matter
   what permissions the account holds.
3. **Missing** — no endpoint exists at all.

Most of the remaining work is category 2, not category 3. That is good news:
the backend is further along than the screens are.

## Needs checking first — possible live defect

`/office/finance` and `/office/requests` are **allowlisted as available**, but
both route to `features/admin/Admin.tsx` (`office/Office.tsx:171` and `:178`),
which imports `householdLedger` from `data/fixtures` and reads `usePortal()`.
`Admin.tsx` has no preview branch — it is fixture-backed only.

If that reading is right, a real admin account opening Finance or Requests gets
an error rather than a screen. **Verify before building anything else**: sign in
as the admin-capable account and open `/office/finance`. This is cheap to check
and changes what the office workspace needs.

`/office/history` routes to the same component and is already blocked, which is
consistent with that reading.

## The ten blocked routes, by what they actually need

| Route | Backend exists? | What is missing |
| --- | --- | --- |
| `/office/registry` | **Yes** — `household-changes`, `unit-register`, LotRegister | `FlowDesk area="registry"` has no connected branch; only `area="gate"` does (`FlowDesk.tsx:49`). Needs a connected screen. |
| `/office/vehicles` | **Yes** — `vehicles` module (018) | Nothing. `/office/review` already lists every module, so this is a dedicated view or a redirect. |
| `/office/permits` | **Yes** — `permits` module (018) | Same as above. |
| `/office/history` | **Yes** — `bfe_workflow_history`, already used elsewhere | Routed to the fixture-backed `Admin`. Needs a connected screen. |
| `/office/settings` | **Partly** — `bfe_configure_facility`, `facility-rules` module | Routed to the fixture-backed `Admin`. Needs a connected screen. |
| `/security/vehicles` | **Yes** — `vehicles` module (018) | A lookup view. Review already works via `/office/review`. |
| `/explore/imports` | **Yes** — `bfe_import_registry` exists and **nothing in the UI calls it** | A screen. The endpoint is finished and unused. |
| `/board/reports` | **No** | Both the endpoint and the screen. |
| `/security/incidents` | **No** | Both. |
| `/explore/calculator` | **No** | Depends on billing, which does not exist. |

Seven of ten already have a working backend. Three are genuine ground-up work.

## By role

| Role | Workspace | Assessment |
| --- | --- | --- |
| Homeowner | `/` | Wired. Permits, vehicles, helpdesk, marketplace and the home summary confirmed working on real data by the owner. |
| Renter | `/` | Wired but deliberately narrower — see below. Never tested. |
| Admin | `/office` | Mixed. Connected: People, Access, Review, Bookings, Visitors, Calendar, StaffHome. Fixture-backed: Finance, Requests, History, Settings. Never tested. |
| Board | `/board` | Documents, updates, elections and shuttle are connected. Only `/board/reports` is missing. Never tested. |
| Security | `/security` | `/security/gate` has a connected branch (`OperationsDesk kind="visitor" office`). Visitors connected. Incidents and vehicle lookup missing. Never tested. |
| Driver | `/driver/dispatch` | Screen is connected; blocked entirely by an empty `bfe_shuttles`. Needs a driver account. Never tested. |

## Renter is narrower on purpose

`bfe_can_for` gives homeowner and renter the same base grants for requests,
calendar, profile and support — but **finance view/own and livelihood
view/create/own are homeowner-only**. A renter therefore cannot see bills or
post to the marketplace, and nothing in the interface explains why.

That is an association policy question, not a defect. It should be decided
deliberately rather than discovered by a renter.

## Duplicated surfaces

Found while assessing; each is a decision, not a bug:

- **Complaints**: the Helpdesk (`bfe_requests`) accepts Complaint and Concern
  categories *and* `complaints`/`concerns` exist as feature modules. Migration
  017 made the modules resident-creatable. One of the two should win; the
  Helpdesk has threaded replies and status, the modules do not.
- **Vehicles and permits review**: `/office/review` already covers them, so
  dedicated `/office/vehicles` and `/office/permits` screens may be redundant.
- **`/admin` and `/office/finance`** render the same component.

## Not built

- **Billing.** No invoice table in nineteen migrations. `bfe_lot_receipts`
  records payments made, never charges owed. Needs association rates, billing
  periods and allocation rules before it can be built honestly.
- **Facility and shuttle configuration.** `supabase/seed-test-configuration.sql`
  holds clearly-labelled placeholders. The shuttle half needs a driver account.

## Recommended order

1. **Check `/office/finance` as a real admin account.** One minute, and it
   determines whether the office workspace needs repair or only extension.
2. **Test the permission boundaries.** Nothing has ever confirmed that a
   resident is refused office screens, or that households are isolated from one
   another. Two real residents are being onboarded; this stops being theoretical.
3. **Run the facility seed** so booking and the merged calendar can be finished.
4. **Create a driver account** — one account unblocks both sides of the shuttle.
5. Then wire the seven blocked routes that already have backends, cheapest
   first: `/office/vehicles`, `/office/permits`, `/security/vehicles`,
   `/explore/imports`, `/office/history`, `/office/settings`,
   `/office/registry`.
6. Decide the duplicates and the renter policy.
7. Billing last, and only with real rates.

Steps 1 and 2 cost almost nothing and could change everything after them. They
should happen before any more code is written.
