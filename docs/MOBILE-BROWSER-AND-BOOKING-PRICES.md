# Mobile browser fixes and PDF booking prices

Update, 15 November 2026: the owner has authorized confirming and posting a booking fee together with booking approval. Migration 083 and `docs/BOOKING-APPROVAL-CHARGES.md` supersede the separate Finance-post step described below for that action. Estimates still do not create charges on submission; approved fee confirmation does, without recording a payment.

15 November 2026. Local implementation; no live database or hosting changes.

## Mobile behavior

`MobileViewport` runs once above the app and supplies shared visible-height and keyboard-inset variables to dialogs and the Helpdesk reply composer. It listens to visual-viewport resize/scroll, window resize, orientation and focus changes, and cleans up listeners. Keyboard detection requires an editable control and a substantial viewport reduction; pinch zoom is not classified as a keyboard. Bottom app navigation hides while the keyboard is detected, and returns when it closes. The reply composer uses the same inset and no longer reserves bottom navigation space while typing.

Phone sheets use the available height, keep their body scrollable and keep footer actions side by side when typing. Mobile native-dialog body locking also preserves/restores the original page scroll and body styles, including nested dialogs. Native dialog focus, Escape/cancel, dirty-form protection, busy guards and focus restoration remain. No zoom prevention or new animation was added.

An app inside a GHL iframe cannot measure the outer browser's visual viewport accurately. If direct Vercel works but the GHL embed still clips the keyboard/dialog, the owner can apply [the prepared host-side helper](setup/ghl-mobile-viewport.html) to the **existing** portal iframe. It changes only iframe sizing; it does not read accounts, cross origins, or alter authentication. Existing GHL wrappers/headers must also fit. This helper has not been installed or browser-verified; it is not required on the direct app URL.

## Prices: PDF only

Source: owner-supplied **BFE Amenities Guidelines, as of 21 October 2025**, pages 1–3. No outside rates, taxes, discounts, daily prices, child-price age band, rounding rule or deposit interpretation was added.

The new booking-use selection distinguishes Hall, Court sports, Court special function, Pool exclusive and Pool individual admission. Individual admission asks for adults/children; attendees are their sum. A read-only server RPC returns the estimate before submission. Submission requires the estimate to load, while the server independently recalculates it and retains the original booking services' permission, member eligibility, idempotency, availability, capacity, overlap and Pending-status checks.

Migration **082**, after 081, creates protected booking-price snapshots and guarded RPCs. Saving the booking and its price choices is one transaction. The client never sends a price amount. A retry cannot change saved price choices. Residents can read their own authorized booking estimate; Office readers need the existing calendar association-view permission. Direct table access is revoked and RLS enabled. These functions do not grant roles or post charges/payments.

Supported exact rental calculations:

- Hall: 2 daytime hours PHP 1,000; 9 daytime hours PHP 3,500; 2 full nighttime hours PHP 1,500; 5 full nighttime hours PHP 3,000. Daytime ends by 5 PM; the full night window is 5–10 PM and includes the PDF's 5:01 PM boundary. Mixed periods and other package/extension combinations need Office confirmation.
- Pool exclusive: exact 8-hour daytime package PHP 5,000. The 5-hour night package PHP 4,000 and extension PHP 1,000/hour are shown, but not forced into the shorter full-night window or substituted into mixed periods.
- Pool individual: within the PDF daytime window, adults PHP 100 and children PHP 80; within the full nighttime window, adults PHP 120 and children PHP 100. Sunday times before 9 AM and mixed periods need confirmation. Child-rate eligibility is explicitly subject to Office verification; supervision age is not treated as a pricing age band.
- Court: published sports hourly rates PHP 250/300 and special-function rates PHP 350/400 are shown. The PDF does not define the court day/night cutoff or partial-hour rules, so no exact rental total is inferred. Its conditional free sports use remains an Office eligibility decision.

The listed PHP 2,500 reservation fee for Hall/Pool exclusive is not automatically added to rental: the PDF does not say whether it is credited. The PHP 2,500 refundable bond is shown separately where applicable, with rental-plus-bond subtotal when both are known. Final totals requiring an interpretation say **Office confirmation needed**. Calculated individual-admission estimates show their amount. Existing charge/payment confirmation remains separate.

Saved estimates appear in resident and Office booking details, inline Office approvals and Office calendar details. Existing bookings without a snapshot are labelled as earlier bookings needing a confirmed fee; no historical price is fabricated. Existing confirmed charge, payment and Other/Total balance behavior stays unchanged. Office continues its approved-booking → fee review → accounting posting process.

