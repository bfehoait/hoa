# Feature baseline

Update, 5 November 2026: [[Connected workflows]] extends this earlier baseline to **31 modules** and connects publication, directories, notices/documents, conversations, parent-linked interests, operational views and printable statements. The earlier gaps below are historical; use the connected-workflow note and `/coverage` for current behavior and exact remaining limits.

Status: source-informed local workflow expansion, 4 November 2026. This is not a completed production migration or a guarantee of identical source behavior.

The original snapshot stays read-only and isolated. Its full downloaded contents, checksums, 591 named function identifiers, 64 structure descriptions, 18 record shapes and 79 navigation entries remain available as evidence. No source code, design, assets, credential values, resident data or backend connection is reused. See [[Source coverage ledger]].

## Inspect the implementation

Open `/explore` or **More → Full feature baseline**. The directory has 30 structured modules across ten areas, plus CSV staging and an assessment calculator. The approved home design stays intact. Marketplace, learning, transport, office and source-catalogue pages link to the relevant expanded workflows.

Each module has its own fields, source evidence, three workflow steps, search/state filtering, CSV export, draft editing, local submission/review/change-request/archive states, follow-up notes and visible history. A synthetic-example button makes demonstrations repeatable. State changes remain local samples, never HOA decisions. Editing is restricted to Draft and Changes requested states within the preview model; this is not security enforcement.

| Area | New structured workflows | Important local behavior |
| --- | --- | --- |
| Property | Property register drafts; household changes | Unit, owner/occupancy/area metadata; proposed member, tenant and ownership changes |
| Livelihood | Businesses; buy/sell; jobs; garage sales; booth events; vendor applications | Hours/contact; condition/price; hiring/seeking/setup/deadline; scheduled item lists; linked vendor proposals |
| Learning | Training sessions; learning interests | Facilitator, venue, fee and capacity; participation linked to an active local session |
| Transport | Ride requests; carpools; seat interests; stations | Sequential dispatch simulation; route/seat details; linked local interests; sample dispatcher roster |
| Support | Complaints; concerns; tickets; resident–office inbox | Separate issue fields, priority/channel/assignee proposals and local conversation notes |
| Security | Gate passes; walk-ins; guard roster | Separate purposes/items, destination units and proposed posts/shifts |
| Community | Notice details; community events | Proposed audience/pinning/asset descriptions and event windows |
| Governance | Board documents/disclosures; election preparation | Version/audience/source metadata; election schedule and unresolved rule questions, without ballots or tallies |
| Finance | Expense evidence; billing proposals; payment evidence; budgets | Evidence and allocation proposals; rate/mode/due date; planned-minus-actual variance |
| Administration | Account/access proposals; facility/association settings | Invitation/suspension/role/override/view-only proposals; versionable setting proposals, with no grants applied |

## Linked workflows and simulations

- Create a booth event before its vendor applications. Applications select an active local parent. A local booth-number proposal must fit its sample capacity and cannot duplicate another active proposal. This does not approve a vendor or allocate an actual booth.
- Create training sessions and carpools before related interests. Details show local interest totals against supplied sample capacity, including an over-capacity warning. Interest does not reserve places, and no real enrollment or seat inventory is implemented.
- Ride requests have an explicitly labelled queue → assigned → on the way → at pickup → completed simulation. Steps advance in order and stop at completion. No driver is contacted or verified.
- Drafts can be edited, submitted locally and reviewed. Changes requested returns to an editable state; cancelled/archived items stop accepting notes and simulations. There is no Approved or Paid state.
- Conversations append editable-browser local history labelled **not sent**. There is no participant authentication, delivery receipt, private inbox or protected audit service.

## Import staging and finance

`/explore/imports` accepts pasted text or a synthetic CSV file, with a 100 KB / 100-row cap. It parses quoted commas/newlines/escaped quotes and BOM/CRLF; requires unique headers and consistent row widths; maps distinct source columns; validates every row; then saves the entire valid batch as local drafts in one workspace write. A storage failure is reported. Invalid batches write no rows. Duplicate units/evidence references within the batch and conflicts with active local drafts are rejected. These local checks are not transactional server import idempotency or official duplicate-resolution rules.

Templates cover property-register metadata, payment evidence and expense evidence. Units must use `Demo A-09` format, owner labels must begin `Demo ` and evidence references must begin `DEMO-`. These checks encourage synthetic examples; they cannot determine whether arbitrary text contains real personal information. Never upload resident exports. Source records are not imported.

Payment evidence does not modify invoice balances or produce receipts. Expense drafts do not post to an official ledger. Review staged rows through their matching module. CSV exports are marked synthetic and use the existing formula-safe cell encoder. There is no source PDF export replica or official signed statement service.

`/explore/calculator` requires supplied sample rates and optionally area. It shows flat or rate × area math rounded to centavos. Unknown values remain uncalculated. It creates no invoices or payment states. Budget drafts show sample variance only.

## Coverage boundaries before later customization

This preserves the source information and adds usable local workflows for many previously missing features. It does **not** establish complete behavioral parity for all 591 functions. Functions include helpers and rendering code, not 591 independent product features. The original inventory's gap strings are frozen comparison evidence; current work is described here and in [[Verification]].

Existing registration, resident bills/history, office reports, request assignment, bookings, visitor requests, vehicle/permit queues, local announcement publication, document metadata, preview settings and developer maintenance remain available. The new detailed forms supplement them; proposed notices and document details do not automatically synchronize with the existing publication queues. Active structured event, training and booth proposals appear alongside booking requests on the local calendar, with sample labels and no confirmed availability. Local drafts do not create a published vendor/business directory or send external applications. Further integrations require implementation and approved behavior.

Server/policy gates still include real authentication/logout/recovery/invitations, protected roles/view-only restrictions and RLS, verified household transfers, imports with trusted source/duplicate resolution, private files/messages, publishing audiences and real delivery, financial posting/receipts/reconciliation, confirmed amenity/enrollment/seat/booth allocation, gate verification/entry-exit events, authoritative incidents, private ballots and certified tallies. Live records, missing SQL dependencies and approved official contacts/settings cannot be recovered from this snapshot. Hosting, monitoring, backup/restore, actual-device/resident acceptance and store release remain separate.

Next customization should start with walkthroughs and decisions in [[Product questions]], not by treating source defaults or synthetic examples as approved policy.
