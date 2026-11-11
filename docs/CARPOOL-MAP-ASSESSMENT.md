# Carpool map assessment — 9 November 2026

Scope: assessment only for a separate community carpool feature inspired by the supplied map-and-trip-sheet reference. No map SDK, external account, API key, geolocation collection, matching service or booking backend was installed. Carpooling belongs under More → Around the community. Shuttle remains the twelve-stop HOA service and has no map or carpool cross-link.

## Map choice

Map appearance is a combination of renderer, basemap data and style, plus the application's own controls. Leaflet is a rendering library and OpenStreetMap is map data; neither dictates the default visual appearance. Avoiding the default OSM appearance does not require rejecting OSM-derived data. If the requirement is no OSM-derived data at all, review each provider's source attribution before selection.

| Candidate | Current free allowance / restriction | Assessment |
| --- | --- | --- |
| Mapbox GL JS | Pricing lists 50,000 map loads/month free, then usage charges. Directions and search are separately metered products | Preferred visual prototype candidate: custom map styling with a Bellefort trip sheet and pins. Evaluate Philippine pickup/address coverage before committing |
| MapLibre GL JS + Geoapify | MapLibre is an open-source renderer; map hosting is separate. Geoapify lists 3,000 credits/day, no card required, commercial production allowed with required attribution and within limits | Preferred candidate when avoiding billing enrollment is the priority. Credits are not equivalent to map loads; tile, routing and search consumption must be estimated together |
| MapTiler | Free plan terms restrict use to non-commercial or commercial R&D | Suitable for eligible prototyping; do not assume the free plan covers the production HOA portal |

These are free tiers or free software, not unlimited free hosted mapping. Compare actual request budgets and account terms before integration. MapLibre by itself supplies neither a hosted basemap nor address search nor routing. Required attribution must stay visible beneath the custom UI.

Official sources checked:

- [Mapbox pricing](https://www.mapbox.com/pricing) — map-load allowance and separate routing/search products.
- [Geoapify pricing](https://www.geoapify.com/pricing/) — daily credits, rate limits, production/commercial terms and attribution.
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/) — renderer scope.
- [MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/) — free-plan eligibility.

## Proposed first version

Mobile uses a quiet map behind a persistent trip panel. The panel switches between Find a ride and Offer a ride, then collects pickup, destination, departure date/time and seats. Desktop uses a side panel with the map beside it. Provide an equivalent list of offers, and text/place selection when location permission is denied; do not force GPS or map dragging.

Find results should show departure time, pickup area, destination and offered seats. A ride detail exposes the meeting point and permitted driver/contact details at the appropriate stage. Initially use request-to-join and driver acceptance rather than implying a confirmed seat immediately. Existing listing publication and approval are not seat reservation or ride acceptance.

Necessary backend work before real bookings includes offer ownership, trip capacity, atomic seat reservation, request/accept/reject/cancel states, stale/expired-trip handling, audit and permission checks. Precise private pickup coordinates and contact details must not be broadcast in the public browse feed. Location collection should be explicit and limited to the task. Map search does not provide carpool matching or driver tracking automatically.

Do not add cash payment, fixed fares, a payment percentage, QR tickets, realtime vehicle positions or guaranteed ETA simply because the reference image contains them. Association policy and functioning server services must establish those features first. Scheduled community carpool offers are a smaller and more appropriate first release than an Uber-style on-demand dispatch product.

Before selecting a provider, compare a small set of known Bellefort/Bacoor pickup points, gate access and destination searches, estimate daily usage and verify attribution placement. No actual coverage comparison has been performed yet. Final recommendation is provisional: Mapbox for styling and a map-load free allowance; MapLibre + Geoapify for an explicitly no-card free-tier starting point.
