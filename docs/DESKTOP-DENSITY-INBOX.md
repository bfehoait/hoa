# Compact console and submission inbox

## Final implementation - 14 November 2026

This supersedes the initial queue-summary design. Review inbox now lists individual submissions from the existing authorized readers, with the selected submission and its existing decision workflow on the right. It remains at `/office/approvals`; it does not redirect to People, Facilities or Operations to review a record.

`inbox-records.ts` projects a small, validated display envelope from the existing registration, booking/pass, feature, issuance, household, accounting, participation, garage-item and pending-lot readers. The list requests up to 20 records per visible type/page. An All types filter combines those pages; the count explicitly describes loaded records, not a complete association-wide pending total. Pagination advances each visible reader; filtering to a specific type provides that type's own pages. Queue counts and every read remain server-authorized. Reader errors are shown per type with Retry, not treated as empty queues. Loaded previews are never substituted for real submissions.

The selected record uses the existing desk's fresh read, validation and actions. Bookings and passes have direct Approve/Reject submit buttons with their existing required note and version. Registration uses the existing Approve & create account form, which still needs account setup; no welcome-email behavior is invented. Feature publication retains its reviewed public copy, audiences, consent and expiry requirements. Accounting posting, permit/sticker issuance, verified lot links and household application retain their distinct authorized actions and confirmations. Activity decision forms render inline. Confirmation/history/account-setup dialogs may still open over the inbox when their workflow requires them.

`ReviewSurface` identifies the selected record/page. `ReviewDetailFrame` presents existing booking/pass and feature/activity forms inline. Queue/record/type/page switches are blocked for pending mutations, unsent inline replies, dirty inline forms and open modal dialogs. Dirty inline forms warn before browser reload and offer explicit discard. This does not introduce a universal router blocker for browser Back/Forward. The originally inspected booking/pass, feature and participation version is retained during the review, so polling cannot silently replace its concurrency token. All decisions continue through the original RPCs. Successful writes invalidate the item feed and queue counts.

The update/Refresh instruction row has been removed from Review inbox; background polling continues. The sidebar search says Find a screen, distinguishing it from record search. No new SQL, Edge Function or permissions are introduced.

Shared Office/Board/Security/Transport and Developer headers now use smaller titles/descriptions and omit repeated workspace/title breadcrumbs. The routine signed-in workspace strip is removed for real sessions. Synthetic preview labels, read-only restrictions, offline/error notices and actual security guidance remain. Theme and notification controls retain 48px targets, occupy a reserved desktop corner and no longer overlap the signed-in strip. Create account uses a non-wrapping trigger; header actions share an intrinsic-width row instead of a narrow stacked column.

Facilities restores the earlier rounded day buttons and paired month/selected-day agenda at wide desktop widths. Existing facility/status filters, month navigation, selected date, reservation actions, pagination and data readers remain intact. At narrow widths the agenda stacks below the calendar.

Desktop spacing continues to use compact filter bands, 16px panel padding and 12-16px section gaps where appropriate. Body/control text and 48px control targets are retained.

## Owner browser checks

- Open each accessible submission type and review an individual item; confirm the sidebar remains on Review inbox and the right panel has only that item's details/actions.
- Submit authorized test booking/pass decisions with required reasons; verify successful writes remove/update the item and counts. Test denied/read-only accounts.
- Complete registration through the existing account form. Check account connection and confirmation; verify no email is promised or sent by this UI.
- Check feature review/publication, accounting approval, garage publication, household/lot linking, permit/sticker issuance and activity decisions. Check Helpdesk replies and shuttle actions separately in their own desks. Confirm each retains its dedicated requirements and permissions.
- Check list pagination, All types versus a single type, partial reader failures, empty queues, URL reload and browser Back/Forward. Reader results can shift between pages as other staff process records; an unavailable detail must be reselected, not assumed approved.
- Type an unsent reply/note, try switching items/type/page, then send/discard. Confirm dirty/native-modal protection and stale-version errors. Background reads must never silently approve or alter a record.
- Check all console headers, Create account, theme/bell alignment and the facilities month-plus-agenda at desktop, tablet and phone widths, light and dark.

## Rollout and validation

Frontend deployment only for this UI pass. No SQL or `bfe-create-account` redeployment is required. Existing pending migrations are separate work. Local validation results are recorded in the handoff and vault; browser rendering, live authorization/decision execution and live database checks remain with the owner. No full automated test/E2E/axe suite was run.

## Approval-only scope correction

The owner clarified that Review inbox is for decisions, not the operational worklist. `office-approval-queues.ts` now defines the shared presentation boundary. Helpdesk conversations/issues, Helpdesk feature modules and ride dispatch are excluded from the inbox's items, type filter and approval counters. They continue to use their existing Helpdesk/Transport desks. Amenities, registrations, permits/vehicles, passes, publication reviews, accounting reviews and other actionable approval queues retain their existing in-inbox decision workflows. Read-only reviewers remain able to inspect the queues authorized by their services; filtering does not grant or remove server permissions.

The item reader also rejects non-approval queue types before any request. Old Helpdesk/dispatch inbox URLs cannot reopen those details; an obsolete type filter falls back to the available approval types. The Office overview can still show a separate Helpdesk workload card and operational worklist. No SQL or BFE rollout is needed for this correction.

Owner check: confirm there are no Helpdesk issues/conversations or shuttle dispatch entries in Review inbox or its type filter, while their original service desks still work. Review an amenity booking and another approval type in place; check Approve/Reject and required decision notes. Overview approval counts should exclude operational Helpdesk/dispatch work.

## Compact selected-submission panel

