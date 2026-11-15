# Security screenshot implementation

14 November 2026. Local frontend changes only.

## Screens

- **Shell:** compact branded staff sidebar, Security screen search and workspace identity. Overview and Visitors are separate entries: `/security` is the overview; `/security/visitors` retains the existing pass desk. Gate desk keeps its existing route and reader. Existing role/path permission checks still gate destinations and the server gates data/actions.
- **Overview:** three gate summary cards and a Watch list follow the reference composition. Verified occupancy, daily movement totals and entry-type aggregates are unavailable from the current pass service, so no numbers or charts are invented. Watch list uses the existing community pass dashboard's first permitted page and the account's own incident submissions. These scopes are explicit; approved passes are not proof of arrival and own submissions are not estate-wide alerts. Loading/error/retry/empty states are retained.
- **Visitors:** desktop pass table with visitor, pass kind, host lot, validity, effective status and Open action. Search/status chips filter the loaded page only and are labelled accordingly. Narrow cards retain the same filtering. All original pagination, pass details, history, server capability gates, versioned status actions and decision reasons remain. Labels use real Approved/Entered/Exited states rather than treating an approval as a confirmed expected arrival.
- **Vehicles:** the existing authorized vehicle reader uses the compact desktop record table and original full-record/action dialog. Available fields and statuses remain the source of truth: no sticker validity/expiry or registration capability is fabricated from the mock.
- **Incidents:** existing own-submission reader has a desktop event-feed presentation. Open exposes the original full record/history/actions. Incident creation keeps its original form and handler; no estate-wide incident scope is granted by the redesign. Narrow views retain original cards.
- **Gate desk:** existing pass reader and authorized entry/exit actions remain. Pass state/validity is not a chronological gate movement log; the page explicitly states that a complete event feed is not connected. No mock turn-away, resident sticker check or physical barrier integration was added.

## Acceptance and rollout

Owner should verify all five screens as a real Security account in light/dark themes and narrow/desktop layouts. Check workspace/search/navigation, pass page filtering and pagination, pass details/history and permitted entry/exit transitions (including expired and stale-version refusal), vehicle reading without unintended approval authority, incident creation/history/detail, loading/empty/error states and denied destinations. Confirm watch-list scope and unavailable metrics remain honest. Synthetic previews remain labelled and retain their existing separate implementations except the new unavailable-state Overview, which does not fetch live records in preview mode.

No browser, live database, deployed Edge, full automated suites, E2E or axe verification was performed. Local TypeScript/build and targeted lint/format/diff checks are recorded in the verification vault. **Frontend deployment only; no new SQL or BFE redeployment.** Nothing committed, pushed or published.
