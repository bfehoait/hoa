# Permission planning matrix

## Workbook implementation slice - 5 November 2026

The supplied access workbook is evidence for 12 committees and module-level V/D/R/M/none labels. Its nonpersonal Committee Matrix contains 204 cells; no roster, contact data, credential columns or attendance values are stored in source. The user explicitly chose individual approved actions before enabling writes. Unreadable cells, Super admin and All Access remain ungranted. Committee labels are not action permissions.

Migration 003 adds exact module/action/scope grants attached to owner-provisioned committee assignments, effective dates, expiry and revocation. Active exact-scope denies override allows across committees. No hierarchy of scopes or implied action expansion exists. Provisioning is owner-only and audited on the server. Developer technical monitoring derives from the separately assigned developer role. BOD summaries still require specific approval and do not expose private rows or ballots.

The app consumes `bfe_my_access()` for authenticated office navigation and action visibility. Protected request RLS/functions use `bfe_can()` for owner/office read and office reply/status. Existing private legacy endpoints and their policies are not upgraded by this foundation. See [[Security]] and the installation sequence in docs/START-HERE.md. The older proposal below is historical context and must not be used as an automatic grant seed.

Current implementation note - 5 November 2026: real Auth and own-member verification now drive recognized primary/extra-role workspace gates. Developer capability is separate from admin; its role previews are synthetic and isolated. Authenticated staff directory/registration reads are implemented, while the capability matrix below remains a proposal. Owner-supplied existing policies do not show household-level predicates on member/shared-data reads; see [[Security]]. This does not constitute verified backend permission enforcement. Earlier preview-only observations below are historical.

Status: **Planned proposal — not approved HOA policy and not implemented enforcement.**

**Observed** — Six role families, extra roles, per-page overrides and view-only behavior are requirements. The current preview has open resident/office routes, not authentication. The user requested a plan, not activation of these permissions.

Use [[Master implementation plan]], [[Roles and permissions]], [[Product questions]] and [[Release acceptance]] together. This is a discussion matrix: it identifies the boundaries to approve rather than inventing who the HOA has authorized.

## Proposed capability scopes

| Scope | Meaning to specify and enforce |
| --- | --- |
| Self | The authenticated identity’s allowed profile/security operations |
| Household / property | Records linked through an active, verified membership and approved financial responsibility |
| Assigned work | Requests, incidents, trips or reviews specifically assigned to a permitted worker |
| Association | Explicitly authorized association-wide functions; not an automatic consequence of employment |
| Protected administration | Sensitive grants, configuration, finance verification/reversal or election operations with separately approved authority |

Roles should map to operation-level capabilities, not only page names. A user might read a ledger without exporting it, review an application without granting roles, or handle a concern without seeing confidential internal material. Aggregate and file access must follow the same boundaries as source records.

## Role discussion matrix

All cells below are **proposed for approval** or identify an **Unknown**. They must not be used as production grants until approved.