The selected item has one icon/title/status header. Inline passes and amenities use a single labelled details block, with left-aligned values, compact row spacing, booking/pass date ranges and actual household/attendee information. Repeated standalone names/status bars/purpose/date paragraphs are omitted only inside Review inbox; standalone dialogs retain their presentation. Feature details also omit the repeated heading/status and nested card border inside the selected panel. Registration details use one continuous block. Inline decision forms use smaller gaps and a two-row note field while retaining all existing validation, required notes, fee notices, history access, mutation handlers, version checks and 48px action targets. No SQL, account creation behavior or notification behavior changes.

Owner browser check: compare a pass, amenity booking, registration and feature review on desktop/mobile and light/dark. Check long values wrap, notes remain resizable, History expands, validation still requires the original note, and decision actions remain visible.

## Five-item pagination and smaller desktop typography

The approval list now displays five submissions per visible page. Previous / Page / Next live in a compact horizontal footer with 48px controls; submission-row CSS is scoped to actual list buttons so it cannot stretch pagination actions. The list heading shows the displayed range. An overall total/page count appears only once all accessible source batches have loaded successfully; partial failures show their queue and Retry rather than a fabricated total.

Existing authorized readers retain their 20-record backend pages. A shared infinite query loads source batches on demand, skips exhausted sources and preserves each row's original backend page for opening the existing detail/decision reader. Additional batches append without rearranging already-loaded pages; duplicates are removed. The UI page is stored in inboxPage, resets on type changes and is clamped if approvals shrink the last page. Switching pages clears the selected item and returns to the list heading. Dirty forms, active mutations and modal guards remain. Successful mutations invalidate the paged list, and unlocked polling remains enabled. No new RPC, SQL migration or approval permission is introduced.

Workspace picker labels contain just the workspace name; pending counts remain on their navigation destinations. At desktop widths (1024px and above), staff page headings use 24px, section headings 18px, card titles 16px and major figures 32px. Body text remains 16px and supporting text at least 14px. Mobile typography and 48px controls remain unchanged. These changes require frontend deployment only, with no additional SQL or bfe-create-account redeployment.

Owner browser check: navigate through more than one backend batch and each submission type; use Back/Forward, approve the last item on a page, retry a failing queue, and confirm selection/version/decision behavior remains correct. Check the compact pagination at narrow widths and desktop typography in light/dark. Local checks are recorded in the verification vault note; no browser or live decision execution is claimed.

## Long desktop submissions and conversations (15 November 2026)

Review inbox keeps its five-item list sticky beside long submission details at widths of 1200px and above. The list is capped to the viewport, with only its rows scrolling; its heading and Previous / Page / Next controls remain outside that scroll area. Details keep normal page scrolling.

Helpdesk uses the same sticky, viewport-capped request list above its existing two-column breakpoint (1100px). Long conversation replies scroll within a region capped at 480px or 55% of the viewport, whichever is smaller, leaving reply pagination and the composer below the messages. Scrollable lists/replies can receive keyboard focus with a visible outline. No automatic jumps, message ordering, read queries, decisions, dirty-edit protection or pagination logic changed. Single-column/mobile screens retain normal page scrolling.

Owner browser check: open a long submission and scroll its details; verify the list stays visible and its footer works. On a short desktop window, scroll the list with wheel/touchpad and keyboard, then change page. Open a long Helpdesk conversation, scroll replies, load older/newer replies, and send a reply; confirm the composer remains reachable and unsent edits stay protected. Check phone/tablet single-column flow, zoomed desktop, and light/dark. Frontend deployment only; no SQL or BFE redeployment for this change.

## Shared announcements and clearer Helpdesk (15 November 2026)

Office Community and Board Updates are now labelled Announcements in navigation, page titles, overview links and the related preview labels. Existing URLs remain intact. Office management and the Board/resident publishing reader reuse AnnouncementCard and its responsive card grid: consistent metadata, title/icon, short excerpt and View announcement action. Office keeps its original publish/unpublish/history eligibility and reader. Board keeps its existing published/my-submissions reader, detail Sheet and permission-gated actions. Full text and images open on demand instead of expanding a huge image in the list; original image authorization and upload rules remain.

Office Helpdesk now groups request facts in aligned label/value rows, separates assignment/priority into a compact summary and labels the edit action plainly. Conversation spacing and message wrapping are tighter; the reply composer places Send alongside the field on desktop. Existing status actions, required resolution, reply handling, error feedback, pagination, locks and mobile conversation component remain.

Owner browser checks: compare Office Announcements and Board Announcements in light/dark and desktop/mobile; open long text and image posts, text-only posts, use search/view/pagination, and verify existing publication/history/create actions. Confirm Board users cannot acquire Office management actions. Check Helpdesk long values/messages, assignment editing, status changes, unsent-reply guards, error placement and reply sending. Local checks are recorded in the verification vault. No SQL, role changes or BFE redeployment for this UI pass.

### Announcement image follow-up

The shared announcement card now displays its existing authorized cover directly below the text, for both Office and Board/resident publishing lists. Desktop uses two columns, with responsive stacking on narrow screens. Long text has See more / See less; original line breaks are retained. Images use a bounded 4:3 contain area so posters are not cropped. Text-only cards omit the absent cover. Existing ListingMedia authorization, signed-URL lifetime/error handling and lazy image loading are reused. View announcement still opens full details, and publish/history controls are unchanged. Owner should check image/text-only posts, long text expansion, expired/unavailable images, both roles and light/dark/mobile.

### Announcement inline-only follow-up

Removed the redundant View announcement button now that text, images and published links render directly in shared cards. Long text still expands inline. Office retains publish/unpublish/history and an Edit image action only for its already-authorized own Submitted posts with consent; notification/deep-link detail routes remain available. Board keeps its existing create/submission flows and receives no Office-only actions.
