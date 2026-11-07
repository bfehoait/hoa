# UI, access and listing media setup

Prepared and tested locally. No live database connection or deployment was performed.

## Install

1. Keep migrations 001–015 installed. Do not rerun successful migrations. If 014 or 015 is missing, apply it once in order before continuing.
2. Run the complete supabase/migrations/202611070016_access_permission_summary.sql once. It extends the existing manager-only read; it does not change anyone's permissions.
3. Run scripts/verify-ui-access-media.sql. Expected: private_tables = 3, storage_guards = 5, all other checks true, including permission_summaries_installed.
4. Refresh the local app. An updated frontend must be deployed separately before hosted users receive these changes.

No credentials are required in these files. Migration 015 creates the private bfe-listing-covers bucket and its policies. It does not alter existing buckets.

## Permissions

Open Developer → Roles & committee access and click a member's name.

Choose the data scope. Own records and association/office records are separate scopes. Each member row separates current server-reported permissions from the rule you choose. Current access stays unchanged while a draft is unsaved. Partial edit rights list which of create, reply and status changes are allowed. No access is inferred from a missing rule. Older servers show Not reported and setup guidance until 016 is applied.

The access levels use labelled On/Off toggles: No access, Read only and Read & edit. Only one level can be on. Switching it off restores defaults. A separate Use defaults button is visibly selected when no custom level is set. These rule controls never replace the current server-reported permission badges.

- **Use defaults** keeps existing role/action permissions; removing a custom restriction can restore those rights.
- **No access** blocks reading and writing in that scope.
- **Read only** permits viewing and summaries, and blocks changes in that scope.
- **Read & edit** permits view, summary, creation, replies and status updates. Explicit action denials still win. Approval, publication, export, work assignment and management require separate action grants below.

Role and committee defaults have a separate disclosure. Group rules do not pretend to be the effective permissions of every member.

Record a reason and save. Server rules apply immediately; other browsers refresh on focus or within 30 seconds. Stale saves are rejected. Per-user rules override group rules. Among group rules, hidden takes priority; otherwise edit wins over view. Explicit action denials still win.

Profile and support remain available. Developer recovery access is protected. No new staff/committee powers are enabled just by installation: existing defaults remain until configured.

To designate an admin, open the name of an active account holding the admin role, enter a reason and choose **Allow permission management**. That admin uses Office → Roles & permissions. Only developers appoint/remove managers. Delegated admins cannot edit their own roles, change developer accounts, grant developer status, or grant beyond their own authority. Restoring inherited access and removing assignments containing denials requires developer review.

Existing account roles, committee assignments and advanced action-grant forms remain below the tab editor. Use action grants for publishing or approval and to activate committee membership; committee defaults affect only active, non-expired assignments.

Implemented services enforce these permissions in protected operations. Tab rules also guard writes to requests, feature submissions, bookings, visitor passes, participation and shuttle records. This is not a claim that unrelated legacy tables/policies have all been hardened.

## Marketplace

Members open the marketplace or /directory/market. The six sections are businesses, buy/sell/services, jobs, garage sales, booth events and workshops.

1. Choose a section and **New submission**. Complete its fields and select publication consent to allow member publication.
2. After saving, My submissions shows the record. On an unreviewed, consented listing, add one cover photo and up to five optional HTTPS links.
3. Give each link a clear label: Website, Facebook, Messenger or WhatsApp, for example. Link submission explicitly authorizes review/publication of those specific links; private household addresses are not added automatically.
4. Authorized staff open the section's Office review, inspect the text, photo and links, move it into review, then publish curated public title/body, audience and expiry. Publishing needs livelihood / publish / association, separately from review access.
5. Other members see the listing, cover and links only after publication, within its audience and expiry. Private submitted fields and automatic owner identity/contact details remain restricted.
6. Owners can edit businesses, buy/sell listings, jobs and garage sales. Editing removes the published copy until review finishes again. Workshops/booth events retain their existing review/participation flow; changes to activities with participants require office handling.

JPEG/PNG/WebP input up to 8 MB is decoded, resized to at most 1200 pixels and re-encoded by the browser. The bucket accepts WebP up to 1 MB; SVG is not accepted. Covers cannot be overwritten. Remove a cover while unreviewed to select another. Media changes invalidate stale reviews. Failed uploads can be retried or removed.

Private image URLs last 60 seconds. Withdrawal/expiry blocks new access, but an issued URL may work until its short expiry. In account preview, target media access is checked/audited through the preview gateway before the unchanged developer session signs that returned path. Uploads and edits remain disabled.

Removed covers remain inaccessible in storage until an authorized maintenance process deletes orphaned objects. No retention period, automatic cleanup, malware scanning or backup/recovery guarantee is invented here.

Storage follows [Supabase access-control guidance](https://supabase.com/docs/guides/storage/security/access-control) and [private asset delivery](https://supabase.com/docs/guides/storage/serving/downloads). Local checks cover SQL policies and mocked uploads; the actual Storage service needs an owner-run smoke test after installation.

## Facility bookings

Configure actual facilities and approved hours/capacities with the existing Office facility configuration. No official fees, venues or operating hours are invented.

Residents open Services → Bookings, choose a facility/date and select start/last time slots. Reserved and past slots are disabled. Times use Asia/Manila; typed start/end inputs remain available.

The desktop dialog pairs a calendar with the time picker; narrow screens use their native date input. Changing facility/date clears the time selection. The New booking button is unavailable when no eligible active facilities exist. An authorized admin can open Office → Bookings → Configure facility to enter approved names, hours, slot durations, capacities and renter eligibility. Account preview permits exploring selections but cannot save.

Developer → System modules → Livelihood & marketplace remains a monitoring screen. Use **Open marketplace workspace** there to add listings, or **Review marketplace submissions** to open the review queue. These links do not replace the server's individual permission checks.

Pending and approved bookings hold their intervals. The server locks the facility and checks overlap again on submission. Rejection/cancellation releases the slot; touching adjacent intervals are allowed. An open booking form refreshes availability every five seconds; the records list refreshes every 30 seconds. A stale visible slot is still rejected by the server if another resident reserves it first.

Other residents see reserved intervals only. Booker identity, unit, contacts and private purpose are restricted to the owner and authorized staff.

## Developer posting

Developer posting is available from the developer overview on both phone and
desktop: **Create announcement** opens the existing announcement form; **Create &
review submissions** opens the existing section chooser for supported connected
features. An active developer-only account is sufficient when authorized by the
server. Submission is separate from review/publication and does not perform
unimplemented operational actions. Legacy read-only sections remain unavailable.

## Owner smoke test

Use synthetic accounts: two homeowners, an authorized reviewer and a designated admin. Verify view-only rejects a write, the second resident cannot see an unpublished listing/photo, publication makes it visible, editing hides it again, and overlapping bookings are refused. Verify one actual Storage upload/download. Do not put real resident data in test screenshots.
