# Independent review of the button and dialog changes

Reviewed 7 November 2026. Local source and synthetic browser fixtures only; no live service connection or real account changes.

## Finding: authenticated form actions still scroll out of view

The shared dialog CSS pins actions passed through `Modal.footer` or placed in `.form-actions`. It does not automatically pin every dialog's buttons.

- `apps/web/src/features/connected/OperationsDesk.tsx:530` uses `schedule.footer`. Its CSS is a static flex row in `BookingSchedule.module.css:134`, so booking/visitor submission actions remain inside the scrolling body.
- `apps/web/src/features/connected/LiveFeature.tsx:424` renders the marketplace submission button directly inside its form, without either supported footer arrangement.

Reproduced in authenticated mode with a mocked Supabase API and an active synthetic homeowner. In an 800px-high Chromium viewport, after choosing a facility and date:

| Form | Width | Action top | Dialog bottom | Action visible without scrolling |
| --- | ---: | ---: | ---: | --- |
| Booking | 390 | 1642px | 800px | No |
| Booking | 1440 | 1230px | 752px | No |
| Business submission | 390 | 1044px | 801px | No |
| Business submission | 1440 | 966px | 753px | No |

Marketplace geometry was sampled during the short opening animation; its small positional offset does not affect the result. Screenshots and diagnostic tests are under `.artifacts/codex-review/`. These diagnostic tests record the current behavior; a passing diagnostic run is not a claim that the UI defect is fixed.

Recommended follow-up: wire these action rows into the existing shared footer contract, retaining valid form submission, pending states and keyboard behavior. The claim that all dialogs now have pinned confirmation controls is incomplete.

An additional visible polish issue remains in the booking selector: literal question marks separate the facility name, slot duration and opening hours. This is present in `OperationsDesk.tsx` and reproduced in the screenshot. Its introduction cannot be attributed to Claude without a before-change source snapshot.

## Changes confirmed in source

- Shared `ButtonTone` and `ButtonLink`, retaining the older `secondary` API.
- At least 48px shared button targets, including small variants; danger styling on sign-out links in the migrated screens.
- Dialog initial focus moves to the internal container; native modal behavior, Escape handling, body-scroll restoration and trigger-focus restoration remain implemented.
- Mobile handle is decorative; no dragging interaction is implemented.
- Global disclosure minimum height and four form-grid child-margin resets are present.

Recomputed the danger palette contrast from the actual CSS tokens: text is 5.81:1 in light mode and 7.50:1 in dark mode; borders against the surface are 3.75:1 and 3.65:1. These match Claude's documented measurements.

## Verification limits

There is no Git history in this local workspace to independently compare the before/after source. Claude's historical 57-to-62 comparison cannot establish that every remaining failure is stale or that no authenticated regression exists. Several reproduced failures are ambiguous test locators, but the remaining failures need individual assessment.

Examples: a preview test matches two status regions, and an authenticated module test matches two links named Incidents. Another authenticated test measures the drawer immediately after opening, while the new 180ms animation is running. A separate diagnostic confirmed the drawer reaches the expected top/right position once its animation finishes. Other authenticated tests reach a generic RPC mock assertion or an unmocked booking endpoint, so their failures are not proof that a save or permission operation is broken in production.

Typecheck, ESLint, all 257 unit tests across 21 files, and the production build passed independently. Browser-run outcomes are recorded in the verification vault after the runs finish. Application source and test expectations were not changed during this review.
