# Final local validation — 28 November 2026

The inspected checkout is already on `main`, starting at `268cc4d`. The working tree contains the earlier Excel/workspace-access implementation and the subsequent UI cleanup. This session did not commit, push, deploy, connect to a live database or apply SQL.

## Result

No blocker was found by the local checks below. This supports committing the reviewed changes; it is not certification of every production workflow or device. Production acceptance remains necessary, particularly payment posting, role authorization, private files and the GHL embed.

| Check | Actual result |
| --- | --- |
| `npm.cmd test` | 456 tests passed across 41 files, including isolated SQL workflow tests. |
| `npm.cmd run lint` | Passed. Generated `.artifacts` output is excluded, not application source. |
| `npm.cmd run build` | Passed TypeScript, Vite and PWA generation. Existing upstream PURE-annotation and large-chunk warnings remain. |
| `npm.cmd run check:account-integrity` | 10 tests passed; Edge editor artifact matches canonical sources. These tests are included in the 456 above. |
| `npm.cmd run typecheck` and targeted test ESLint after test updates | Passed. |
| `git -c core.safecrlf=false diff --check` | Passed. |
| Changed-file conflict/high-confidence credential scan | No merge markers or matching private-key/GitHub-token/live-key patterns found. This is a limited pattern check, not a security audit. |
| Selected Chromium browser cases | 40 distinct cases completed successfully across the initial run and the corrected session-test rerun. See the qualification below. |

Browser checks used a fresh local Vite server on port 5192, the synthetic `bellefort-auth-test.invalid` backend, mocked services and synthetic accounts. They did not use production credentials.

Coverage includes populated resident/renter/staff request details, authorized versus view-only actions, application withdrawal, Helpdesk creation/replies/status/revocation, permission editing/delegation/protected Developer references, shell notices, feature help, session restoration/sign-out/expiry/identity rejection, and six workspace rendering audits. The rendering audits produced 128 route/width captures across 64 routes at 390/1440px and 28 scoped axe scans: no reported horizontal overflow, broken images, runtime errors, mutation attempts or axe violations. Empty/unavailable mocked services are intentionally included; these captures do not prove populated behavior for every module. Renter has populated detail coverage but no separate complete route audit.

The initial browser run completed 36 cases successfully and failed four stale session expectations. Updated only `tests/e2e/auth.spec.ts` to follow the existing workspace chooser, current Home heading, localStorage session persistence and bounded identity-verification failure. The four rerun cases all completed successfully. Identity rejection still checks that no membership/access read or Office navigation is exposed; revocation and expiry still check denial. No authentication implementation or permission logic was changed to make these tests pass.

Both Playwright runs remained alive after every case had reported completion and required interruption of their own runner session. Therefore a clean Playwright process exit, a fully green historical E2E suite and cross-browser certification are **not** claimed. Logs: `.artifacts/final-browser.log` and `.artifacts/final-session-browser.log`. Full source lint/build/unit checks exited successfully. Physical Android/iOS, WebKit fixture issues, actual uploads and live backend permissions remain outside this pass.

## Rollout requirements

- This validation pass adds **no SQL** and changes **no Edge Function**. No `bfe-create-account` redeployment is required for these changes. Frontend deployment is required to publish the pending frontend work.
- The broader pending tree includes migrations **099 through 105**, in this order: `202611260099_excel_pass_workflows.sql`, `202611260100_excel_amenity_booking.sql`, `202611260101_excel_carpool_permits.sql`, `202611260102_excel_booking_payments.sql`, `202611260103_excel_helpdesk_routes.sql`, `202611260104_excel_property_clearances.sql`, `202611270105_workspace_access_editor.sql`. The owner reported applying them; this session did not independently inspect production. **Do not blindly rerun them.** Use the read-only `scripts/verify-excel-rollout.sql` inventory and investigate any mismatch.
- Official payment instructions, confidential-file delivery, intended staff permissions and optional Helpdesk reminder scheduling still need the configuration described in [Excel implementation](EXCEL-HOA-IMPLEMENTATION.md). Pushing frontend code does not apply SQL or schedule jobs.

## Developer next steps

1. Review the source and new-file list, especially migration/configuration scripts. Keep `.env.local`, credentials, private imports and generated test artifacts out of the commit.
2. When the owner authorizes committing/pushing, stage and inspect the pending work. The following are commands for that later action; they were **not** executed here:

   ```powershell
   git status --short --branch
   git add -- apps packages scripts supabase tests docs eslint.config.js .gitattributes
   git diff --cached --stat
   git diff --cached --check
   git commit -m "Improve portal workflows, permissions and usability"
   git fetch origin
   git log --oneline --left-right HEAD...origin/main
   ```

   If the remote moved, reconcile its changes and rerun affected checks before pushing; do not force-push. With a reviewed, synchronized history, use `git push origin main`. Verify Vercel's deployed commit matches the intended commit.
