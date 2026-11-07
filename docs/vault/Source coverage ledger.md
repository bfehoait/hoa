# Source coverage ledger

Current local delivery map: `/coverage` lists all 16 extracted families and 76 observed feature statements with local entry points and remaining server gates. [[Connected workflows]] records the latest implemented integrations. This frozen inventory remains source evidence, not a claim of complete behavioral parity.

Status: **Observed source inventory; partial local preview coverage. Not production parity or data migration.**

The user authorized a separate read-only clone of `https://github.com/bfehoait/hoa` on 4 November 2026. It is stored under `reference/upstream-hoa/`, ignored by the application repository and blocked from the dev server. No legacy source is imported/executed and no source backend was contacted.

Snapshot commit: `07299ea0bcf814dda3e1e5e85533f82a248d7409`. Static parser results: 8,891 application lines, 591 named functions, 50 root store properties, 64 structure descriptions, 18 record-construction shapes and 79 page/navigation entries. These are source counts, not live database counts or verified feature completion.

`index.html` and `HOA-1.html` are byte-identical. The source also includes a privacy page, one registrations SQL file, deployment configuration and image assets. Images, raw data values, passwords, configuration values, contacts and ballots are not copied into the app. Provenance/checksums are in `reference/upstream-provenance.json`.

The safe browser catalogue is `/developer/source`. Its metadata is in `packages/shared/src/reference-inventory.json`; the project-owned `scripts/inventory-reference.mjs` reads syntax without evaluating it. Raw reference HTML must never be opened through a preview server or executed.

## Coverage and gaps

Update: the later [[Feature baseline]] expansion adds 30 structured local modules, CSV staging, linked interests/vendor proposals, local conversations and dispatch simulation at `/explore`. The feature/gap lists below preserve the initial inventory comparison. They are not an up-to-date completion checklist; use the baseline note and [[Verification]] for current behavior and limitations.

Each family below has a related local preview entry point. That does not mean all listed source workflows exist there. In particular, category-specific livelihoods, full dispatch/carpools, imports, real messaging, secure files, approvals and authority remain partial or unimplemented. Existing production gates in [[Master implementation plan]], [[Permission planning matrix]] and [[Release acceptance]] still apply.

### Accounts and registration

Related preview: `/register`. Source evidence: `index.html` lines 1097, 7146, 7262, 7313, 8324, 8432, 8474, 8522 at the snapshot commit.

Observed feature information:
- Registration and proof review
- Invitations and manual login setup
- Household profiles
- Main and extra roles
- Profile/privacy preferences

Still required / not established:
- Real auth and invitations
- Approved household verification
- Server-owned account changes

Source state keys: `accounts`, `household`, `linked`. No source field values were migrated.

### Access and audit

Related preview: `/office/access`. Source evidence: `index.html` lines 2029, 6970, 7146, 7170, 8203, 8244, 8290 at the snapshot commit.

Observed feature information:
- Role and page access
- Individual overrides
- Access managers
- View-only mode
- Account-change supporting references
- Audit search and history

Still required / not established:
- Approved effective-permission rules
- RLS/RPC enforcement
- Protected server audit

Source state keys: `hiddenPages`, `userAccess`, `accessAdmins`. No source field values were migrated.

### Announcements and inbox

Related preview: `/office/community`. Source evidence: `index.html` lines 3427, 3500, 3579, 4736, 4750, 4851, 5402 at the snapshot commit.

Observed feature information:
- Audience-targeted and pinned notices
- Notice attachments, images and QR content
- Resident-office messaging
- Unread/conversation state
- Notifications

Still required / not established:
- Approved publishing audiences
- Protected files
- Real message delivery and read state

Source state keys: `announcements`, `notifs`. No source field values were migrated.

### Properties and master data

Related preview: `/office/residents`. Source evidence: `index.html` lines 2538, 2581, 7412, 7585, 7590 at the snapshot commit.

Observed feature information:
- Lot and owner registry
- Occupancy and rate metadata
- Search and column mappings
- Unit import and export
- Approved master-data settings

Still required / not established:
- Trusted registry and transfer rules
- Validated import review
- Versioned normalized tables

Source state keys: `units`, `settings`. No source field values were migrated.

### Operations and support

Related preview: `/office/operations`. Source evidence: `index.html` lines 2659, 3635, 7944, 7958, 7976, 8171, 8184 at the snapshot commit.

