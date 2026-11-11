# Field-level gap assessment — 9 November 2026

> Historical assessment: registration, enriched passes, announcement media, issuance and member management have since changed. Use [the current legacy-form coverage assessment](LEGACY-FORM-COVERAGE-ASSESSMENT.md) for the 10 November comparison. The original findings below are preserved as history.

What the reference HOA application asks for, against what this rebuild asks for.
Extracted from `reference/upstream-hoa/HOA-1.html` as workflow information only;
no markup, styling or code was taken.

Counts: **214 distinct named form fields** in the reference, **192 fields across
35 modules** here. The totals are close, which is misleading — they are not the
same 200 fields, and the differences cluster in specific places.

## 1. Whole features with no equivalent here

### Resident self-registration — the missing front door

Ten fields: full name, email, mobile, unit, "I am the" (owner or tenant), name
of registered owner if a tenant, proof of residence, document or reference
number, anything else the admin should know.

**The storage already exists.** `public.registrations` carries exactly those
columns — name, email, phone, unit, role, proof, proof_ref, owner_name, note,
status, review_note, reviewed_by, reviewed_at — left from the legacy system.
Nothing in the rebuild reads or writes it.

Consequence: a new resident cannot apply. Accounts are created by hand in the
SQL editor, which is what was done for the two live homeowners on 7 November.
This is the single largest gap in the system and it is not a field, it is an
entrance.

### Household members

Four fields: member type, full name or nickname, relationship to you, mobile.
Lets a household list the people who live there. `household-changes` here
proposes a *change* to occupancy; it does not maintain a roster.

### Association settings

Association name, registered address, office hours, quiet hours. `facility-rules`
here submits a *proposal* about settings; there is nowhere the actual values
live. Quiet hours in particular are referenced by other workflows.

### Dues configuration and billing

Flat monthly dues per household, dues rate per square metre of lot area, due day
of month, late fee percentage — then payment recording with amount, pay-with
method, date paid, payee, billing period, memo and reference.

Here there is `billing-proposals` (a proposal) and `payment-evidence` (a
resident submitting proof). There is **no invoice table and no billing engine**,
which is why the home screen shows an honest zero.

### Chat

A live message thread. Request replies exist here and cover much of it, but the
reference treats chat as its own channel.

## 2. Features present, fields missing

| Feature | Missing here |
| --- | --- |
| **Carpools** | **"I am" (driver or rider)** — without it the feature cannot distinguish offering a seat from asking for one; gas share per rider; note |
| **Visitor / walk-in** | **how many people**; **how are they coming** (on foot or vehicle); note for the household |
| **Gate pass** | expected time; note. Guard-side checking fields ("what does not match", reason) have no equivalent because there is no guard-check flow |
| **Issues / complaints** | **"what was decided"** — the resolution text closing a case; assigned-to; where |
| **Board reports** | total collected (income); total spent (expenses); link to the full report; date published |
| **Announcements** | days to stay posted; attachment tag; photo |
| **Shuttle** | station number; note for the driver; minutes-away estimate |
| **Election candidates** | credentials |
| **Booth events** | theme and vendor rules |
| **Guard roster** | contact number; shift expressed as a named shift rather than start/end times |
| **Profile** | position; **digest frequency** — the notification preference the settings screen currently says does not exist |
| **Unit registry** | admin unit IDs, phase/block/lot/street as separate fields, HOA start date, admin remarks, multiple owner names, multiple statuses, linear-park flag |

## 3. Where this rebuild asks for more

Not everything is a deficit.

- **Garage sales** — 7 fields here against 4 there; location, items and contact
  are additions.
- **Vehicles & stickers** (11) and **permits** (9) are richer than anything in
  the reference, and both use conditional fields so the extra questions only
  appear when they apply.
- **Incidents** (10) is new work with no reference counterpart.
- Every module here carries an explicit review workflow, audit trail and
  workflow history. The reference does not expose those per record.

## 4. What this means

The rebuild is not a thinner copy. It is differently shaped: deeper on
submission, review and audit, thinner on **operational detail** — the small
fields a guard, a driver or an officer needs at the moment of acting. Party
size, expected time, who is driving, what was decided.

Three of the gaps are structural rather than cosmetic:

1. **Registration** — there is no way in without a database editor.
2. **Billing** — no invoices, so no balance, so no dues.
3. **Association settings** — no stored values for hours, address or quiet hours.

Everything in section 2 is a field to add to an existing module, mostly a few
lines each. Section 1 items are projects.

## 5. Not assessed

Field *validation* rules were not compared, only presence. The reference's own
required/optional marking was not extracted, so "missing" here means the
question is not asked at all, not that it is asked differently.