3. Run the focused acceptance table below after deployment on Vercel and `https://behoademo.hoa-system.com/portal`. Use approved test accounts/records; never post a fictitious payment to live books.

| Role / task | Expected result |
| --- | --- |
| Homeowner and renter: submit a request, reopen it, read Office reply | Applicable answers are visible, request title appears once, saved status/replies match, optional unused fields do not obscure the details. |
| Office: open Review inbox, change page/type, review and decide | First item opens; pagination/selection remain coherent; Helpdesk issues stay in Helpdesk; correct authorized decision and reason are available. |
| Office and resident: booking quote → authorized approval/payment verification → Account | PDF-based known fees are shown before confirmation; authorized posting updates Other/Total by the unpaid amount; retry does not duplicate payment or charge. |
| Resident / Security: visitor and small-delivery pass, ID/plate check; gate pass Office then Security | Correct approval order; unauthorized account denied; validity follows chosen dates; approval does not skip required checks. |
| Developer / delegated Office: page toggle, action checkbox, review/save/reopen | Saved effective access matches; dirty/stale drafts are protected; access cannot exceed delegation; protected Developer recovery remains read-only in the editor. |
| Same staff account after permission removal | Hidden/disabled UI and direct server requests both deny the removed action. Account preview remains read-only. |
| Office / Board / assigned teams: Helpdesk; announcement audience/image | Only permitted requests/actions appear; reply reaches resident; audience restriction holds; image loads with a stable placeholder; keyboard and footer remain usable. |
| Property-linked resident: receipt history and documents | Approved property scope exposes only permitted receipts; private files deny unrelated accounts; view/download approval remains enforced. |
| Each role on phone browser/PWA and GHL embed | No clipped controls or notice overlap; keyboard does not hide submit/reply; sheets scroll; returning Home and switching workspaces retain correct session/state. |

See [usability pass](USABILITY-PASS-20261128.md), [workspace access editor](WORKSPACE-ACCESS-EDITOR.md), and [Excel implementation](EXCEL-HOA-IMPLEMENTATION.md) for the complete feature-specific manual checks and limits.

## Additional repository/deployment check before committing

- Effective author and committer both resolve to `AaronCortez0328`, from this repository's local Git configuration. The global identity is Marichef, but it is overridden here. Global configuration was left unchanged to avoid affecting other projects. Commit identity is separate from the account/token that authenticates a push.
- Fetch and push destination are `https://github.com/bfehoait/hoa.git`; `main` tracks `origin/main`. A read-only network `git ls-remote origin refs/heads/main` confirmed remote main at `268cc4ddd649888d8b9cd4aa97269d6f4cfc41c1`, matching local HEAD at check time. No commit, fetch, push or force-push was performed.
- `vercel.json` uses Vite, `npm run build`, output `dist` and the SPA rewrite. The lockfile is tracked. A relative-import path casing check across 339 source files found no mismatches that would break a Linux build. No Marichef/Spandis references were found in the inspected application/shared/scripts/backend/deployment-config paths.
- There is no local `.vercel/project.json` binding. GitHub CLI is not authenticated in this environment. Vercel's dashboard repository/team/production-branch/environment settings and the authenticated push account therefore remain **unverified**. Before pushing, confirm project **bfehoa** is connected to **bfehoait/hoa**, production branch **main**, repository root as Root Directory, and the owner-approved `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` environment values. Do not run `vercel link` to another project or change the global Git identity as a substitute for checking the dashboard.
- The additional full `npm.cmd run format:check` initially flagged 179 files solely for CRLF/LF differences. Normalized local text to LF and added `* text=auto eol=lf` to `.gitattributes`, retaining explicit binary document/image handling. The account-editor generator also compared raw line endings, so its canonical read now normalizes CRLF to LF. Regenerated the paste artifact; its Git content is unchanged. Isolated LF and CRLF copies both pass the generator check. Account-integrity tests passed again (10/10), generator ESLint and final format check passed, and diff-check passed. This is tooling portability, with no account-creation handler/schema/permission change and **no BFE redeployment or SQL required**.
- The GitHub workflow additionally runs the default preview E2E suite. That entire historical Chromium/WebKit suite was not run by this selected authenticated-browser pass. Do not interpret this report as a guaranteed green GitHub CI result or guaranteed Vercel deployment; the live deployment/check results must still be observed.