Observed feature information:
- Requests with assignment, priorities and replies
- Complaints and named-party handling
- Concerns and resident-office replies
- Support tickets
- FAQ/help and status dashboards

Still required / not established:
- Distinct approved workflow definitions
- Confidentiality boundaries
- Escalation and delivery

Source state keys: `requests`, `complaints`, `concerns`, `tickets`, `faqs`. No source field values were migrated.

### Amenities and calendar

Related preview: `/services/calendar`. Source evidence: `index.html` lines 2760, 3069, 5335, 6728, 6798, 6803 at the snapshot commit.

Observed feature information:
- Community events and combined calendar
- Amenity rules and facility selection
- Requests and booking decisions
- Booking status tables
- Fees/capacity and conflicts

Still required / not established:
- Actual availability/conflict prevention
- Approved capacity, fees and cancellation
- Server confirmation

Source state keys: `bookings`, `amenityRules`, `events`, `calMonth`. No source field values were migrated.

### Gate, visitors and vehicles

Related preview: `/security`. Source evidence: `index.html` lines 2258, 4133, 4269, 5118, 5119, 5160, 5163, 5741, 7912 at the snapshot commit.

Observed feature information:
- Visitor lookup and walk-ins
- Visitor and vehicle passes
- Separate gate-pass purposes/items
- Guard roster and security assignments
- Vehicle stickers and access history

Still required / not established:
- Approved guard capabilities
- Pass validity and device events
- No real QR or gate authority in preview

Source state keys: `passes`, `stickers`, `gatePasses`, `guards`, `secAdmin`. No source field values were migrated.

### Incidents

Related preview: `/security/incidents`. Source evidence: `index.html` lines 5182, 7926, 7940 at the snapshot commit.

Observed feature information:
- Incident reporting and closure
- Location, evidence and responsible staff
- Restricted security review

Still required / not established:
- Confidentiality and escalation
- Approved operational response
- Verified emergency contacts

Source state keys: `incidents`. No source field values were migrated.

### Billing and receipts

Related preview: `/office/finance`. Source evidence: `index.html` lines 1570, 6575, 6590, 7519, 7538, 7844, 7859 at the snapshot commit.

Observed feature information:
- Billing modes and runs
- Dues and lot-payment histories
- Official-receipt/reference fields
- Statements and outstanding balances
- Payment entry/import mappings

Still required / not established:
- Approved accounting definitions
- Server-owned receipts and allocations
- No payment gateway connected

Source state keys: `dues`, `lotPayments`, `ledger`. No source field values were migrated.

### Expenses and reporting

Related preview: `/office/finance/expenses`. Source evidence: `index.html` lines 3004, 7599, 7614, 7630, 7666, 7700, 7767 at the snapshot commit.

Observed feature information:
- Expense categories and approval
- Expense imports/templates
- Monthly expenses and budget
- Collection-history reports
- Report exports

Still required / not established:
- Approved review/reversal policy
- Bank reconciliation
- Authorized real exports and file evidence

Source state keys: `expenses`, `budget`, `collectionsHistory`, `reportLog`. No source field values were migrated.

### Business and buy/sell

Related preview: `/more/marketplace`. Source evidence: `index.html` lines 1223, 1456, 3120, 5992, 6046 at the snapshot commit.

Observed feature information:
- Resident businesses and owner profiles
- Business hours, contact and external links
- Buy/sell categories and listing photos
- Owner listing management
- Listing visibility and moderation

Still required / not established:
- Detailed category-specific forms
- Provider verification/contact consent
- Moderation and protected media

Source state keys: `marketplace`. No source field values were migrated.

### Jobs, garage sales and booths

Related preview: `/more/marketplace`. Source evidence: `index.html` lines 1195, 1280, 1293, 3152, 3310, 3355, 6116, 6182, 6234, 6337, 6361, 6390 at the snapshot commit.

Observed feature information:
- Hiring and service-seeking job listings
- Job setup, deadline and application link
- Garage sale schedules and item review
- Booth events and applications
- Vendor directory, numbered booth assignment and capacity

Still required / not established:
- These detailed submodules are not fully implemented
- Approved fees/capacity/moderation
- Safe media/contact handling

Source state keys: `marketplace`, `boothEvents`, `boothApps`. No source field values were migrated.

