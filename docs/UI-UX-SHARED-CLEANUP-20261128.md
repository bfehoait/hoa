# Shared UI cleanup ? 28 November 2026

## What changed

This pass extends the existing cross-system cleanup through shared components, rather than replacing every screen with a new layout.

- Developer Overview now has a grouped pair of icon-led preview rows. Account preview explains read-only member access; Role previews explains synthetic role layouts. Both reuse the existing routes and permission-aware links.
- Shared status badges infer a consistent color for known status text when callers do not supply a tone. Explicit tones still take precedence. A small decorative dot accompanies known colored states; the text remains visible. Role names and unknown labels remain neutral. No stored status or permission changed.
- Staff navigation rows now keep their compact row height, flat separators and single outer border instead of inheriting oversized card styles.
- Shared empty states use less vertical space while retaining the icon, explanation and existing action. Shared error feedback has a warning icon rather than the success check. Developer errors retain technical details; other workspaces use the existing plain-language error formatter. Pending/error/empty distinctions remain intact.
- Office workload labels distinguish pending approvals from requests needing follow-up. Counts and existing queue links are unchanged.
- Helpdesk, People, profile and pass search use clearer address wording. An address on file or entered in a request still does not establish ownership. Helpdesk assignment and resolution labels are clearer; stored values, validation and save handlers are unchanged.
- Home request and booking activity links include the selected record ID. The destination reuses its existing authorized exact-record reader, independent of list pagination. Merely opening these links does not save or approve anything.
- ESLint excludes ignored generated `.artifacts` output. Previously `npm run lint` scanned old minified bundles and local scratch scripts, producing unrelated generated-file errors. Application source lint rules are unchanged.

Existing working-tree changes from other sessions were preserved. This pass does not change SQL, RPC contracts, account creation, prices, balances, permissions or approval rules. Shared changes affect the screens using these components, including Homeowner, Office, Board, Security, Transport and Developer; it is not a claim that every populated workflow is verified.

## Verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: 454 tests passed across 40 files (local shared/PGlite checks).
- `npm.cmd run lint`: passed after the generated-artifact exclusion. The initial full lint failed on ignored generated bundles/scratch files, not application source; these results are not hidden.
- `npm.cmd run build`: passed; existing dependency annotation/chunk-size warnings remain.
- `git -c core.safecrlf=false diff --check`: passed.
- Chromium: six workspace UI-audit cases completed successfully (64 routes at 390px and 1440px, light/dark overview checks and selected forms). All six report files have zero runtime errors, recorded writes and automated axe violations. Empty/unavailable panels use isolated service responses, not real production data.
- Chromium: two new regression cases completed successfully: Developer preview destinations and Home activity opening the selected request/booking without a write.
- After those checks, the shared staff-row CSS conflict was corrected; the Developer audit and both new regressions are rerun with row height/shadow assertions. All three rerun cases completed successfully, including 48?100px preview row heights at both widths and no nested row shadows. The repeated build and targeted lint passed.

The Windows Playwright runner remained active after reporting all eight cases successful; it was stopped after completion. This is completed-case evidence, not a clean full-suite process exit. Browser checks use a local Vite server, synthetic identity and mocked services; no live database or authenticated production session is used.

Not certified: the complete legacy E2E suite, all populated forms, real role defaults/authorization, real iOS/Android keyboard behavior or production/GHL embed behavior. Earlier WebKit synthetic session CORS failures remain an unresolved test-environment issue (see `UI-CLEANUP-20261127.md`); they have not been relabelled as passing.

## Rollout and acceptance

No new SQL migration. No BFE / `bfe-create-account` redeployment. Frontend deployment is required to show these changes on the live app, but no commit, push or deployment was performed.

After reviewing the working tree, run:

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git -c core.safecrlf=false diff --check
$env:BELLEFORT_TEST_AUTH='configured'
$env:CI='1'
npx.cmd playwright test --project=chromium --grep 'system UI audit|shared UI cleanup' --fully-parallel --workers=4
```

Owner/co-developer acceptance checklist:

1. Developer ? Overview: preview cards fit on phone/desktop; Account preview opens member selection and Role previews opens synthetic layouts. Check read-only/synthetic labels before using a preview.
2. Homeowner ? Home: open a specific request or booking from its activity card. The matching record should open, not merely the first list item. Check Back and Escape on desktop and phone.
3. Office ? Overview, Review inbox, People, Helpdesk, Announcements and Finance: read status labels in light/dark, check button alignment and long names. Confirm errors describe the next step and preserve unsaved input.
4. Board, Security and Transport: check their menus and shared badges/empty states at desktop and phone widths. Unavailable metrics must remain unavailable; missing data must not become a fabricated zero.
5. On real Android Chrome and iOS Safari, including the GHL `/portal` embed, check keyboard, sheet footer, bottom navigation, focus and browser Back. Mocked desktop Chromium checks cannot certify these environments.
6. Use separately authorized live test accounts for approvals, confirmed fees and account linking. Verify existing server permissions and balances through their actual workflows; this UI pass does not certify live financial or authorization behavior.
