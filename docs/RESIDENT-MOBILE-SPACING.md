# Resident mobile spacing

At widths up to 767px, the resident shell defines a 16px section gap, a 12px
card/form gap and 12px shared card padding. Component adjustments are scoped to
`data-customer-ui="true"`; desktop and staff screens retain their spacing.

Home removes the hotline section's extra margins within the section grid, so
announcement controls, hotlines and community links no longer accumulate grid
gaps plus independent section margins. Carousels retain their existing sizing,
manual swipe/autoplay behavior and accessible controls.

The same spacing rhythm is applied to Account records and payment cards,
Services groups, Helpdesk filters/forms/messages, amenity booking steps and time
choices, Livelihood applications and shared connected modules, More groups,
the hotline directory, Shuttle, Carpool, property/receipt panels and community
pages. Shared destination rows and resident dialog bodies also use less padding.
Livelihood Browse keeps its existing compact grid and curved search layout.

Text sizes, 48px minimum controls, keyboard focus, safe areas, booking-calendar
hit areas and bottom navigation remain. This pass does not change queries,
validation, permissions, destinations, submitted values or backend state.

Validation: production build with TypeScript and PWA generation passed; CSS
formatting and `git diff --check` passed. Source inspection confirmed all 20
component spacing blocks are limited to the resident phone breakpoint and the
compiled stylesheet retains the shared spacing tokens. Existing dependency
annotation and large map-chunk build warnings remain.

Owner browser verification remains at 320/360/390px, light and dark: visit each
main tab and its detail/forms; check long text and empty/error/loading states;
confirm no content is clipped, controls remain reachable above the bottom nav
and onscreen keyboard, carousel navigation works, and desktop spacing is intact.
No automated suites, browser run, SQL or live backend verification was performed.