### Training

Related preview: `/more/training`. Source evidence: `index.html` lines 5781, 5797, 5809, 5823 at the snapshot commit.

Observed feature information:
- Training schedule and facilitator
- Capacity, fee and attendee counts
- Join/leave and enrollment states
- Training listing review

Still required / not established:
- Detailed enrollment/capacity workflow
- Approved fees and personal-data scope
- No real session enrollment

Source state keys: `marketplace`. No source field values were migrated.

### Rides and carpools

Related preview: `/driver`. Source evidence: `index.html` lines 4969, 5012, 5071, 5547, 5603, 5636, 5660, 5683, 5703, 5713 at the snapshot commit.

Observed feature information:
- Stations and dispatch queues
- Ride request/acceptance/progress
- Driver/vehicle assignment and pickup
- Trip histories
- Resident carpools and join/leave/cancel

Still required / not established:
- Full dispatch and carpool workflow
- Verified driver/route/fare rules
- No real trip or seat authority

Source state keys: `rides`, `carpools`. No source field values were migrated.

### Board documents and disclosures

Related preview: `/board`. Source evidence: `index.html` lines 5206, 5246, 5272, 6837 at the snapshot commit.

Observed feature information:
- Board oversight and financial summaries
- Board document metadata and links
- Disclosures and house rules
- Governance reports

Still required / not established:
- Approved official files and versions
- Protected role-specific access
- Trusted financial provenance

Source state keys: `boardDocs`, `boardDocs_note`, `disclosures`, `rules`. No source field values were migrated.

### Elections

Related preview: `/more/elections`. Source evidence: `index.html` lines 4627, 5281, 8031, 8037, 8047, 8083 at the snapshot commit.

Observed feature information:
- Candidate management and photos
- Election opening/closing
- Eligibility/participation presentation
- Ballot and tally presentation

Still required / not established:
- Approved eligibility/proxy/secrecy design
- Server-owned ballot submission and tally
- No ballots or totals migrated

Source state keys: `election`. No source field values were migrated.

## Root source data/state dictionary

This includes UI/session state as well as data collections. It is not a proposed 50-table schema. Empty literal arrays do not establish that production is empty, and seeded entries must not be treated as verified residents or policy. Nested structures and record-construction fields are available in the safe JSON catalogue.

| Property | Source line | Static shape | Observed field names |
| --- | --- | --- | --- |
| `session` | 850 | object | authed, method, name, email, phone, unit, role |
| `view` | 852 | StringLiteral | Not determined / no fields in the literal |
| `tab` | 852 | object | Not determined / no fields in the literal |
| `seen` | 852 | NewExpression | Not determined / no fields in the literal |
| `theme` | 853 | ConditionalExpression | Not determined / no fields in the literal |
| `notifs` | 854 | array | Not determined / no fields in the literal |
| `calMonth` | 855 | NewExpression | Not determined / no fields in the literal |
| `lastSync` | 856 | object | msg, at |
| `accounts` | 858 | array | id, name, email, password, role, unit, title, phone, status, added, lastSeen |
| `boardDocs` | 882 | array | id, title, date, kind, by, note |
| `boardDocs_note` | 892 | StringLiteral | Not determined / no fields in the literal |
| `amenityRules` | 893 | array | facility, renters, note |
| `settings` | 899 | object | assocName, address, duesMode, duesRatePerSqm, duesFlatAmount, lateFeePct, dueDay, facilities, boothVenues, categories, officeHours, quietHours, autoApproveBookings, publishTallyLive, allowProxyVoting, showCollectionTracker, facilityRules |
| `prefs` | 917 | object | email, sms, push, digest, language |
| `linked` | 918 | object | google, facebook |
| `hiddenPages` | 920 | object | homeowner, renter, security, board, driver |
| `userAccess` | 922 | object | Not determined / no fields in the literal |
| `announcements` | 924 | array | id, title, date, category, pinned, hotlines, images, body, attach, vis, at, qrs |
| `hotlines` | 970 | array | id, name, tone, lines |
| `requests` | 987 | array | Not determined / no fields in the literal |
| `dues` | 988 | array | Not determined / no fields in the literal |
| `lotPayments` | 989 | array | Not determined / no fields in the literal |
| `disclosures` | 991 | array | Not determined / no fields in the literal |
| `bookings` | 992 | array | Not determined / no fields in the literal |
| `marketplace` | 993 | array | Not determined / no fields in the literal |
| `boothEvents` | 994 | array | Not determined / no fields in the literal |
| `boothApps` | 995 | array | Not determined / no fields in the literal |
| `events` | 996 | array | id, title, date, time, where, note |
| `units` | 1003 | array | Not determined / no fields in the literal |
| `ledger` | 1004 | object | opening, reserve |
| `expenses` | 1005 | array | Not determined / no fields in the literal |
| `budget` | 1006 | array | category, planned, actual |
| `collectionsHistory` | 1013 | array | Not determined / no fields in the literal |
| `passes` | 1016 | array | Not determined / no fields in the literal |
| `stickers` | 1017 | array | id, unit, plate, vehicle, tag, expires, status |
| `incidents` | 1022 | array | Not determined / no fields in the literal |
| `gatePasses` | 1023 | array | Not determined / no fields in the literal |
| `secAdmin` | 1024 | object | oic, secondary, revoked |
| `accessAdmins` | 1025 | array | Not determined / no fields in the literal |
| `household` | 1026 | array | Not determined / no fields in the literal |
| `guards` | 1027 | array | post, name, shift, contact |
| `complaints` | 1034 | array | Not determined / no fields in the literal |
| `concerns` | 1035 | array | Not determined / no fields in the literal |
| `rules` | 1036 | array | id, title, text |
| `election` | 1042 | object | id, title, opens, closes, status, eligible, positions, votes, ballotsCast, ballots |
| `tickets` | 1060 | array | Not determined / no fields in the literal |
| `faqs` | 1061 | array | q, a |
| `reportLog` | 1067 | array | Not determined / no fields in the literal |
| `carpools` | 1070 | array | Not determined / no fields in the literal |
| `rides` | 1071 | array | Not determined / no fields in the literal |

