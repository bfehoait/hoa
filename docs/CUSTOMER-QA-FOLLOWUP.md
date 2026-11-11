# Customer QA follow-up — 10 November 2026

Owner preference update: the neutral billing notice below was subsequently rejected. The burgundy Total balance hero with HOA dues / Water dues / Other tiles has been restored; unavailable values remain explicit. Functional QA fixes remain.

Reviewed the owner-supplied Claude report against the local source. Report observations are useful evidence, not a replacement for actual-device acceptance. No live database changes, deployment or automated test suites were performed.

| Finding | Local change / disposition |
| --- | --- |
| Pass creation opens without an eligible lot | Resident creation and composer now require a lot returned by the existing authorized dashboard. A preflight card links to the existing lot-link request workflow. A single linked lot is selected automatically. Server permissions remain authoritative. |
| Duplicate pass buttons and awkward submission label | Removed the second creation button from the empty state; shortened submit to Request pass / Request booking. Mobile task footer uses sticky positioning and nonwrapping controls. |
| Empty Helpdesk looks like administration | Resident statistics and database/source commentary are hidden. Filters/refresh appear for at least five results or an active filter; office controls remain. Error state includes Retry. One New request action remains. |
| Billing missing-data warning | Replaced the burgundy missing-balance hero and empty breakdown with a neutral statement notice. Actual recorded-payment access and disclosure remain unchanged. n/a addresses become Not recorded. |
| Resident wording | Simplified offline, view-only, posting help and More descriptions. Necessary sample/read-only account-preview notices remain explicit. |
| Announcements selects More | Resident community routes now belong to Home for navigation highlighting. |
| Repeated navigation | Removed Vehicles, Permits, Documents and the general Helpdesk item from More; Services remains their catalogue. Existing routes and global feature search remain. Preserved owner-requested complaint/concern/issue task shortcuts and useful Home shortcuts. More uses grouped rows. |
| Repeated search | Removed feature-search fields from Services and More. Header search remains. Content searches for listings/announcements remain because they search different data. |
| Amenity hidden in dropdown | Replaced the selector with visible, keyboard-accessible amenity buttons showing configured hours, intervals and capacity. Live date/time availability still controls selection. No photos or availability guarantees fabricated. |
| Crowded/contradictory marketplace | Hide search/sort and count heading on the unfiltered empty feed. Read-only mode suppresses posting/manage buttons even when the feed lists postable modules. Category tabs remain so a filtered empty view is recoverable. |
| Emergency hotline hierarchy | Added a prominent owner-confirmed Rescue 161 dialer action before the contact list. No unverified 911 number was added. Desktop emergency list occupies the wider left column; HOA/security and utilities stack on the right. |
| Ambiguous resident dates | Feature/announcement lists use named months, days and years in Philippine time. |
| Internal-link arrows | Changed Home and feature-search internal destination arrows to chevrons. This is a targeted customer pass, not a claim that every arrow in every staff/legacy screen changed. |
| PWA absent in dev | Confirmed production build generates manifest.webmanifest, sw.js and Workbox assets. Actual standalone installation and updates require Android Chrome/iPhone Safari checks on a hosted production build. |

## Preserved decisions and remaining dependencies

- Keep the owner's Home / Account / Livelihood / Services / More navigation and automatic announcement carousel, including pause and reduced-motion support.
- Estate/amenity photos require approved assets. Current selectable amenity cards use icons and actual configured metadata.
- No mock QR or Share-as-valid-pass feature was added. A usable visitor QR must have a defined server validation/revocation workflow and privacy-safe sharing before shipping.
- No decorative serif rollout or wholesale typography change was made solely on stylistic feedback. Resident readability and the existing Bellefort design system remain.
- The account/lot linking review parked for the admin phase is not bypassed by the new pass preflight.

## Validation and owner acceptance

TypeScript and production build checked locally; the generated manifest/service worker are build evidence only. Existing large-chunk and zod annotation warnings remain. Source reviewed for resident/office scope, linked-lot preconditions, retained filters after an empty search, posting visibility, dates and call URLs. Scoped whitespace checks performed. No automated suite, new browser walkthrough, axe scan, real phone call or live database test was run.

Owner should verify:

1. Unlinked resident sees lot guidance and cannot open a pass form; linked resident sees one creation action and can select their household.
2. Pass footer stays usable with a phone keyboard and text scaling; dirty-close protection remains.
3. Empty and populated Helpdesk, filtered zero results, Retry and five-plus result controls.
4. Account neutral billing notice and actual receipt loading/error states.
5. Amenity button selection, date/time range, reset and current availability refusal.
6. Marketplace read-only versus posting-enabled accounts, empty feed and filter recovery.
7. Announcements keeps Home selected; customer search, Services and More links still work.
8. Hotlines phone handoff and short-code carrier behavior. Do not place test emergency calls.
9. Hosted production installation, offline shell, update prompt, keyboard and safe areas on real iOS/Android devices.
