# Performance first pass — 13 November 2026

Implemented locally at the owner's request after the source assessment. No deployment, publication, SQL, live database connection, package installation or framework change.

## Startup loading

The root App now selects a lightweight public-access branch or a protected application branch. Sign-in, registration, recovery, reset and sign-out can load without the signed-in shell, preview screens or resident dashboard. Registration and synthetic preview access are separately lazy-loaded. AppShell holds the existing signed-in routes/navigation; Home and ConnectedHome are lazy within it. Public route title/scroll behavior is retained.

ProtectedApplication retains the previous AuthGate arrangement, including the outer developer gate and inner target gate for authorized account preview, separate synthetic-role identity, and the workspace redirect. AuthProvider, AuthGate, server authorization, membership/permission polling and account cache clearing were not changed. A TypeScript-AST comparison confirmed that the moved shell and helper function bodies match their previous versions.

Comparable before/after production builds are under ignored `.artifacts/performance-before` and `.artifacts/performance-after`. These are build-analysis outputs, not deployments. Measurements are local generated assets and calculated gzip sizes; they are not phone timings or observed hosting transfer sizes.

| Measurement | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| JavaScript directly referenced/preloaded by initial HTML | 826 KB | 652 KB | About 21% less before compression |
| Same initial JavaScript, calculated gzip | 248 KB | 192 KB | About 22% less |
| CSS directly referenced by initial HTML | 108 KB | 33 KB | Additional route CSS loads when needed |
| Complete sign-in JavaScript dependency set | 874 KB | About 666 KB | About 24% less before compression |
| Complete sign-in JavaScript, calculated gzip | 266 KB | About 199 KB | About 25% less |
| Resident Home JavaScript dependency set | 826 KB | About 816 KB | Roughly unchanged; no major Home cold-load saving claimed |

The route sets include their required static dependencies and the explicitly activated lazy route modules. They exclude runtime API responses, images, fonts and browser/service-worker cache effects. Home's calculated gzip is slightly larger (approximately 253 KB versus 248 KB), with more smaller module requests. The split primarily improves public-route loading and defers unrelated code. The full application's generated size has not been reduced; code splitting is not deletion of features. Larger map/worker assets remain deferred. Actual performance on HTTP/2/mobile networks needs browser measurement.

## Return-navigation caching

Only suitable presentation reads received short freshness windows:

- Own profile: 60 seconds, retaining existing save invalidation and focus behavior.
- Published feature feeds: 15 seconds; non-published review/own workflows retain immediate staleness.
- Resident Helpdesk lists: 10 seconds; Office request lists retain immediate staleness.
- Home booking summary: 10 seconds with 60 seconds of inactive cache retention.

Existing 30-second polling on feeds/requests/bookings remains. Freshness avoids an extra mount refetch during short return visits; it does not disable scheduled polling. Existing mutation invalidation still refreshes changed records. No persistent browser cache was introduced. Financial reads, approval checks, notifications and membership/permission refresh intervals remain as before. Financial correctness is not traded for a blanket global cache policy.

## Announcement images

The carousel keeps slide layout/text but enables ListingMedia reads only for the current and next slide. Other slides do not initiate new media reads or poll while inactive. An already-started request may finish. With four image-bearing announcements, initial carousel media authorization/signing requests fall from up to eight to up to four, excluding the announcement feed and image-byte requests. Rotating through all four still loads those images eventually; this is not a guarantee of a 50% saving over a whole session.

Fresh reactivation reuses a signed cover for up to 45 seconds, capped by the remaining original URL lifetime with a 15-second safety margin. Renewal still performs the existing metadata authorization followed by signing; those operations deliberately remain coupled. The signed URL lifetime stays 60 seconds. Media cache is not persisted and retains zero inactive-observer garbage-collection time. The current/next mounted observers can retain their existing result between active periods.

SignedCoverImage checks expiry in a layout effect before assigning the external image resource. It hides/removes an expired URL while authorized renewal is pending. The clock check runs outside render; no impure render-time clock call is needed. Existing preload/decode behavior remains for current/next covers, with native asynchronous decoding. Uploads, publication approval, private Storage policy and target-scoped account-preview authorization remain unchanged.

## Checks and owner verification

Executed: frontend TypeScript, production comparison builds, targeted ESLint for changed TS/TSX modules, source review, shell-body AST comparison, `git diff --check` and an isolated synthetic TanStack Query observer check. The observer check verified disabled reads, fresh reactivation reuse and mutation invalidation for active/inactive observers without network calls. It is not a browser or end-to-end result. Build retains existing Zod annotation warnings and a large map-chunk warning.

No automated suite, E2E, axe sweep or browser performance run was performed. Owner should verify:

1. Direct sign-in/register/recover/reset/sign-out and bookmarked protected routes; public scroll/title behavior.
2. Resident, Office, board, driver/security navigation, unauthorized refusal and both developer preview modes.
3. Profile edits and request/booking mutations refresh immediately; unrelated accounts never receive cached data.
4. Four-image carousel initial load, dots/swipe/previous/next/pause, slow image loading, return after more than 60 seconds, failed/expired URLs and opening full announcement details. Verify unpublishing/removing a cover and permission loss.
5. Financial balances and approval decisions retain their existing refresh/authority behavior.
6. Mobile Network/Performance measurements with cold/warm cache, and direct app versus the embedded portal. Compare sign-in/Home readiness, request counts, image bytes and interaction responsiveness before claiming a user-visible speedup.

Publish through the normal owner-authorized frontend release process only after browser acceptance. No new migration or account Edge deployment is required for this performance pass. Existing unrelated CORS changes are preserved.
