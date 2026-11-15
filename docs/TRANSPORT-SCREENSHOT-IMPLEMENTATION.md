# Transport screenshot implementation

14 November 2026. Local frontend implementation only.

- **Shell:** compact branded Transport sidebar, workspace switch, permitted screen search with Ctrl/Cmd K, existing notification/theme controls and Transport identity. Profile now has an explicit `/driver/profile` destination under the existing role-gated driver path, while the existing `/more/profile` remains unchanged for other workspaces.
- **Dispatch:** reference-style three-card summary. Waiting count comes from the existing shuttle dashboard. Review waiting requests scrolls to the original request list, where the existing Accept handler and readiness/capacity/expiry/version checks remain. Rider totals, historical comparison, average wait and bar charts are not fabricated; the arrival limit is not presented as an average or ETA.
- **Fleet:** existing server-backed shuttle chooser cards, selected vehicle details, contact and readiness states use the new Transport styling. Driver duty controls, ready controls, manager roster, requests and journey estimates retain their original permissions and handlers. Selecting a card does not assign a shuttle. No unverified plate, driver, location or ETA was added.
- **Trips:** existing active-request and Service history views, outcomes, pagination, pickup timeline, detail cards and status actions remain. History still comes from the existing authorized service; the screen does not invent a separate daily trip aggregate.
- **Profile:** reuses the complete existing member-profile reader/editor, validation and save handler, including password/sign-out/account actions. An Office-managed assignment card reads the existing shuttle dashboard and displays only assignments matching the signed-in user. Shuttle code, capacity and service contact remain read-only; driver duty remains managed by the original Shuttle action. Editing the personal display name does not promise to overwrite the separate Office-managed driver roster name. Loading/error/retry/no-assignment states and synthetic labels remain explicit.

## Verification and rollout

Local TypeScript/production build, targeted lint/format and diff checks are recorded in the verification vault. No automated suite, E2E/axe, browser, live database or deployed Edge verification was performed for this UI pass.

Owner browser acceptance: verify Transport shell/navigation/search and Profile access in desktop/narrow and light/dark views. Check actual waiting count, fleet selection, duty/ready changes, safe request acceptance, pickup states, expiry/capacity/version rejection, history/pagination and manager-only roster. Check Profile assignment scope, personal edits/save/discard and password/sign-out actions. Confirm passenger, Board and Office shuttle presentations retain their own scope.

**Frontend deployment only; no new SQL or BFE redeployment.** No commit, push or publication.
