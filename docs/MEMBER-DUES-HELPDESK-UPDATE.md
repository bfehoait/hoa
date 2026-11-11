# Member links, dues, Helpdesk and private health notes

11 November 2026. Local implementation and migration preparation only. The owner applies live SQL. No environment file or live database connection was used.

## Install

After migration 061, apply these complete files in order:

1. `supabase/migrations/202611110062_linked_directory_dues.sql`
2. `supabase/migrations/202611110063_private_health_registration.sql`

Refresh the application afterwards. Optional metadata-only readiness check: `scripts/verify-member-request-updates.sql`. Do not rerun successful CREATE migrations blindly. If 063 reports that the registration service differs, its transaction rolls back; inspect the installed function rather than bypassing the guard.

## Linked address and monthly dues

The Office directory now distinguishes an approved property link from the old recorded address. A bounded lookup covers at most the current directory page's twenty accounts, with People and Property association permissions checked on the server. Only approved, current links to active imported lots are returned. The member's recorded address is not overwritten by a property link. When lookup fails, the directory says linked addresses are unavailable rather than claiming no relationship exists.

The supplied workbook was read as data only, without importing identities or publishing source rows. Its LOT Register sheet contains 921 lots: 675 have Linear Park YES / proposed rate PHP 900, 240 have NO / PHP 800, and six have N/A / proposed rate zero. Verified Monthly Rate is blank in all rows. The owner explicitly confirmed the PHP 900/800 monthly policy; the new summary applies that policy to the imported YES/NO classification. N/A, missing and unrecognized classifications return unavailable, not zero or a guessed PHP 800.

My account displays that monthly recurring rate separately from the unavailable outstanding balance. Existing and future receipt access remains governed by the installed policies. This pass creates no invoices, accrued charges, payment allocations or scheduled billing runs. There is no supplied official billing start date or invoice schedule. Later edits to separate administrative property attributes do not silently rewrite imported evidence or reclassify these displayed rates.

Each linked lot has a Buyani payment action and its existing formatted account reference. Residents must check the reference against their provider account, including any suffix. The existing `https://pay.buyani.com/` destination is reused; supported provider channels are not invented. Opening Buyani does not mark a payment paid or cleared. A generic payment link remains available without an invented sample account number when no approved linked lot is available.

## Helpdesk

The separate Title field is removed from new Helpdesk submissions. Category determines the available type and specific-type choices. Every category and type includes Other, which accepts a short custom description. Details remain a free-text explanation. A readable title is generated from the selected category/topic for the existing request lists, Office handling and notifications. Structured topic text is stored using the existing `topic` field; no additional request authority or publication behavior is introduced. Existing requests are unchanged. The choices are triage labels, not findings of violations or promises that particular documents/services will be issued.

## Registration and health privacy

New membership applications no longer require proof-of-residence selection or a document/reference number. Historical proof values remain on old applications and are shown only when present. Migration 063 patches only the reviewed 028 application service, keeping its account-existence protection, throttling, idempotency and independent account approval path. Older clients' bounded proof strings remain accepted for compatibility.

Health conditions/comorbidities are an optional note (up to 1,000 characters), as confirmed by the owner. Registration stores it in the protected application details. On account approval, a trigger copies the note to the new private health table if the resident has no existing health note; it never overwrites a resident-authored note. Existing approvals and registrations are not backfilled by this migration.

Signed-in residents can view, update or clear their own note from Settings or My profile. Current authorized Office admins with People view and manage permission can read it in a member's Details tab; they cannot edit it through this service. Authorized registration reviewers retain their existing access to protected application details. A private table with RLS and revoked direct grants stores profile health notes. Notes are not put into profile bios, directories, audit payloads or notifications. Profile/role/account previews do not fetch or edit these notes. Updating or clearing the profile note does not rewrite the original membership application.

## Verification and limits

Both migrations compiled in isolated PGlite against an empty synthetic schema; their read SQL resolved. This checked SQL syntax and the reviewed registration-function patch, not real permission behavior, live schema equivalence, registration delivery or browser outcomes. Frontend checks and owner acceptance are recorded in the vault.

Owner browser acceptance after installing 062/063:

- Link an account in Office, then verify the directory shows the approved link while the recorded address remains separately identified.
- View My account for a YES, NO and unavailable-classification lot; inspect the monthly rate and Buyani reference. Multiple relationships to the same lot must not duplicate the card. An expired/revoked link must disappear after refresh.
- Create Helpdesk requests in each category, including both Other paths. Confirm the generated title/topic reaches the owner's request list and authorized Office handling. No request should become a community post.
- Submit a membership application without proof/reference, with and without a health note. Review it in Office and follow the established independent account-creation process.
- After approval, confirm the resident can view/edit/clear the private note in Settings and My profile. Check that unrelated residents cannot read it and unprivileged Office accounts receive no note.
- Verify health-note concurrency errors preserve the draft, preview mode shows no real note, and no health text appears in the directory or notifications.

No production records, financial postings, accounts, property links or approvals were created by local implementation.
