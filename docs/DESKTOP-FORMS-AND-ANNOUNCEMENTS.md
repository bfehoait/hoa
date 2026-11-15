# Desktop forms and announcement audiences

Updated 15 November 2026. Local implementation; no live SQL, deployment or browser verification performed.

## First item opens on desktop

- Review inbox opens the first submission on the displayed page when there is no explicit selection. Selection uses the existing URL, detail readers and decision handlers. Pagination and filters can open their first item too.
- Explicit record links take priority. The inbox does not replace a selection while a form is locked, a mutation runs or a dialog is open. Background refresh keeps the chosen record.
- Office Helpdesk selects its first request and retains that selection during refresh, so a new incoming request cannot replace an open conversation. Resident phone conversation navigation is unchanged.
- No approval, reply, read permission or account creation is performed by automatic selection.

## Desktop form polish

Shared desktop dialogs use tighter header/body/field spacing, consistent labels, and 48px controls. Existing field groupings, validation, focus management, dirty-form protection and submit handlers stay in place. Feature forms align required labels and use a keyboard-accessible image chooser with filename, existing preview/removal controls and an obvious focus outline. File validation, resizing, private uploads and retry steps are unchanged. Native phone upload controls and phone sheet layouts remain.

New announcements use the shared audience checkboxes. Choosing a group automatically deselects All members; choosing All members clears specific groups. Multiple specific groups are allowed. Optional image-description metadata is omitted from this form (the existing optional field is submitted empty); the actual image picker remains. Saved announcements show their complete audience set, including when reopened for publication.

## Required rollout

1. Owner runs [migration 081](../supabase/migrations/202611150081_announcement_audiences.sql) after existing 080.
2. Deploy the matching frontend through the normal reviewed release process.
3. No BFE / `bfe-create-account` Edge Function redeployment is required.

Migration 081 adds a guarded announcement submitter that saves chosen audiences atomically with the draft, before an image upload. The normal submitter still checks create permission, validates the original fields and enforces idempotency/rate limits. A retry with a different audience is rejected. Drivers is added to the validated legacy audience labels so a Drivers-only draft is labelled accurately. The existing publisher keeps migration 034's author, consent, publish permission, exact content/image, expiry, repeat-request and republish checks. It uses the saved audience set and restores it after migration 073's legacy-audience reset trigger in the same transaction. Existing single-audience posts keep their visibility. Existing 073 readers enforce the saved role set. No accounts, content or role/capability grants are added.

Until 081 is installed, the new announcement submission fails rather than falling back to publishing to a wider audience. The existing saved-announcement path also reads the durable audience set after 081.

## Visitor pass wording

The form and details now say **Pass starts** and **Pass ends**. Both dates/times are chosen by the person making the request, in Philippine time. The current server and table rules allow visits shorter than 24 hours, with a maximum of 24 hours. This change does not authorize longer passes; a different maximum remains an owner policy decision. Amenity rules were deferred as requested.

## Owner browser verification

- Open Review inbox and Helpdesk on desktop: first detail appears; selecting another item, filtering, paging and notification links work. Refresh while writing a reply or review note does not move to another record or discard text.
- After 081, publish to two specific groups, one group (including Drivers), and All members. Check the saved audience label and visibility using accounts with the corresponding roles. A role outside a selected set must not see that post.
- Attempt publication with no audience or without permission/consent; it must fail. Repeat a request after an uncertain response; it must not create another announcement or change its audiences.
- Choose/remove/replace an image. Interrupt its upload, then retry or reopen the saved unpublished announcement; its audience must remain the same.
- Check desktop dialogs in light/dark themes: title/details, audience, image preview, consent, keyboard focus, actions and scrolling. Confirm phone forms retain their layout.
- Create a short visitor pass with different start/end times; confirm the chosen times are displayed and existing date validation still applies.

Local verification results are recorded in `docs/vault/Verification.md`. Live SQL and browser checks remain the owner's responsibility.
