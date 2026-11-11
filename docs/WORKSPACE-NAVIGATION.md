# Simplified workspace navigation

Owner direction, 10 November 2026: Developer is a maintenance console, not another Office dashboard. Remove the repeated System modules menu and operational shortcuts without losing existing tools.

## New navigation

Only the current workspace's menu appears. A workspace selector shows the workspaces already available to the signed-in account; entries remain filtered by existing access checks. It navigates to another workspace and never assigns a role or grants a capability. Desktop selector is in the sidebar, mobile staff selector in the header. More also retains authorized workspace links as a fallback.

Developer menu: Overview, Account support, Connections, Access configuration, Diagnostics & audit. Lot register and Shuttle removed from this menu. The developer role no longer overrides Office/Board/Security/Driver navigation merely because it is assigned to the account.

Developer overview now focuses on maintenance tools at both mobile and desktop widths. No operational request visual, announcement creation button, lot link or shuttle dispatch action is presented there. Account creation and account-specific access controls were removed from the diagnostic People screen; Office People & accounts and Office Roles & permissions retain their existing controls.

## Feature destinations retained

| Former monitoring subject | Operational home |
| --- | --- |
| People, registrations, household/account review | Office → People & accounts; registration inbox; Lot register for property relationships |
| Property | Office → Lot register; current property-change screen still marked unavailable where backend is incomplete |
| Requests, complaints, concerns, support | Office → Helpdesk; existing resident request forms |
| Request messages | Office Helpdesk threads / existing Office inbox route |
| Finance | Office → Finance, collections, expense/reconciliation/report pages |
| Amenities and events | Office → amenity calendar/bookings; community event proposals |
| Visitor/gate passes, vehicles | Office → visitor passes and vehicle requests; Security workspace for gate work |
| Incidents and guard work | Security workspace; existing source/availability limitations preserved |
| Announcements | Office → Community / announcements |
| Hotlines | Office overview → Emergency contacts; owner-confirmed directory is currently bundled data, not a new editable contact backend |
| Livelihood, jobs, training, booth applications | Office → Operations/content review; existing directory and feature catalogue |
| Shuttle | Driver → Shuttle; Board → Shuttle review, with existing authorized fleet/dispatch controls |
| Documents/governance | Office document review and Board → Documents |
| Elections | Office election setup proposals; Board → Elections, subject to existing readiness limits |
| Account roles | Office → Roles & permissions; developer system configuration remains separate |
| Audit and legacy source history | Developer → Diagnostics & audit → existing audit inspection |

The Office overview has clearer links for visitor/gate passes, emergency contacts, election setup, livelihood review and workshops. Existing routes and backend checks remain.

## Why record diagnostics remain

The repeated **System modules** sidebar and overview catalogue are removed. Existing `/developer/modules/...` URLs remain reachable under a collapsed **Advanced record diagnostics** section. Some entries are legacy source inspection rather than an implemented management workflow. Deleting these views or pretending they were migrated into staff write screens would lose information or misrepresent readiness. They are secondary troubleshooting tools, not a duplicate operational menu. No legacy source or backend was executed or copied for this navigation change.

## Verification

TypeScript, production build and scoped whitespace checks passed during implementation. Existing large-chunk and zod annotation warnings remain. No automated test suites, new browser walkthrough, live role/permission query, database mutation or deployment performed. Final follow-up TypeScript check includes mobile breadcrumb clearance and removal of diagnostic account creation. The owner should verify multi-role switching on desktop/mobile, selected menu state, Office account tools, Board shuttle review, Driver controls, permissions refusal, and old diagnostic links. No new grants were added.

## 10 November 2026: Office QA follow-up

Verified Claude's assessment before changing UI. Overview now emphasizes queues; secondary tools are collapsed and deduplicated. Simplified People/Finance navigation, corrected Helpdesk breadcrumbs and Office access labels, reduced the calendar empty state and compacted staff receipt rows. Confirmed existing receipt pagination and full-row inbox links rather than replacing them. Customer layout and server approval/permission logic unchanged. Typecheck/build and 12 synthetic staff render checks plus two dark renders passed. See docs/OFFICE-QA-FOLLOWUP.md for dispositions and live-verification limits. No SQL required for this pass.
