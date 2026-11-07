# Feature inventory

Current integration scope is in [[Connected workflows]] and `/coverage`: 31 structured modules, shared local review/publication, directories, conversations, registry/dispatch/gate views and sample print/PDF output. Existing workspaces below remain available. Production authority and some detailed source behaviors remain unimplemented and are documented explicitly.

The later [[Feature baseline]] adds 30 structured source-informed workflow modules plus validated synthetic CSV staging and an assessment calculator. It includes business/job/garage/booth forms, linked interests, dispatch simulation, local conversations and administrative proposals. The table below describes the original workspace flows; use the baseline note for expanded scope and remaining integration limits.

**Observed** — Status below describes checked-in frontend scope, not production capability.

| Area | Local preview | Production dependency |
| --- | --- | --- |
| Accounts / registration | Preview entry/exit, explicit unavailable recovery, validated synthetic applications and office review; no real identities | Auth, invitation delivery, transactional registration approval |
| Access control | Role workspaces, proposed capability matrix and review notes; no real grant mutation | Approved permission model and database enforcement |
| Audit | Confirmed local activity plus work-item timelines | Protected server-owned audit |
| Announcements | Search/details/bookmarks, local draft → preview publication → resident feed | Publishing policies, approved content and delivery |
| Property / units | Sample ledger-unit search and verification dossier | Verified property registry, memberships and transfers |
| Operations | Create, inspect, assign to synthetic staff, locally review/resolve and record history | Server row operations, actual assignment policy and notification delivery |
| Amenity bookings | Local requests/details/cancellation and navigable read-only sample calendar | Actual availability, fees, conflicts, approvals |
| Security | Local visitors, sample vehicle/permit/incident queues and security workspace; no gate authority | Gate operations, verified vehicles/stickers, incident handling and security roles |
| Finance | Balance/statements, immutable sample receipts, collections/aging, local expense review and unavailable-bank reconciliation stages | Approved ledger, gateway, server-owned receipts, expenses and reconciliation |
| Marketplace | Sample listings, local listing drafts, explicit missing contacts/prices | Verified providers, consent, moderation and any transaction scope |
| Training | Visual workshop and local interest records/timelines | Approved sessions, capacity and actual enrollment |
| Transport | Route diagram, local interests and driver workspace; no bookable trip | Verified drivers/routes, dispatch and operating rules |
| Elections | Readiness checklist and participation timeline; voting locked, no tally | Approved election/secrecy design and server processing |
| Board documents | Local metadata/publication inspection, version/access requirements and explicit missing official files | Approved files, real versions and protected access |
| Exports | Labelled sample CSV and metadata-only diagnostic JSON | Authorized server-side export scope and audit |
| Profile | Validated sample name/mobile edit and reset | Verified identity and contact change process |

See [[Verification]] for what ran and [[Roadmap]] for what remains.

Cross-cutting additions: local activity/preferences without real push/email delivery, separate board/office/security/driver previews, and [[Developer maintenance]]. These additions do not turn local role screens or fixture history into production authorization/audit.