| Operation / data | Homeowner | Renter | Admin / staff | Board | Security | Driver |
| --- | --- | --- | --- | --- | --- | --- |
| Own profile/session | Proposed self scope | Proposed self scope | Proposed self scope | Proposed self scope | Proposed self scope | Proposed self scope |
| Household statement | Proposed own liable property; confirm responsibility | Unknown: owner/tenant financial visibility | Explicit finance/read grant only | Unknown oversight scope | No unrelated financial need proposed | No unrelated financial need proposed |
| Submit household concern/booking/visitor request | Proposed active membership scope | Proposed active membership scope; rights need confirmation | Only approved office/on-behalf capability | Resident rights only if separately a member | Only approved work capability | Only approved work capability |
| Read another household’s private rows | No general access proposed | No general access proposed | Explicit scoped office purpose only | Unknown; not automatic | Minimum approved gate/incident fields only | Minimum assigned-trip fields only |
| Review registration / change membership | Not a resident capability | Not a resident capability | Explicit reviewer/registry grant; unknown approver rules | Unknown | No general capability proposed | No general capability proposed |
| Issue bills / verify receipts / reverse records | Never self-service | Never self-service | Separate approved finance capabilities | Unknown read/approval powers | No general capability proposed | No general capability proposed |
| Assign/resolve office requests | Resident may respond, not grant office completion | Same boundary | Approved scope/assignment and state transitions | Unknown involvement/confidentiality | Approved assigned security work only | Approved assigned transport work only |
| Validate gate pass / record entry-exit | No self-authorization | No self-authorization | Only approved security/override duty | Not automatic | Proposed scoped gate capability | Not automatic |
| Publish announcements / protected documents | Unknown submission rights; no automatic publishing | Same boundary | Approved publisher capability | Unknown approval/publishing rights | Only explicitly approved notices | No general capability proposed |
| Export data / inspect audit | Own approved statement only proposed | Unknown own financial exports | Separate scoped export/audit grant | Unknown oversight grant | Only explicitly approved operational exports | No general capability proposed |
| Change roles / access overrides | Never self-escalation | Never self-escalation | Separately approved access administrator only | Not automatic | No general capability proposed | No general capability proposed |
| Vote / administer elections / view tally | Eligibility determined separately by approved rules | Unknown eligibility | No authority from staff label alone | No authority from board label alone | No authority from security label alone | No authority from driver label alone |

“No general capability proposed” is a least-privilege design proposal, not a claim about actual HOA policy. A second role does not prove household ownership or election eligibility. Super-admin remains undefined and must not become a shortcut around all safeguards.

## Decisions needed before implementation

Define how main/extra roles combine, whether explicit denies override grants, how individual overrides are scoped, how long they last, what view-only blocks and who may delegate/revoke them. Avoid a loosely additive implementation that accidentally defeats a restriction.

Define who grants protected capabilities and the approval/reference required. Decide whether the same person may record and verify a receipt or approve/reverse their own work. Specify temporary staff cover and emergency override behavior if the HOA requires them; every such exception needs explicit authority and evidence.

Define effective dates for tenancy/ownership and visibility of historical rows after a transfer. Decide whether a user with multiple properties selects a context and how the server checks each property independently. Decide what users see when a role or membership is revoked mid-session.

## Enforcement and evidence

The UI shows permitted actions for clarity, but every real read/write/export/file operation is independently authorized. Use trusted identity plus approved membership/grants; never rely on client-submitted role strings, page visibility or an editable profile field.

RLS must protect tables and storage access as applicable. Sensitive multi-row operations use protected transactional server functions with narrowly approved capabilities. Aggregate endpoints must not leak private rows through totals. Service-level credentials never enter the browser.

Refusal tests must exercise anonymous, resident A, resident B, renter, each permitted staff capability, view-only, extra-role, revoked and expired-membership identities. Include direct API/RPC/file requests, not just hidden buttons. Keep test policy expectations tied to the approved matrix version. No permission model is verified by this document.


## Accounts and QA follow-up

The user requested developer operational control. Migration 004 implements verified developer override for supported capabilities, member role/status operations and explicit committee grant/revoke operations. Admin alone remains subject to explicit grants. Denies override matching nondeveloper grants. Committee grants cannot assign the developer role. Six previews remain synthetic, with no real-account impersonation. Full capability flags do not implement missing business operations.


## Direct navigation and financial reporting

Common /more navigation is available to every active supported membership; destination links still filter by roles/capabilities, and the underlying household/office route guards remain. Automatic landing is a navigation preference only. Developer retains the existing explicit developer requirement. Financial report view requires finance/view/association; the synthetic CSV UI checks finance/export/association separately. This is not a protected real financial exporter or a change to database grants.


## Registry and receipts: implemented local boundary

