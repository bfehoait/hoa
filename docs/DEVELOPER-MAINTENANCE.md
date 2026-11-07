# Developer maintenance

Developer-console update (5 November 2026): authenticated `/developer` now requires an explicitly assigned active `developer` role; it is separate from admin. The current console shows only real current-account verification and connection configuration state. Global operational activity/storage/delivery health remains unavailable. The older synthetic State lab and reset tools remain under explicit preview mode. Developer role previews use a dedicated router basename, per-role storage keys and a separate query client; only Exit preview returns to the root console. Never put live data into the preview repositories or call business backend APIs from the synthetic identity. The source member schema's role restrictions and RLS must be reviewed before granting additional real server capabilities.

The linked profile is read-only. Name, phone, title, unit and roles come from the user's own member lookup; the login email comes from verified Auth identity. Do not log or export those values through diagnostics. Role preview replaces contact fields with synthetic/unavailable values. Shared AccessLink/Navigation filtering controls UI visibility only; AuthGate and server enforcement remain independent.


Authentication update (5 November 2026): see `docs/START-HERE.md` for real sign-in configuration. The maintenance UI below is available only in explicit `VITE_APP_MODE=preview`. Authenticated mode now recognizes an explicitly owner-assigned developer role; source database constraints/policies still require owner review. Authentication uses the official SDK with tab-scoped session storage, a server-verified identity and user-ID-linked member lookup. Do not log Auth responses, tokens, member records or credentials. Workspace operations remain synthetic.

Tests now use isolated ports: 5191 for preview, 5192 for simulated configured Auth and 5193 for missing configuration. `npm.cmd run test:e2e` runs the preview suite. Set `$env:BELLEFORT_TEST_AUTH='configured'` then run `npm.cmd run test:e2e` for mocked Auth tests; use `missing` for the missing-settings check. These tests use an invented `.invalid` endpoint and never the real project. Clear that shell variable before running preview tests. Vercel configuration is local implementation only; deploying still requires explicit authorization.

Brand assets in `public/brand/` were copied unchanged from the folder explicitly supplied by the user on 5 November. Desktop Auth uses the white Bellefort wordmark on a brand-colored panel. Mobile Auth uses a compact top-left wordmark on the page surface, with light/dark variants; the desktop sidebar also uses light/dark variants. These are user-authorized logo assets, not imported reference application code.


The shared visual navigation layer is in `apps/web/src/components/Navigation.tsx`. Keep destination links semantic, action buttons distinct, current destinations visible, hidden sections reachable and all controls at least 48px. Services/More use their own task catalogues and reuse this layer. App section aliases are location highlighting only. Do not convert disclosure/visibility choices into permission checks. `node scripts/capture-navigation.mjs` captures the new task, category and expanded-navigation states. The Services heading is now Services; route-specific request/amenity/visitor headings are literal task names. See `docs/vault/User experience.md`.

Connected workflows are documented in `docs/vault/Connected workflows.md`. Workspace version 1 remains compatible through Zod defaults for item attachments and root messages/readMarks. Directory/feed/review views derive from workspace items; no separate production state is implied. `loadIntegrationScenario` adds one synthetic item per baseline definition, protects existing edits against duplicate loads and never changes the resident store. Message limits and synthetic attachment limits are demonstration bounds, not approved retention/upload policy. Use `node scripts/capture-connected.mjs` for synthetic integration screenshots. Reset via existing Workspace only controls; diagnostic exports must continue excluding message bodies and record content.

For palette maintenance, edit the semantic tokens in `apps/web/src/styles/tokens.css`. The user-requested current palette is burgundy/rose. After changing the owned SVG logo colors, run `node scripts/generate-icons.mjs` to regenerate the PNG install icons; keep HTML/PWA theme metadata consistent. Run `node scripts/check-palette.mjs` with the dev server running for representative contrast, layout and dialog checks. Historical pixel baselines use the earlier blue palette; `node scripts/check-desktop.mjs --layout-only` preserves those baselines and validates geometry for an intentional palette change. Do not claim pixel equality after an authorized recolor.

The `/explore` feature baseline uses the existing workspace key/query and reset controls. Structured records have `kind: baseline` and a validated `metadata.module`; batches include a synthetic batch reference. Shared definitions and validation live in `packages/shared/src/baseline.ts` and `imports.ts`. Local simulations and notes use the workspace repository; they are not privileged server operations. The source inventory remains frozen evidence rather than current completion data. See `docs/vault/Feature baseline.md` for integration limits.

Status: implemented local maintenance UI plus a future production runbook. The app remains an inspectable synthetic preview. This document does not authorize a connection, migration, commit, push, deployment or privileged production action.

## Where the tools live

Open `/developer`, or More → Preview settings → Developer maintenance. The workspace has Diagnostics, State lab, Component gallery and Maintenance runbook tabs. It is deliberately separate from resident services. `/office/settings` also links to it for preview inspection.

The route is not secret and not authenticated. There is no bypass key, hidden password, SQL console, secret inspector, production feature toggle or way to grant roles/verify payments. Before any real deployment, decide which tools ship at all and implement a separate, approved server-enforced maintenance capability for every sensitive operation. Hiding the link is insufficient.

The Source catalogue tab (`/developer/source`) is metadata-only. The user-authorized clone lives outside the runnable application in `reference/upstream-hoa/`, is gitignored/read-only and is denied by Vite. Do not remove those boundaries or execute legacy code. `scripts/inventory-reference.mjs` statically parses the authorized snapshot and outputs identifiers/field names/checksums only; never replace it with evaluation of source initializers. See the source coverage ledger for refresh and privacy rules.

## Current safe local operations

