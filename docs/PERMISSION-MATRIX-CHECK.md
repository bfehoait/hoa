# Permission matrix vs the database — 7 November 2026

Checked the owner's two matrix sheets against what migration 003 actually seeded.
No officer or chairperson names are recorded here; they are real people and
belong in the association's own records, not in this repository.

## Committee Matrix — already implemented, and it matches

All **12 committees** exist in `bfe_access_committees` with the same names and
in the same order as the sheet. `bfe_access_workbook` stores **204 rows** of
committee × module at exactly the sheet's levels: V, D, R, M, none.

Spot-checked row by row. The column names map as:

| Sheet column | Stored module |
| --- | --- |
| Issues, Complaints & Concerns | `requests` |
| Homeowners | `people` |
| Homeowner Profiles | `profiles` |
| Operations & Maintenance | `operations` |
| Livelihood and Marketplace | `livelihood` |
| Security & Access | `security` |
| Announcements | `community` |
| Governance & Community | `documents` |
| Financial | `finance` |
| Shuttle service | `transport` |
| ALL MODULES | `all_modules` |

Grievance, for example, is stored as overview V, messages D, requests D, people
V, profiles V, property V, operations D, livelihood V, calendar V, security D,
community V, hotlines V, documents D, finance none, reports none, transport D —
identical to the sheet. Finance and Data Governance likewise.

**Nothing to change here.** The committee half of the model is correct.

## View Matrix — base role grants also match

`bfe_can_for` grants homeowners and renters exactly what the sheet says:

| Sheet row | Stored base grant | Agrees |
| --- | --- | --- |
| My profile and settings — O for every role | `profile` view/create own, all roles | yes |
| My support and privacy requests — O for every role | `support` view/create own | yes |
| Emergency hotlines / Announcements — V for all | `hotlines`, `community` view approved | yes |
| My requests and repairs — O homeowner & renter, — driver & guard | `requests` view/create/reply own, homeowner & renter only | yes |
| Events and facility bookings — V O homeowner & renter | `calendar` view/create own, homeowner & renter | yes |
| My statements and receipts — V own homeowner, — renter | `finance` view own, **homeowner only** | yes |
| Business directory, marketplace, garage sales, booth events, jobs — V O homeowner, — renter | `livelihood` view/create own, **homeowner only** | yes |

This settles an open question from the role readiness assessment. A renter
having no access to statements or the marketplace is **deliberate association
policy**, not a defect. It should stay as it is, and the interface should
probably say why rather than simply showing a renter less.

It also supports migration 021: "Complaints and concerns" is one row at `O`
under the requests umbrella, not a separate module.

## Two gaps worth a decision

### 1. Super admin is all-powerful; the matrix says it should not be

**Correction to an earlier reading.** `bfe_can_for` was replaced by migration
014 and is now the tab-rule layer; base grants moved to
`bfe_legacy_can_for`. The unconditional developer line lives there:

```
IF 'developer' = ANY(v_roles) THEN RETURN true;
```

and `bfe_can_for` reaches it via
`IF 'developer'=ANY(roles) THEN RETURN public.bfe_legacy_can_for(...)`. The
conclusion is unchanged — a developer still passes every check — but the
function to edit is `bfe_legacy_can_for`.

That grants the developer role **every action on every module at every scope**,
unconditionally. The View Matrix gives Super admin only:

- My profile and settings — O
- My support and privacy requests — O
- Emergency hotlines — V

and a dash everywhere else, including announcements, which even a guard may
read. Read plainly, the matrix says a super admin is a technical account that
should **not** see household records, complaints, statements or the marketplace.

The database currently says the opposite. This is a privilege question, not a
bug to fix quietly: either the matrix means something narrower than it reads, or
the developer shortcut needs replacing with explicit technical-only grants.
`technical` is already handled separately and correctly — it is never inherited
from admin or All Access — so the pattern exists.

### 2. BOD has no base grants

The matrix gives BOD **R** (approved summaries or authorised review) across
most modules. `bfe_can_for` gives the `board` role nothing by default; a board
member sees only what a committee assignment or a tab rule grants them.

So a BOD member with no committee assignment currently sees very little. If the
matrix means every BOD member holds R by virtue of the office, that belongs in
the base grants. If R is meant to arrive through assignment, the current
behaviour is right and the matrix is describing the intended end state rather
than the mechanism.

## Recommendation

The committee matrix needs no work. Before changing anything in the database,
decide those two questions — both are about who may see residents' records, and
neither should be settled by whoever edits the SQL next.
