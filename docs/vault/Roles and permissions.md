# Roles and permissions

**Implemented locally, 5 November 2026** - Authenticated mode now verifies Supabase identity and looks up exactly one member by `user_id`; role claims in editable user metadata or email matching are not trusted. Active known main/extra roles determine frontend workspace choices. Unsupported/missing/duplicate/inactive memberships and policy errors deny entry. Developer capability, staff mapping, individual overrides, view-only semantics and operation-level authority remain unapproved/unimplemented. Existing source database RLS has not been verified. Explicit preview mode retains unrestricted synthetic inspection.


**Observed** — The supplied brief identifies admin/staff, homeowner, renter, board, security and driver; main plus extra roles, individual page overrides, and view-only behavior are requirements.

**Observed** — Explicit preview mode exposes resident and office screens for inspection without authentication. It grants no real authority. The Roles & access screen describes roles; it cannot change them.

**Unknown** — Super-admin definition, precedence of denies and grants, separation of duties, delegated access, household membership changes, export permissions and staff approval boundaries.

**Risk** — Browser navigation is never a security boundary. RLS, protected RPCs and refusal tests must enforce all actual policies before real data is introduced. See [[Security]].

**Planned** — [[Permission planning matrix]] proposes operation-level scopes and identifies unknown role powers for approval. It covers household, assigned-work, association, export, file, financial and protected-administration boundaries. Proposed role cells are not production grants. Review the combination/deny/view-only policy and its refusal cases before implementation; use [[Release acceptance]] to define evidence.


## Developer assignment and role views - 5 November 2026

The user approved a separate developer workspace and all-role synthetic previews for the two-person development team. `developer` is recognized as a distinct member role; existing `admin` membership and IT/job titles do not imply it. Owner assignment is a separate SQL action, supplied only in conversation. No source email allowlist, self-grant control, service key or database alteration was introduced.

Developer alone can open developer/profile/help/notification/workspace screens, but not office, board, driver, security or household operations as a real role. Additional approved member roles retain their own real workspace rights. The preview prefix is available only through the outer active-developer gate in authenticated mode. It supplies a synthetic inner identity with no extra roles; route checks and role-aware links use that selected role. Account changes are blocked; real identity/member refresh remains owned by the outer provider. Preview mode remains a synthetic inspection configuration rather than authentication.

Department capabilities, view-only/individual overrides, tenant financial responsibilities, protected operational monitoring APIs and database enforcement remain separate unapproved work. Current previews describe these limitations rather than inventing policy.
