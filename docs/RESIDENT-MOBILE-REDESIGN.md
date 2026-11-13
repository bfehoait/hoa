# Resident mobile redesign

Local implementation, 13 November 2026, based on the owner's mobile screenshots and built on Claude's existing Sheet conversions. Nothing was committed, pushed, published or deployed. No SQL or live backend connection was used.

## Implemented screens

- Shared shell: maroon mobile header, Philippine-time greeting and signed-in name on Home/Account, screen titles/subtitles elsewhere, accessible Back control, notifications, rounded content surface and bottom navigation with active icon pills. Desktop/staff navigation keeps its existing structure. Global feature search remains available on its screen and through More.
- Home: compact balance shortcut above scripture, four permission-filtered quick actions (visitor pass, amenities, Helpdesk, shuttle), native horizontal announcement browsing on phones, existing hotline carousel and grouped community links. Announcement readers and their real published-content query remain intact; desktop carousel controls remain available. Phone announcement cards load their authorized cover metadata and lazy images as they become visible, without auto-rotation.
- Account: shared greeting, prominent posted balance, Pay dues/History/HOA bills actions, separate dues breakdown, confirmed property/rate/reference/payment cards and mobile Records navigation. The existing lot-link request is still available. Desktop properties/payment tabs remain; mobile History opens the existing recorded receipts view. Bill/amenity record links still appear only when confirmed records exist.
- Livelihood: maroon title/search area, rounded Browse/My listings/My applications controls, horizontal categories, filter disclosure and the existing auto-fill listing grid. All six categories, the + listing composer, own records, event applications and deep links remain.
- Amenities: numbered selection/date/time/request headings, one-column selectable facility cards with selection markers, rounded calendar/time surfaces and booking actions. Rates and detailed guidelines remain available in a disclosure. All existing daily restrictions, configured attendee/duration/slot limits, availability reads and submit checks remain server-owned and unchanged. Seven 48px date targets retain horizontal scrolling where the phone cannot fit them.
- More: signed-in profile/address card, profile/notification links, per-device appearance switch, Search, community documents, Help and sign-out. Other authorized services remain in More services on mobile and retain their normal desktop groups. Workspace choices and gated maintenance/preview disclosures remain. The theme switch synchronizes with the shell and Settings.
- Helpdesk: mobile New request action, Open/Resolved views, compact rows and maroon/white resident/Office message bubbles in the shared sheet. Open includes Open and In progress via an authorized read filter, not a new status or approval rule. Office filters retain their current choices. Reply permissions, request creation, exact-notification targets and protected status actions remain.
- Shuttle: mobile header, rounded service/route/request cards and horizontal request-status progress. Existing stop selection, roster/readiness reads, request/cancellation actions and history remain. The existing illustrative map is retained behind an explicitly labelled disclosure instead of being represented as live tracking.
- Visitor pass and other resident dialogs: retained Claude's Sheet conversions. Sheet still delegates focus trapping, background scroll locking, Escape/scrim dismissal, focus restoration, unsaved-change protection and visual-viewport keyboard handling to the shared Modal. Sheet additionally accepts a class for conversation styling. The pass footer still submits the original form through its form ID. Notifications use Sheet on resident paths and preserve Modal on staff paths.

## Deliberate accuracy differences from the pictures

- No posted bills means **No posted charges**, not a claim that every dues category is settled. Water remains unavailable until backed by data. Positive, loading, error and reconciliation-review states still come from the existing reads.
- The screenshot's Statement action is labelled **HOA bills**, opening the real bill details. No official financial statement is invented.
- Provider references keep the existing owner-supplied format and suffix-matching reminder. Opening Buyani does not confirm payment.
- Hotline contacts come from the existing approved arrays. The screenshot's staff names/emails were not added.
- Booking limits/rates are not copied from illustrative screenshots. Display uses installed facility data and existing guidelines.
- No sample driver, plate, ETA, request, receipt or listing is inserted. Live shuttle tracking and arrival estimates are explicitly unavailable; the stop demonstration retains its synthetic/unverified disclosures.
- Helpdesk does not invent unread indicators or last-reply previews absent from the response. Existing request metadata and actual messages are displayed.
- More uses the existing Help route rather than inventing an official About page with unverified content.

## Source and behavior review

The new layout is scoped to resident phone widths with CSS Modules and existing tokens; shared cards remain usable at wider widths. Surface/text colors follow the selected light/dark theme. Header color rules are restricted to direct header controls so they do not recolor notification-sheet actions. The compiled main selector preserves the global `#content` ID.

No RPC names/signatures, SQL, schemas, role assignment, approval, payment, booking creation or reply handlers were replaced. Helpdesk's production Open filter excludes Resolved at the existing authorized table read before paging/counting, retaining own-account filtering and RLS. The developer account-preview adapter only supports individual status filters; its combined active view filters the returned preview page and uses unknown total, rather than claiming an exact active count. Real resident paging/counting uses the server-side filter.

## Verification and owner acceptance

TypeScript/production build, targeted ESLint, edited-source formatting and `git diff --check` passed. Existing build warnings about Zod annotations and the large map chunk remain. No automated suites, E2E, axe sweep or browser run was performed, following AGENTS.md. Source checks and compilation do not certify mobile appearance or live end-to-end delivery.

Owner browser review is required before calling this visually accepted:

1. Phone widths 320/360/390/430px, landscape, light/dark, long names/amounts and text zoom. Confirm the header, rounded body, single Back and safe-area bottom navigation.
2. Home balance/error states; all four quick actions; swipe and open each real announcement; scroll/call hotline contacts; community destinations.
3. Account zero/positive/review/unavailable balances, rates and references; one copy action; Buyani handoff; property details/link request; actual bills, amenities and receipt date filters/paging.
4. Livelihood Browse/My listings/Applications, all six categories, search/sort, + creation/edit/withdrawal, missing photos and event application.
5. Amenity selection, small-screen calendar scrolling, allowed/blocked slots, attendee limits, request submission, cancel/reset and booking details/charges. Verify actual Office-visible delivery.
6. More theme changes persist and stay synchronized when returning from Settings; all additional authorized services and workspace access remain reachable.
7. Helpdesk Open includes in-progress requests; Resolved records open; create/reply/status restrictions and actual Office delivery; keyboard, history/paging, notification deep links, dirty-sheet close confirmation and focus return.
8. Shuttle real status/vehicle availability, stop selection and cancellation; do not interpret the labelled demo map as live location or an ETA.
9. Visitor pass required fields/dates, pinned actions above phone keyboard, Escape/scrim/close, focus loop/return, pending double-submit protection and Office receipt of the saved pass.
