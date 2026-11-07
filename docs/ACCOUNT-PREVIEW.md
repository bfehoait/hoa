# Preview the actual account interface

This replaces the earlier member-inspection dashboard. **Preview account** opens the existing portal screens with the selected member's identity, roles, permissions and connected data. Menus, route guards, forms, pages and responsive layouts reuse the application components. No support-reason form or record-list inspection screen is required.

## Install

1. Keep successful migrations 001–012 installed. Do not rerun them.
2. In the same owner-approved target, SQL Editor as postgres, run the complete `supabase/migrations/202611060013_account_interface_preview.sql` once.
   Then run `scripts/verify-account-preview.sql`; all returned flags should be true. The script starts no session and returns no member data.
3. Refresh the local portal. Open Developer → member preview, or `/developer/members`.
4. Select an active member and choose **Preview account**. Their normal landing page opens. Navigate their menus as they would. The banner identifies the selected member and labels the view read-only.
5. Choose **Exit account preview** to return to the developer member picker. Your developer login is preserved. Members receive no notification from starting, viewing or ending a preview.

There is no deployment or environment-key change in this increment. The agent did not install SQL or connect to the live target. Existing accounts and personal data are not seeded, imported or modified.

## What this shows

- The selected member's normal role landing page and available workspaces, using their assigned roles and current server capabilities.
- Connected profile preferences, notifications, Helpdesk requests/threads, lots/receipt entitlements, community publications, bookings, visitor passes, activity applications and shuttle dashboards through their existing protected read functions.
- Office/developer screens only when the selected member has the necessary roles and capabilities. Developer privileges are not silently carried into the member's account view.
- The same responsive behavior at the preview browser's viewport size. This does not screen-share the member's physical device, recover their current scroll position, reproduce their local theme/browser settings, or show actions they have not saved.
- Pages that currently use labelled sample data still do so. Preview does not make unfinished portal services production-complete or invent private account data for those services.

## Read-only enforcement

The developer's real JWT and Auth session remain unchanged. A developer-only read gateway checks the audit session owner, fixed ten-minute deadline and active target on every request. It permits only an explicit list of existing STABLE read functions. Function identifiers and argument casts are checked against the system catalog; caller-supplied SQL is never executed.

Inside that guarded read, the database transaction-local member ID is temporarily set to the selected account so the existing read function applies that member's permissions and visibility. The original setting is restored on success and errors. This is scoped database read delegation, not a new member login, shared password or member JWT. Audit entries retain the original developer actor.

The browser also routes preview reads exclusively through this gateway. Direct table access, file/function APIs and unlisted mutation RPCs are refused. Request lists/threads use guarded read adapters instead of the developer's direct PostgREST table privileges. Form submission is intercepted, password/login actions are blocked, and driver presence heartbeats are suppressed. Read responses never call notification-marking or other mutation endpoints.

Preview data uses a separate in-memory query cache and separate sample-storage namespace. Exiting reloads the developer route and clears the view. Expiry, access refusal or inactive membership closes the rendered account preview. Opening another account supersedes the previous audit session. The optional backend inspection RPCs from 012 remain installed; the user-facing picker now launches the account interface instead.

## Verify after installation

Use designated test accounts with synthetic records in the approved target:

1. Preview a homeowner: confirm the homeowner sidebar and their own Helpdesk records appear. A different household's private records must not appear.
2. Preview an admin with limited grants: confirm denied office modules remain denied. Repeat with a driver/security account and verify the correct navigation.
3. Open a request form and try submitting: the preview must not save it. A driver preview must not go on duty, send presence heartbeats or accept a request. Notifications must stay unread when merely viewed.
4. Exit: confirm the original developer account is still signed in. Repeat on a phone or a narrow browser viewport.
5. End/expire the session or revoke developer access: subsequent reads must fail and close the view. Starting the view must not notify the selected member.


## Listing media after migration 015

The preview read allowlist includes bfe_listing_media. It checks the target's ownership/audience/current permissions and logs the real developer actor. The returned cover path may then be signed by the unchanged developer session for 60 seconds. No upload, link edit, role edit or listing revision is enabled in preview. Previously signed URLs can remain usable until their short expiry. New tab restrictions from 014 apply to the selected member's protected reads and navigation.