## Backend evidence and missing files

Observed table call sites: `audit_log`, `members`, `portal_data`, `registrations`.
Observed browser RPC call sites: `admin_set_login`, `claim_membership`.

The only supplied SQL is `supabase-registrations.sql` (45 lines). It defines registration structure/policy statements but depends on prior setup and `my_role()` authority. That function and the complete production schema are not established by this repository.

Missing referenced SQL files:
- `supabase-audit-trail.sql`
- `supabase-manual-accounts.sql`
- `supabase-setup.sql`

No SQL was run, policy tested or backend queried. A static call site or policy statement cannot prove deployed security. Do not apply the legacy SQL to the new project as an approved migration.

## Rules for converting information into this system

| Source information | Safe implementation boundary |
| --- | --- |
| Accounts with password-related fields | Use approved identity-provider accounts; never migrate seeded/plaintext passwords into browser fixtures or a new auth design |
| Whole-JSON section collections | Model approved normalized entities and row operations; do not reproduce collection-overwrite persistence |
| Paid/approval/status fields | Server-owned, permission-checked operations and exact source records; no resident self-verification |
| Role/page overrides | Approve effective-permission rules and enforce them through RLS/RPCs, not browser menus |
| Ballots and tally presentation | Separate approved secrecy/eligibility design and server counting; no source ballots or browser tally copied |
| Phone numbers, names, units, contacts, photos and documents | Treat truth, consent and authority as unknown until verified; use synthetic fixtures meanwhile |
| Dues/rates/fees/hours/capacities and eligibility defaults | Questions for the HOA, not automatic policy inherited from source values |

## Reference update procedure

Do not edit or execute the reference. To inspect a later upstream revision, obtain authorization for a fresh isolated snapshot; do not overwrite this evidence or push to its origin. Record its commit and checksums, regenerate metadata with the project-owned parser, review the sanitized output for sensitive values, format it, and update this ledger. Verify reference URLs remain denied and the application build contains no raw reference files.

## Latest backend wiring increment, 6 November 2026

007-011 now prepare protected project-owned submissions/publications, facility booking reservations, verified-lot visitor passes, histories and capacity-controlled booth/workshop/private-carpool participation. This is partial production wiring; the presence of a saved generic form or a Reviewed status is not complete source behavior. docs/FEATURE-SERVICES.md contains the authoritative current capabilities, installation order, permission prerequisites and remaining implementation gaps. No source code/data was imported, no backend was connected and no deployment occurred.