| Tool | Actual behavior | Limit |
| --- | --- | --- |
| Version and mode | Reads package version and Vite mode | Not a signed release identity, commit provenance or remote health result |
| Query/storage status | Displays the local repositories’ query states and available counts | No database, RLS or provider health check |
| Storage probe | Writes, reads and removes a uniquely named temporary session-storage entry | Does not verify persistent database storage or backups |
| Safe diagnostic download | Exports allowlisted metadata: version/mode/time, service availability, query states, counts and probe state | Excludes names, emails, phone numbers, content, raw exceptions, tokens and environment values; download preparation is not remote delivery |
| Scoped reset | Removes the selected fixture key after confirmation; subsequent reads use the original synthetic records | Browser tab only; not a production restore; theme is retained |
| State lab | Opens synthetic due/overdue/paid/unbilled/loading/error views and local workflows | Presentation testing only; cannot settle invoices or change authority |
| Component gallery | Exercises the actual owned buttons, badges, feedback and timeline | Not a substitute for accessibility and workflow testing |

Two fixture sets are separate: `bellefort-preview-v1` contains the original resident sample records/profile/bookmarks/local history; `bellefort-workspace-v1` contains extended sample work items/preferences/timelines. Query keys are `preview` and `workspace-preview`. The theme is the only general local-storage preference. Preview entry does not create an auth token. Leaving the preview clears in-memory Query state while retaining synthetic tab records for continued inspection.

If a sample fixture is damaged, use the appropriate scoped reset rather than deleting unrelated browser data. If storage is blocked/full, resolve browser permissions/capacity before retrying a save. No success confirmation should appear after a failed write. Never use browser storage as the future production authority or whole-collection database persistence model.

## Routine change workflow

Read `AGENTS.md` and the affected vault notes. Reproduce the issue using synthetic data. Keep the approved mobile and compact desktop layout contract. Update shared contracts when data shapes change and define migration/reset behavior for local fixtures; do not silently reinterpret corrupt or unsupported versions as trustworthy data.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
npm.cmd run build
```

Run relevant tests for a bounded change; do not repeat unrelated checks without a reason. Full browser checks need the Playwright Chromium and WebKit installations. For a clean setup:

```powershell
npm.cmd ci
npx.cmd playwright install chromium webkit
```

If using a workspace-local browser cache, set `PLAYWRIGHT_BROWSERS_PATH` to the workspace’s `.browsers` directory before installation; the test config detects that directory. Do not install into or delete another project’s browser/runtime files.

## Visual checks

With this project serving port 5173:

```powershell
npm.cmd run screenshots
node scripts/capture-workspaces.mjs
```

The first script captures resident/account states; the second captures extended workspaces and review detail/gallery screens. Only synthetic data may appear in screenshots. Full-page captures show fixed navigation at the original viewport edge, which may appear partway down a tall PNG.

For a desktop-only adjustment that must preserve mobile:

```powershell
node scripts/check-desktop.mjs --baseline
# Make the authorized layout change.
node scripts/check-desktop.mjs
```

This compares four local mobile image hashes and measures eight desktop viewport/theme combinations. It is a local regression aid, not a guarantee of all-device behavior. Baselines/results remain in ignored `.artifacts/desktop-refresh/`.

After a build, start `npm.cmd run preview -- --port 4173`, then run `node scripts/check-production.mjs`. Stop only the temporary server you started. Do not terminate the user’s existing dev server. Production smoke checks deep links, the manifest/icons, public-asset service-worker caching and the offline preview shell; no backend security claim follows from it.

## Dependency and runtime maintenance

Use the lockfile and review dependency changes. Run `npm.cmd audit --omit=dev` and the full `npm.cmd audit` when investigating dependency exposure. Record the date, exact scope, advisories and mitigation rather than copying a stale green badge into the UI. Existing documented dev-tool findings are not resolved merely because the app builds. Do not use unreviewed forced downgrades or broad overrides to make an audit look clean.

The developer page does not run tests/audits or poll infrastructure. Its “not connected” service labels are intentional. Backend, authentication, email, payments, storage policies, monitoring and recovery remain to be integrated and tested against an authorized environment.

## Future production maintenance requirements

Before shipping real maintenance operations, specify an approved maintenance capability separate from resident roles and ordinary office access. Require trusted identity and current server authorization; define privileged authentication, delegation, revocation and reason/reference requirements. Keep credentials in appropriate secret management, never render them in a settings screen or client bundle.

Server-owned operations need scoped authorization, validation, audit, idempotency/concurrency behavior, rate limits where relevant and clear failure handling. Permission administration must not grant more than the actor is authorized to delegate. A maintenance control must not bypass RLS by forwarding service credentials through the browser.

Define environment-specific procedures for migrations, backups, restore rehearsal, release/rollback, background jobs, failed invitation/notification delivery and monitoring. Show commit/build provenance and health only when supplied and verified by responsible systems. Record actual restore and rollback evidence; an available button or written checklist proves neither.

Separate operational failure states: rejected request, failed write, committed update with failed delivery, stale data, unavailable dependency and security refusal. Avoid logging personal records, proof attachments, tokens or full credential-bearing errors. Provide an approved incident/support escalation path with verified contacts.

Before a real release: resolve scope and permission questions, verify RLS/refusal tests, protect files/exports, validate the service-worker private-data boundary, complete resident/staff/device testing and obtain explicit release authorization. Native signing/publishing and Kate’s production cutover remain separate work.


## Account and permission maintenance

Migration 004 follows 001-003 and must be owner-reviewed/applied once; it has not been run live by the agent. Developer / Roles & committee access now supports protected member and committee changes with confirmation and approval references. Missing setup stays closed. Preserve the last-active-developer guard; use trusted owner SQL recovery when necessary. No SQL console or service keys are exposed. No private API caching was added. See START-HERE for acceptance and remaining legacy-policy gaps.
