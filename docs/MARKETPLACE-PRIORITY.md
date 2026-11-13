# Multiply Talents feed priority

The owner requested first position for the official Multiply Talents business,
without a visible pin badge. Priority is configured against an exact record UUID,
not a user-editable title or submission field.

1. Run migration `202611130071_marketplace_priority.sql` after 070.
2. Use the lookup in [the configuration script](setup/pin-multiply-talents.sql)
   to find and verify the official business listing.
3. Set `chosen` to that UUID and run the configuration transaction separately.
4. Reload Livelihood and check All listings and Local businesses.

The selected listing sorts first before date or price ordering. Ordering happens
before pagination, so the record is first on page one without duplicating it on
later pages. Search, category, audience, publication consent and expiry still
apply; this does not insert a business into unrelated categories. My listings,
applications and the legacy account-preview feed are unchanged.

No listing, role, approval or price is modified. The configuration table denies
all client access and has no resident write RPC. The existing authorized feed
reads priority internally and returns its existing response shape; no pin marker
is exposed to the interface.

Preparation and source review only: the SQL has not been executed locally or
against a live database. Owner checks remain for UUID selection, migration,
permissions, first position under each sort, filtering, pagination, and expiry.