005 uses property/view/association for registry evidence, property/manage/association for independently reviewing links and correcting recorded names, finance/view/association for association receipts, finance/approve/association for explicit historical entitlements, finance/export/association for CSV and audit/view/association for lot history. Active approved links permit limited own-lot details; owner receipt access additionally requires finance/view/own and a current explicit entitlement. Developer controls use existing server checks. Names, Gov Role and BOD/Officer source labels never provision access. The UI needs both viewing and mutation permissions; the existing broad legacy policies are not altered by 005.

## 6 November 2026 - shuttle authority

Active residents may create immediate shuttle requests and cancel only their own active requests. Only a separately active driver role bound to an enabled approved roster can progress a request, and acceptance additionally requires on-duty/recent presence and sufficient approved capacity. Developer status alone never grants trip progression. Developers configure the approved roster with an approval reference. Explicit transport/view/association grants private service history to approved reviewers; board role or a summary grant alone does not. Drivers receive today's waiting queue and retain their own unresolved assignments/history. Residents receive only their own details plus aggregate waiting count/approved fleet. Raw table grants are revoked. No personal assignments/grants were seeded. Buyani is a user-initiated external handoff and changes no finance status.

## Protected workflow boundary update, 6 November 2026

007-011 are prepared for owner installation only. No automatic role/committee grants or official policy seeds. Facility and visitor decisions require explicit scoped capabilities; actual security role is additionally required for gate events. Resident visitor passes require approved, active, unexpired registry membership. Guard shift enforcement, materials passes, walk-in confirmation and physical access devices remain unimplemented. Published metadata is curated text only; no private submitted fields or account IDs are returned publicly. No ballots or accounting authority is enabled by generic Reviewed status.

## Member inspection authority, 6 November 2026

Developer View member is a dedicated read-only support projection, not live impersonation or full portal equivalence. Private session/audit tables have RLS and no direct browser grants. 012 grants execution only on guarded start/read/end RPCs; target own records are explicitly filtered by target ID and bfe_can_for. No auth.uid mutation, forged JWT, member password/magic-link or service-role browser credential is used. Supported sections exclude other households, private messages/files/financial entitlements and shared staff queues. Inactive or ambiguous targets yield no own-service access; reads are refused after developer revocation or session expiry. Runtime permission checks remain server-owned.

## Account-interface preview delegation, 6 November 2026

013 supersedes the inspection-only interface: an audited, owner-bound, ten-minute developer support session delegates only explicit STABLE read RPCs under the target's database member context. The gateway verifies current developer/target access and session ownership on every call, rejects unknown/mutating functions and arguments, rejects changed volatility or ambiguous overloads, restores request.jwt.claim.sub on both successful and failed reads, and logs the real developer actor. No Auth token is issued or changed. The actual target role/capability guards control the reused portal UI; developer privilege does not leak into a limited admin's module permissions. Direct PostgREST table and non-read APIs are unavailable through the preview client. Query caches and synthetic storage are isolated. Normal application permissions and installed migration 012 stay unchanged.


## Configurable access, prepared locally 6 November 2026

Migration 014 layers user/role/committee tab rules over existing baseline grants. Individual rules override group rules; hidden wins among groups, otherwise edit wins over view; explicit action denials remain authoritative. View-only blocks protected writes, including legacy owner operations covered by table guards. Approval/publication/management are separate grants. No automatic staff powers or managers are seeded. Developers can designate active admins; delegated managers cannot alter protected developer accounts, self-elevate, appoint managers or grant beyond their own authority. Own/approved/assigned/association scopes are distinct. Existing workflows still apply membership and ownership checks. Unrelated legacy policies are not certified hardened.

015 adds private listing assets, owner-only unreviewed upload/link editing, staff review, version invalidation on media changes, and re-review on edits. Target media reads in account preview go through the audited gateway; a returned cover path is signed for 60 seconds with the unchanged developer session. Removed objects become inaccessible but require authorized orphan cleanup; no retention rule is invented.
