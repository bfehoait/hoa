# Numbered shuttle stops

The customer shuttle screen now uses the owner's twelve numbered stops, labeled 1st stop through 12th stop. The passenger selects a pickup, then a different destination. After selection, the stop grid collapses into a trip summary; either endpoint can be reopened. The request button sits inside the trip card. The confirmation form carries those choices and asks for the passenger count.

The existing shuttle request RPC receives these labels through its existing pickup/destination text fields. No database migration, official stop coordinates, route geometry, fares, schedules, ETA, seat allocation or ticket issuance is introduced. The numbered list is frontend-owned for this pass; it is not a new server-enforced stop registry. Historical free-text requests remain readable. Admin configuration of physical stop locations can follow separately.

Carpooling remains under More → Around the community, as clarified by the owner. The shuttle's carpool cross-link and Area map section are removed. The separate carpool module and backend records are retained; this is navigation/layout work, not data deletion.

Existing availability, active-request, prior-day and read-only guards remain. The trip card explains blocked requests. Server acceptance and driver status remain authoritative. No map is displayed on Shuttle.

Verification: TypeScript and scoped whitespace checks passed. Isolated synthetic Chromium checks at 360px, 390px and 1440px covered choosing stops, preventing identical endpoints, carrying values to confirmation, unavailable-shuttle and read-only guards, and absence of the Carpooling link from More. No page exceptions or whole-document overflow were recorded. Phone trip and confirmation screenshots were inspected. All external network requests were intercepted or blocked; no live request was submitted. Physical-device behavior and actual driver receipt of the numbered labels remain for owner verification.
