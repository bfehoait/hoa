> **Historical task scope:** The presentation-only limits below describe Claude's earlier design pass. They are not a permanent restriction. Under the owner's 16 November 2026 authorization, Claude/co-developers may implement and validate requested behavior/wiring fixes locally; see [Co-developer guide](CO-DEVELOPER-GUIDE.md) and current [AGENTS.md](../AGENTS.md). No Codex approval is required for ordinary local work.

# Console redesign — handoff to Codex

**From:** Claude (presentation pass on the staff/admin console).
**Design target:** `docs/ARTIFACT-CONSOLE-DESIGN.md` (self-contained spec — rebuild
the artifact from it; no external link needed).
**Branch at time of work:** `verification-ui-polish-workflows`.

---

## A. What Claude changed (review these)

All **presentation/copy only.** No query/RPC/submit handler/schema/validation/route/
permission/notification touched. No SQL/auth/migration. Verified locally:
`npm run typecheck` ✅ · `npm run build` ✅ · `git diff --check` clean (only pre-existing
LF/CRLF warnings).

1. **`apps/web/src/styles/global.css`** — appended a block scoped to
   `[data-staff-ui="true"]` (admin console only; resident screens untouched):
   - `--shadow-sm` set to the artifact's soft elevation (light) / softened in dark.
   - `.panel` → 16px radius + soft shadow.
   - `.table-wrap` → carded (surface, border, 16px radius, shadow, overflow hidden),
     washed `th`, cells 14×16 (first/last 18), no trailing row divider.
   - **Effect:** every admin card/table gets the artifact's elevated look at once.

2. **`apps/web/src/features/office/StaffHome.tsx` + `StaffHome.module.css`** — the
   office home. Replaced the collapsed `<details> "More Office tools"` with an
   always-visible **card gallery** (`.toolsSection` + `.toolsTitle`); each area card
   now shows an icon chip + title + description. Same permission-filtered `areas`/
   `tools` data; nothing removed.

3. **`apps/web/src/features/office/OfficeWorkload.module.css`** — the home "Needs
   attention" trio (Awaiting review / In review / Follow-up) restyled into KPI cards:
   white surface, colored **top accent strip** + colored **icon chip** per card
   (burgundy / amber / green via `:nth-child`). CSS only.

4. **`apps/web/src/features/office/People.tsx`** — member/application status `Badge`
   tone now by meaning: Active/Approved=green, Invited/Pending=amber,
   Suspended/Rejected=red (was green-or-neutral). One JSX expression; no data change.

5. **`apps/web/src/features/developer/AccessManager.tsx`** — the confirm dialog is now
   action-specific: added `deactivating`/`revoking`/`confirmTitle` derived from
   existing state; title + lead sentence + confirm button label/tone vary (red
   **Deactivate account** / **Revoke assignment**). `confirm()` server call unchanged.

**Docs added (no code):**
- `docs/ARTIFACT-CONSOLE-DESIGN.md` — the full self-contained design spec.
- `docs/ARTIFACT-CONSOLE-HANDOFF.md` — this file.

Review command: `git diff -- apps/web/src/styles/global.css apps/web/src/features/office/StaffHome.tsx apps/web/src/features/office/StaffHome.module.css apps/web/src/features/office/OfficeWorkload.module.css apps/web/src/features/office/People.tsx apps/web/src/features/developer/AccessManager.tsx`

---

## B. Instructions for Codex

1. **Review A** — confirm the 6 edits are presentation-only and keep them (or adjust to
   taste). They already build + typecheck.
2. **Continue the spec** in `ARTIFACT-CONSOLE-DESIGN.md`, screen by screen, using the
   existing components (`PageIntro`, `MetricStrip`, `LinkedCard`, `Badge`, `Modal`,
   `Queue`, `TabAccess`, `AccessManager`, `Empty`/`Feedback`/`Skeleton`). Suggested
   order: Finance/collections → Operations → Facilities & calendar → Community/
   announcements → Helpdesk → Lot register → Review inbox detail → Board/Security/
   Transport screens. The shared styles in §A.1 already lift all of these.
3. **Honor the flags** (`ARTIFACT-CONSOLE-DESIGN.md` §11):
   - Keep the real **3-level** `TabAccess` (No access / Read only / Read & edit +
     limited-edit + inherit-defaults + server save). Do **not** downgrade to the
     artifact's 2-toggle — restyle only.
   - Overview KPIs/counts must be **live** (existing review-inbox RPCs), real empty/
     unavailable states, no placeholder numbers.
   - Preserve **permission gating** of workspaces/modules and all **synthetic-data**
     labels.
4. **Account workflow:** if you touch any account-creation surface
   (`CreateAccount.tsx`, `bfe-create-account`, `member-management.ts`), run
   `npm run check:account-integrity`, regenerate the Edge editor artifact if its
   sources changed, preserve the `created`/`member_linked` confirmation, and state
   whether SQL / BFE redeploy / frontend deploy is required.
5. **Overlap note:** `CreateAccount.tsx`, `MemberWorkspace.tsx`,
   `member-management.ts`, `supabase/functions/bfe-create-account/index.ts` and several
   migrations were **modified (uncommitted)** during this work — reconcile with your
   own in-flight changes before committing. `docs/vault/Verification.md` was also
   modified — update/merge it rather than overwrite.
6. **Per change:** `npm run typecheck` + `npm run build` green, `git diff --check`
   clean, light+dark + desktop/tablet/mobile, keyboard focus + reduced motion,
   presentation/copy only. Owner performs browser verification — distinguish local
   checks from browser/prod in your report.

## C. Not done / for Codex to decide
- Per-screen tailoring beyond the shared-style lift (the order in B.2).
- Optional ASCII layout sketches per view (ask the owner if wanted).
- Any behavior change the artifact implies must be raised separately, not implemented
  silently.

### 14 November 2026 - Codex console implementation

The owner authorized the console-wide implementation after assessment. See docs/CONSOLE-REDESIGN-IMPLEMENTATION.md for scope, adaptations, actual verification and owner acceptance. Shared staff shell/surfaces and per-module CSS now cover the existing console, with actual authorized review action cards and receipt-based collection summaries. Unsupported mock KPIs were not invented. Existing independent review desks and full forms remain; resident presentation stays scoped separately. No new backend deployment is required for this UI pass.
