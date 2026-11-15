# Shared loading states

The shared `Skeleton` in `components/UI.tsx` now provides page, section and inline metric variants. Existing route Suspense fallbacks and initial query loaders inherit the visible token-based shapes across resident, Office, Developer, Board, Security and Transport screens. Section loaders cover documents, PDFs, booking fees/quotes/availability, resident lookup, assignments and lazy maps. Metric loaders cover balances, dashboard counts, finance totals and property-link lookups.

Shapes use the app surface/line tokens, adapt to narrow screens, announce a concise loading label and stop animation when reduced motion is requested. Inline placeholders contain only spans so they remain valid within balance and metric text. Skeletons represent pending reads, never confirmed amounts or approval outcomes. Disabled or unavailable services retain their existing availability and permission handling.

Existing cached query content remains rendered during ordinary background refreshes; no query keys, cache lifetimes, polling, permissions, RPCs or routing were changed. Price recalculation still hides an earlier quote until the selected booking inputs have been checked. Submit/save/download controls retain their pending/disabled behavior. No artificial loading delay was added, so fast cached screens can render immediately.

Owner browser verification: test an uncached route with a slow connection in each role, then revisit it with cached data; confirm loading resolves to content, empty state or error; check light/dark, phone/desktop and reduced motion. Verify booking price confirmation remains disabled during recalculation. No automated suites, live database operations or browser/device checks were performed. Frontend deployment only; no new SQL or BFE redeployment.

## Shared image loading (15 November 2026)

LoadingImage now wraps every rendered img in the frontend: branding/sign-in, uploaded-cover previews, and the shared ListingMedia path used by homeowner Home, Livelihood, announcement feeds and staff/detail screens. A token-based shimmer reserves the image dimensions through loading; the image fades in after its load event. Errors show an accessible fallback. Reduced motion uses a static placeholder with no reveal transition. ListingMedia also uses an image-shaped skeleton during metadata lookup. Existing image fitting/theme selectors now target the frame as well as the image to preserve sizes, logo variants and carousel layouts.

Signed covers still pass their expiry to the shared component: src is assigned only after the existing lifetime check. Signing/authorization, upload validation, original lazy/eager choices and carousel preloading remain. No artificial loading delay was introduced. PDF canvas rendering and map tiles retain their existing loaders.

Owner browser checks: throttle the network and clear cached images; verify skeleton-to-image reveal on homeowner Home, Livelihood, announcements, staff screens, upload preview and login logos. Check light/dark logo variants, mobile/desktop, reduced motion, missing/broken images, signed-image refresh, carousel tab returns and text-only announcements. Check for layout shifts and correct fitting. No browser/E2E checks are claimed locally.
