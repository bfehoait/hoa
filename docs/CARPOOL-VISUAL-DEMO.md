# Carpool visual demo

Customer More → Around the community → Carpooling opens a local interactive demo using MapLibre GL JS. It uses fictional GeoJSON streets and coordinates, not real Bellefort/Bacoor roads. No API key, hosted tile service, GPS access, geocoding, routing or map-provider quota is needed. The renderer and worker are bundled locally; the map component is lazy-loaded.

The UI offers Find a ride / Offer a ride, sample pickup and destination, swap, date/time and seats. Sample results open a ride detail and simulated request to join. Offers and join confirmations exist in component state only; there is no live post, driver contact, seat reservation, payment or actual ETA. Refresh clears the demo. Existing permission gates for the carpool destination remain. Review/admin routes retain their existing workflows.

Mobile stacks the map above a rounded trip panel; desktop uses map and trip panel side by side. Required synthetic labels and fictional-map attribution stay visible. Text location selection remains usable if map graphics fail.

MapLibre dependency installation completed after retrying the initial restricted-network/cache failure with the workspace cache. npm reported 15 dependency audit findings (2 low, 13 moderate); no audit fix or forced dependency upgrade was performed as part of this feature. These counts are not an attribution of findings to MapLibre alone.

Verification: TypeScript and production build passed; isolated synthetic Chromium at 390px and 1440px rendered the canvas, exercised find, simulated join and simulated offer, and recorded no page exceptions or whole-document overflow. Phone capture visually inspected. An initial MapLibre worker failure was fixed by using Vite's bundled worker URL, and the repeated walkthrough rendered the map. No live backend mutation or external map requests occurred. Physical-device/WebGL fallback and deployed CSP behavior require owner verification. This demo does not establish real-world map coverage or routing accuracy.

The production build warns about large chunks: the lazy map renderer is approximately 1.08 MB minified / 296 KB gzip, plus a roughly 518 KB worker. PWA precaching includes build assets, so lazy loading does not eliminate the installed cache footprint. Review download/cache policy before expanding mapping beyond this demo. Rollup also reported removable annotation warnings from zod; build completed successfully. No deployment was performed.
