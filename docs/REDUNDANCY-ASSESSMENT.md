# Redundancy assessment — 7 November 2026

Measured from the migrations and the source. The aim is to name what overlaps
and say which half should win, not to delete anything.

## The shape of the problem

The system grew two ways of recording work:

1. **Dedicated tables** with their own endpoints, written for one workflow:
   `bfe_requests`, `bfe_visitor_passes`, `bfe_bookings`, `bfe_shuttle_requests`,
   `bfe_lots` / `bfe_receipts`, `bfe_activity_participation`.
2. **Feature-record modules** — 34 definitions sharing one table
   (`bfe_feature_records`), one submit endpoint, one review endpoint and one
   screen.

The second was built to describe *every* workflow in the system, including ones
the first already implements. That is where the duplication comes from. It is
also what made vehicles, permits, incidents and board reports cheap to add, so
the pattern is worth keeping — just not pointed at workflows that already have
a purpose-built home.

## Direct duplicates — a decision is needed

| Module | Already implemented by | Which should win |
| --- | --- | --- |
| `complaints` | `bfe_requests`, category Complaint | **Helpdesk.** It has threaded replies, status transitions and office assignment. The module has none of those. |
| `concerns` | `bfe_requests`, category Concern | **Helpdesk**, same reasoning. |
| `tickets` | `bfe_requests` status and assignment | **Helpdesk.** |
| `messages` | `bfe_request_messages` | **Helpdesk threads.** |
| `walk-ins` | `bfe_visitor_passes` | **Visitor passes.** They enforce lot membership and gate entry/exit; the module cannot. |
| `gate-passes` | `bfe_visitor_passes` | Open question. A gate pass for *materials* is arguably a different record from a *visitor* pass — but today they overlap and both are resident-creatable. |
| `ride-requests` | `bfe_shuttle_requests` | **Shuttle requests.** They have driver assignment, expiry and presence. |
| `unit-register` | `bfe_lots` | **Lot register**, which holds the imported registry with evidence and audit. |
| `payment-evidence` | `bfe_receipts` | Neither cleanly. Receipts record payments the office imported; the module is a resident submitting proof. They are complementary, but nothing links them. |
| `facility-rules` | `bfe_configure_facility` | **The endpoint.** The module proposes settings that an existing RPC already applies. |
| `access-proposals` | `bfe_provision_access` | **The endpoint**, for the same reason. |

Migration 017 made `complaints`, `concerns`, `gate-passes` and `walk-ins`
resident-creatable, which widened three of these rather than narrowing them.
That was done at the owner's request to let residents file complaints; the
discoverability fix in UI-22 turned out to be the real answer, so the flags
could reasonably be reverted for `complaints`, `concerns` and `walk-ins`.

## Duplicate screens

Seven components carry a `Sample…` twin beside their connected version:
`Account`, `Community`, `CommunityModules`, `FlowDesk`, `ReviewDesk`, `Office`,
`FieldWorkspace`. Each is two implementations of one screen, selected by
`auth.preview`.

This is not accidental and should not be removed wholesale — the preview is how
the product is demonstrated without a database. But it has a real cost:
**a fix applied to one twin does not reach the other**, and the connected half
is the one that has never been tested. `/office/registry` is blocked today for
exactly this reason: `FlowDesk` has a connected branch for `area="gate"` and
none for `area="registry"`.

## Duplicate routes

- `/admin` and `/office/finance` render the same component.
- `/office/vehicles` and `/office/permits` now show what `/office/review`
  already lists. Defensible as shortcuts, but they are three doors to one desk.
- `/services/calendar` and `/services/bookings` **were** duplicates; merged at
  the owner's suggestion, and both now render one screen.
- `/more/marketplace`, `/directory/market` and the removed Community directory
  tile all reached the same published records.

## Modules with no implementation behind them

`guard-roster`, `stations`, `budgets`, `billing-proposals`, `election-setup`,
`expense-evidence`. These are not duplicates — they are descriptions of
workflows that were never built. They appear in the developer workbench and
nowhere else, which is honest, but they inflate the apparent feature count.

## Recommendation

1. **Decide the Helpdesk four** (`complaints`, `concerns`, `tickets`,
   `messages`). Setting `resident_create=false` on the first two is one
   statement and removes the most visible confusion.
2. **Decide gate passes vs visitor passes.** This is a real policy question:
   are a delivery of construction materials and a visiting relative the same
   record? If not, say what distinguishes them.
3. **Leave the preview twins**, but treat the connected branch as the one that
   must exist. `/office/registry` is the outstanding case.
4. **Leave `/office/vehicles` and `/office/permits`.** Multiple doors to one
   desk is a navigation convenience, not debt.
5. **Leave the unimplemented modules.** They are a roadmap, and they are not
   pretending to work.

Nothing here is urgent. None of it is broken. It is the cost of having grown a
general mechanism alongside specific ones, and the main risk is a resident
filing a complaint in a place the office does not watch.
