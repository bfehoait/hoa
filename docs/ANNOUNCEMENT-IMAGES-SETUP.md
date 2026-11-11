# Announcement images

Prepared locally on 9 November 2026. The owner applies the database update and checks the website.

## Setup

1. Run the complete `supabase/migrations/202611090030_announcement_images.sql` after 029 in SQL Editor. Existing private listing-cover storage from 015 must be installed. No sample announcement or image is inserted, and no role permission is granted.
2. Refresh the updated local portal. Deployed websites also need the updated frontend through the owner's release process.
3. Open Announcements, then New announcement. Enter the required details and optionally choose a cover image. JPEG, PNG and WebP files up to 8 MB are accepted; the browser prepares a WebP cover up to 1200 pixels on its longest side and under 1 MB.
4. Check the preview. Choose another image to replace the selection, or Remove selected photo for a text-only announcement. Keep generated demonstration content labelled SAMPLE ANNOUNCEMENT.
5. After 031 is installed, authors who already have community publishing and association-view permission see Publish announcement. Choose an audience, a future expiry within one year and publication consent. The text/image are posted directly after upload, without a separate reviewer. Other authors keep Submit for review. If upload or publication fails, retry the same saved submission or open its saved record to inspect it; do not create a duplicate announcement.
6. In Your requests, the author can remove a saved cover and add another while the announcement is still Submitted. Reviewers see the image in the office queue. Image upload/removal changes the record version; reopen a review if the version changed.
7. Published, unexpired announcements show their cover on Home (up to four announcements) and in the announcement list. Authors without publishing permission use the existing review steps. Images are optional. Store important announcement content as text too, so a banner is not the only source of information.

## Direct publication update

Apply `supabase/migrations/202611090031_direct_announcement_publication.sql` after 030. Do not rerun older installed migrations. Refresh the updated frontend. No Edge Function update is required. Role names alone do not authorize publication; this uses the existing community publish/view permissions.

The new endpoint publishes only the signed-in author's own Submitted publishing record, validates consent/audience/expiry, compares saved content and cover against the submitted snapshot, and checks that any selected image exists in private storage. Upload/removal and publication serialize on the same record lock. Published content remains subject to existing audience, expiry and withdrawal rules. The audit records direct publication honestly, without creating artificial review decisions. Repeating an identical completed publication does not create or change a post. A failed upload/publication can leave an unpublished saved record that needs retry or inspection.

TypeScript and isolated SQL compilation are local checks only. The owner must verify direct publication with/without an image, upload failure, repeated submission, expired content, audience isolation and refusal when publish permission is absent. Other workflows retain their existing review process.

No Edge Function update, new key or custom secret is needed. This extends existing protected cover functions for the publishing module using community permissions. Existing livelihood media keeps livelihood permissions. Private storage, audience/expiry checks, immutable paths and review locks are reused. Signed image links expire after 60 seconds; a link already issued may remain usable until it expires. Removing a cover detaches it from future reads; old storage objects are retained for owner-managed cleanup. Images cannot be changed after review starts or while published; do not bypass review to replace a published image.

## Verification

### Published / Unpublished manager (034)

Apply `supabase/migrations/202611090034_announcement_management.sql` after 033, then refresh the frontend. Office Announcements and Office Community now use a dedicated manager with Published / Unpublished views, accurate server-filtered totals and pagination, direct author publication and an Unpublish confirmation. No post is changed when this migration is installed. No Edge Function update is needed.

Unpublish removes a post from customer reads by setting the existing stored state to Withdrawn. The record, image and audit/history remain; this is not deletion. Community publishing and association-view permission are required. Version checks protect against stale actions and an identical unpublish retry is a no-op. The existing write guard remains in force.

Unpublished groups unfinished, withdrawn, rejected and expired records, without presenting them as an approval queue. Authorized authors can finish their own legacy Submitted/In review/Reviewed posts or explicitly republish a withdrawn/expired post after choosing a fresh expiry. Rejected posts remain closed, and other authors' posts cannot be published through this action. A prepared cover must already have uploaded successfully. Existing consent, content/cover snapshot and permission checks remain.

The new management read is restricted to active accounts with association-wide community view permission; ordinary resident Home/announcement reads keep the existing audience and expiry filters. Local verification executes grouping, legacy direct publication, unpublish retention/idempotence and permission refusal with synthetic data and stub permission helpers. Owner checks the actual staff UI, customer disappearance, retained history/images and permission boundaries after setup. Other request/document workflows retain their existing review steps.

### Publication variable correction (033)

After 032, apply `supabase/migrations/202611090033_announcement_publication_variable.sql`. Migration 031 compiled but failed when publication executed: the local audience variable was qualified as `bfe_publish_announcement.audience`, producing SQLSTATE 42P01. The generic frontend handler mistook that code for a missing database migration. Migration 033 uses an unambiguous local variable and replaces only the publishing function, preserving all permission, ownership, snapshot, image and expiry checks. It does not remove saved records or images.

If the original form is still open after its upload succeeded, click Retry publication after 033; its saved image is reused. A closed form's saved record remains available. Local verification executes a synthetic publication and identical retry, checks one audit entry and image handling, and rejects changed snapshots and unauthorized callers; live confirmation remains with the owner.

### Storage upload identity correction (032)

If upload returns 403 and Server detail says the upload trigger refused the record, apply `supabase/migrations/202611090032_storage_cover_upload_identity.sql` after 031. This replaces only the cover-upload trigger function. Do not rerun 030/031. Supabase Storage checks caller permissions before committing final object metadata under a service database context; the old trigger incorrectly relied only on the current JWT's user for that commit.

The corrected trigger requires the Storage object's top-level owner to equal the prepared announcement/listing owner, requires an active owner with create permission and a Submitted, consenting record, and keeps the shared row lock and version/audit update. Ordinary authenticated callers must also match that owner. No authority is taken from user_metadata, and no bucket is made public or policy disabled.

Retry publication on the existing open form, or add the cover on its saved Submitted record. If the form was closed, the existing saved record can use the review/publication controls; do not create duplicate posts merely to retry an image. Live Storage behavior still needs owner verification after applying 032.

Frontend/shared TypeScript and isolated SQL compilation with stub dependencies are local checks only. Live uploads, owner permissions, storage policy interactions, stale-review rejection, image replacement, text-only announcements, audience/expiry restrictions, phone layout and existing livelihood images need owner browser verification. No live connection, deployment, automated test suite or end-to-end run was performed.