## Review before sending and the original PDF

The composer now uses **Review price & booking** as its first action. That validates the completed form and opens a read-only review sheet with the selected amenity, schedule, attendee count, purpose and the complete current server estimate. **Request booking** on that sheet is the only UI action that sends the Pending request. **Back to edit** preserves the form. The final submit checks that the form values and displayed quote still match the reviewed snapshot; a changed selection/quote requires another review. This step does not represent Office approval or payment confirmation, and does not introduce a new policy-consent requirement.

The owner-supplied three-page PDF is copied unchanged to `public/documents/bfe-amenities-guidelines-2025-10-21.pdf`. Its SHA-256 matches the supplied original. It contains no author metadata or annotations. The Amenities form, rate/rule disclosure and review sheet show its 21 October 2025 date with View PDF and Download PDF actions. View opens a shared in-app sheet with page navigation, fit-width/zoom and readable page text. A lazy-loaded local PDF.js renderer avoids depending on Android/iOS native embedded PDF support. The public PDF and renderer worker are included in the PWA precache. Private document-library attachments reuse this viewer and obtain a fresh authorized signed URL before fetching a temporary in-memory blob with no-store; they are not added to offline caches. Future uploaded PDFs inherit these actions through DocumentAttachment. No third-party viewer service or altered PDF content was added.

The time buttons now stay in End mode after choosing an end time, so choosing a later button extends the current booking instead of starting another range. The summary shows hours/minutes. Configured slot increments, maximum duration, operating hours and overlap checks remain unchanged.

This follow-up requires a frontend/PWA update only. There is no additional SQL after 082 and no BFE redeployment. Owner browser checks: the first action must open review without saving a booking; the final action sends exactly once through the original idempotent booking flow; Back retains fields; invalid or changed inputs cannot bypass review; the PDF opens in browser/installed mode, including after the updated PWA has cached it.

## What remains deliberately unchanged

- One booking remains one calendar date. The PDF provides no three-day/overnight package. No unsupported multi-day rate or overnight reservation was introduced.
- Current configured slot size, maximum duration and renter eligibility still apply. A facility configured for four hours will not suddenly permit a nine-hour package. Office must review its setup against the PDF through the existing configuration workflow; no configuration, history or future booking is silently changed.
- Unclear fees need Office confirmation; estimates do not make a booking approved, paid or an account debt.
- Older clients can still use the original booking RPCs; their bookings will have no new price snapshot. Deploy the matching frontend for the new pricing flow.

## Rollout and owner verification

1. Run **082** in Supabase SQL Editor after 081. Do not replay older migrations. No BFE/create-account Edge Function redeployment is required.
2. Deploy the frontend. Accept the app update/reload so browser and installed clients use the new version. Do not clear signed-in storage as a routine update step.
3. Check direct Vercel and the GHL `/portal` page separately. Apply the prepared GHL helper only if the embed needs it; no live hosting change was made here.
4. On real Android Chrome and iPhone Safari, plus installed mode: open/close the keyboard in registration, search, Helpdesk reply, visitor pass, booking and listing forms. Confirm visible fields/actions, restored navigation, dialog body scrolling, unchanged input and page position after dismissal, device Back/dirty confirmation, and rotation with/without keyboard. Desktop emulation does not verify a real OS keyboard.
5. Request a clearly labelled synthetic Hall 2-hour booking and Pool individual admission. Check the before-submit estimate and the same saved values in Office approvals and calendar details. Check an unclear court/package case shows published rates and confirmation-needed labels, never a fabricated total.
6. Verify invalid guest counts, closed hours, unavailable times, unauthorized readers, duplicate submission and changed retry choices are rejected. A pending request must not increase Other/Total balance. The existing authorized accounting posting flow must still create the confirmed charge.
7. Review facility duration configuration if the PDF's longer packages are unavailable; do not bypass unresolved future-booking protections.

Local checks: TypeScript, production build, targeted lint and whitespace review. An isolated synthetic PGlite check compiled the actual 082 migration and exercised its calculator and quote RPC: Hall 2-hour daytime rental PHP 1,000, Hall 5-hour full-night rental PHP 3,000, pool admission for two adults and one child PHP 280, and an unresolved court total remained null. Auth/permission helpers and the original booking creators were stubbed for this isolated check; it does not prove live permissions, concurrency or real booking submission. No automated suites/E2E/axe, live SQL or physical-device verification was run. The owner must apply and verify SQL before production use.
