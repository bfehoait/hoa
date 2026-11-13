# Customer wiring review - 13 November 2026

This is a static source review, not a production certification. No live database connection, browser run, automated test suite, end-to-end run or accessibility sweep was performed.

## Scope and findings

The source inventory matched 87 literal frontend BFE RPC names to prepared migration definitions. Service destinations (14), resident Home destinations (7), More destinations (9), and account navigation references (32) had matching application routes. These counts do not establish that the migrations are installed, the Edge function is deployed, permissions are configured, or external services are available.

| Customer flow | Source wiring reviewed | Owner verification still needed |
| --- | --- | --- |
| Sign-in and session restoration | Auth storage, verified identity, session policy, expiry and cache clearing | Reload, return visits, expiry, offline recovery and cross-tab sign-out |
| Registration and Office review | Shared validation, registration submission and Office registration queue | Submit a synthetic application, locate it, review and create the account |
| Home and announcements | Real balance reads, shortcuts, publication/media readers, return cache | Authorized images, carousel controls, return navigation and updated content |
| Account and properties | Linked properties, posted balances, receipts/date filters, Buyani link | Multiple/no properties, posted bills, recorded payments and external payment destination |
| Livelihood | Browse/detail, submission/review, participation, publication audiences and media visibility | Each permitted action, multiple audience roles, denied access, priority ordering and expiry |
| Amenities | Facility/schedule selection, booking submission, Office decisions and confirmed charge reads | Actual configured facilities/rules, collisions, approval, fee confirmation and resulting balance |
| Visitor passes and requests | Existing form/schema/submit paths and owned records | Valid submission, approval, rejection and record navigation |
| Helpdesk | Request list/detail, real conversation replies and polling | Two-account replies, read-only/resolved states, mobile keyboard and draft navigation |
| Shuttle and carpool | Shared seven-stop selectors, request controls and separate demo presentation | Actual service availability, dispatch/request lifecycle and map interaction; no live GPS or ETA is claimed |
| Notifications | Target mapping, exact-record reads and missing/inaccessible handling | Open notifications across subjects using accounts with different permissions |
| More, profile, documents and hotlines | Routes, existing profile actions, document access and telephone links | Profile changes, document permissions/downloads, theme and device telephone handling |

The review found phase-specific limits were missing from shared lot validation. Registration, Office creation, input guides and the generated account-creation function now use the supplied phase limits. Migration 074 guards new resident inserts without rewriting old address history.

Multi-audience publication uses migration 073 and the new review RPC. It updates the related content readers together; server authorization remains authoritative. See [Publication audiences](PUBLICATION-AUDIENCES.md) for deployment order and owner checks.

## Local verification

TypeScript, production bundling, targeted lint and whitespace checks are recorded in the vault Verification note. Passing these checks establishes compile/build consistency only. Production acceptance requires the owner checks above with the matching SQL, frontend and Edge deployment.
