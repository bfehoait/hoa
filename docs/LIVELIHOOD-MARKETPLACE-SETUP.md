# Livelihood marketplace

The connected customer Livelihood page combines Local businesses, Buy & sell, Jobs & referrals, Garage sales, Booth events and Training & workshops in one photo grid. My applications sits beside My listings; the old Learning URL redirects into Livelihood. It includes submitted search, type/category filters, newest/price sorting, paginated results and listing details. Missing photos and prices remain unavailable rather than being invented. My listings reuses the existing editing, photo and moderation workflow.

## Owner setup

The original feed requires 035 after 034. For the current six-category UI and approval outcomes, complete migrations through 040, then apply 041 through 044 in order as described in [Submission outcomes setup](SUBMISSION-OUTCOMES-SETUP.md). No Edge Function change is needed. Installation creates no listings.

The migration adds a published-view baseline for homeowner, renter, admin, board, security and driver roles only when an equivalent role rule does not exist. Existing role/user restrictions and action denials remain authoritative. The feed requires an active signed-in account and livelihood view permission; it is not an anonymous internet marketplace. Creation, approval and publication grants are unchanged. Post a listing is shown only for permitted listing types, and new listings follow office review.

Only consenting, published, unexpired posts matching the viewer's audience appear. The feed returns public title/detail and selected category, condition and asking-price fields. Private contact answers and owner identity are not returned. Photo access keeps existing private Storage policies; only deliberately shared contact links appear in listing details. There is no built-in checkout, payment confirmation, chat or favorites system.

Read-only account preview uses the existing audited per-type feed. Combined browsing, category filters and price sorting require signing in directly. Synthetic preview records remain separate from connected data.

## Original 035 verification (historical)

Current verification and owner checks are recorded in [Submission outcomes setup](SUBMISSION-OUTCOMES-SETUP.md).

Frontend TypeScript passed. An isolated PGlite runtime check with synthetic rows and stubbed identity/permission helpers checked published/consent/expiry/audience filtering, public-field projection and search, type/category filtering, ascending/descending numeric price order, preservation of an existing role rule, 23 unique visible records across 20 + 3 rows, and denied permission returning 42501. These checks do not verify deployed permission helpers or Storage integration.

Owner browser checks remain: apply 035, use a direct resident sign-in, check mobile grid and listing details, verify permitted posting and My listings, and verify explicit access restrictions. No live SQL, deployment, automated browser runs or screenshots were performed.
