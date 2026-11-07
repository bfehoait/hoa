# Design system

## Visual navigation — 5 November 2026

The user requested clearer visual interaction patterns before role/permission implementation. Shared destination tiles, bordered icon navigation, explicit back/actions, category filters and progressive disclosure are defined in `components/Navigation.tsx` and its CSS Module. Services and More use grouped task discovery instead of wrapped text-only route strips. Secondary actions now have stronger visible borders. Directory facts are compact and full content remains available in details. See [[User experience]] and [[Verification]]. The burgundy palette remains current.

## Current palette — 5 November 2026

The user requested the burgundy/rose/neutral palette shown in their screenshot. Primary brand and light-mode actions are `#8b002b`, with `#6b0021` pressed states, `#f7edf0` soft rose selections, white surfaces and `#faf9fa` page backgrounds. Text is charcoal with warm gray secondary text. This is a screenshot-inspired local preview palette, not a verified official brand specification.

Dark mode pairs plum-charcoal surfaces with rose `#f0a8c1` interactive accents. The balance cards retain burgundy with white text in both themes. Success remains teal/green, warnings amber and errors red, with textual labels. Shared tokens now use `--accent-soft` and `--accent-line` instead of color-named blue tokens; hover, chart, overlay and divider colors are also tokenized.

The user-approved geometry, typography, controls and navigation are preserved. The project-owned SVG logos, raster app icons, HTML theme color and PWA manifest use the new palette. `scripts/generate-icons.mjs` regenerates PNG icons from the owned SVGs without source-reference assets.

New palette screenshots are prefixed `palette-` under `docs/previews`. Historical blue captures and pixel baselines remain comparison evidence. `node scripts/check-desktop.mjs --layout-only` checks current geometry without asserting pixel equality with the earlier palette; it does not reset that baseline. `node scripts/check-palette.mjs` checks representative screens, validation dialogs and semantic-token contrast in both themes and widths. See [[Verification]] for actual results.

## Earlier design direction

**Observed** — Redesigned following the user’s GCash/HOAS mobile-app references: a blue household balance card, self-hosted Manrope typography, eight icon shortcuts, compact announcements and activity, and a five-item thumb-friendly navigation bar. White surfaces, cool neutral backgrounds and restrained outlines carry the rest of the app. This is a proposed Bellefort preview identity, not official HOA branding or a copy of either service’s interface.

`styles/tokens.css` defines semantic light/dark colours; text sizes 12/14/16/18/24/32/48 (rendered interface text is at least 14); spacing 4/8/12/16/24/32/48; radii 8/16; two shadows. Numeric displays use tabular figures. Icons use Lucide or small code-owned SVGs with a consistent stroke. No stock or generated imagery is included.

Owned components: Button, ButtonLink, Badge, Row, Field, Modal, PageIntro, SectionTitle, Feedback, Skeleton and Empty. Actions carry one of four tones and weight states intent: primary is the single thing a screen is for, secondary supports it, danger ends a session or destroys a record, and quiet is an inline low-stakes step. ButtonLink gives a destination the same shape, so a link that acts like a button no longer needs per-screen styling. Every tone and size keeps a 48px target; a small action reduces padding and type only. Dialogs take an optional footer outside the scroll area, and a .form-actions row inside a dialog body is pinned at every width, so a confirm step cannot scroll out of reach. A dialog takes focus on its container rather than its close button. States include visible focus, hover on hover-capable devices, pressed movement and background feedback, disabled, pending, validation failure, confirmed local result and persistence error. Dialogs use native dialog semantics, named headings, focus wrapping, Escape, and trigger focus restoration.

**Observed** — Desktop uses a sidebar and wider account panels; mobile uses five bottom destinations and safe-area padding. Mobile sidebar is removed from layout and focus order. The home shortcut grid is specifically requested by the latest reference-led direction. Unknown credit/deposit amounts are not invented; the secondary summary shows sample recorded-payment totals. Long forms and payment availability open as mobile sheets. User-controlled dark mode, balance hiding, and reduced-motion settings are supported.

**Unknown** — Official colours/logo, human translation needs, actual resident comprehension and real-device usability. See [[Verification]].

## Desktop refinement — 4 November 2026

**Observed** — Following the user’s desktop screenshot, the overview now has a compact account summary and payment strip on the left, with the eight services grouped on the right. Updates/activity follow immediately below. At narrower desktop/tablet widths the groups stack without squeezing their controls. Desktop shell rules reduce the header, sidebar branding and redundant property labels; sidebar overflow remains available as a fallback on unusually short screens rather than hiding inaccessible links.

**Observed** — All layout changes are scoped to widths of at least 768px. Four before/after mobile screenshot hashes match exactly (360×900 and 390×844, both themes). Desktop checks include the effective 1536×740 layout at 1.25 device scaling, corresponding closely to the user’s screenshot. See [[Verification]].

## Whole-system visual plan

**Planned** — [[Screen and interaction plan]] maps the remaining screens to meaningful visual patterns: work queues, exact-value dashboards, timelines, evidence checklists, availability calendars, money breakdowns and protected file libraries. These components and screens are proposed, not already implemented. Preserve the approved mobile and compact desktop baselines as modules are added.

Replace introductory or placeholder essays with a concise state, relevant information and the next allowed action where possible. Keep actual notices, decisions, policy text and essential explanations readable. Do not invent counts, images, amounts or schedules to make a visual look populated. Use synthetic fixtures explicitly in previews, and accessible exact values/table alternatives alongside charts.


## Accounts and QA follow-up

Aging uses an ordered burgundy ramp: current, mid, late, oldest. Light: #deb4c3, #be7d96, #984664, #6b002b. Dark: #f1cfde, #d99db6, #b9688d, #91365e. Increasing age decreases Lab lightness; direct age/amount labels remain. Palette tests check adjacent lightness and CIE76 separation under normal vision and full-severity protanopia/deuteranopia/tritanopia simulation. This is a regression guard, not accessibility certification. Collection percentage uses a labelled meter and exact received/outstanding values.


## Direct navigation and financial reporting

Mobile keeps the established bottom navigation and More page, without a new navigation modal. Secondary Finance navigation uses compact, labelled 48px tabs. Reports use three compact exact-value totals on mobile, directly labelled monthly bars and an expandable table. The selected navigation item is the most specific visible destination, so Finance and its Reports child are not highlighted together.
