# Bellefort design system

The portal adopts the quiet surfaces, restrained typography and clear hierarchy of the supplied Apple design analysis, adapted to Bellefort's burgundy identity and transactional workflows. This is a shared frontend design foundation for customer and staff screens, not a reproduction of Apple's marketing pages.

## Visual foundation

- Use existing Manrope Variable for body text, controls and record labels. Customer page and section headings use the browser's Georgia/serif stack to echo the Bellefort wordmark; staff headings remain Manrope. No font download is required. Body remains 16px and supporting text at least 14px. Amounts and record identifiers retain their numeric treatment.
- Burgundy is the primary action color. Neutral off-white canvas, white surfaces and subtle borders separate content. The existing dark theme uses corresponding dark surfaces and a lighter accessible accent. Success, warning and destructive colors retain their meanings and visible text.
- Customer corners use 12px controls, 16px grouped surfaces and 22px hero surfaces; customer actions have rounded rectangular controls. Staff screens retain the existing 18px cards, 24px hero surfaces and capsule actions. Filter chips and avatars keep their purposeful circular/capsule shapes.
- Ordinary cards have no decorative shadow. Dialogs and floating install prompts retain elevation to separate them from content. Published announcements, amenity photos and listing covers carry visual interest; forms and financial screens do not require decorative photography.
- Spacing follows the existing 4/8/12/16/24/32/48px rhythm. Customer screens can be spacious; staff records remain compact and scannable. Do not insert marketing-size full-screen tiles into task workflows.

## Shared interactions

- Primary, secondary, quiet and destructive actions share visible focus and a minimum 48px target. Customer actions use the shared control radius; staff actions retain capsules. Destructive actions retain their distinct semantic treatment.
- Native text inputs, selects and textareas have a low-specificity baseline so dialogs and less-styled forms no longer fall back to browser-default geometry. Scoped search and specialist controls can override layout. Preserve visible labels, aria-invalid borders, error messages and disabled state feedback.
- Customer navigation stays Home, Account, Livelihood, Services and More. Mobile navigation uses a near-opaque surface with optional backdrop blur and a reduced-transparency fallback. Staff navigation remains a desktop sidebar and responsive mobile navigation.
- Dialogs retain focus management, Escape/close controls, scrollable content and reachable actions. Short choices use sheets; integrated customer tasks and record details use a full-screen presentation on phones. Opted-in task forms confirm dismissal after input changes. Do not replace these with image-led overlays.
- Loading, empty, error and success states remain meaningful. Keep synthetic labels and unknown-value messages. A visual treatment must never imply that a local action has been confirmed by the HOA.
- Reduced-motion behavior and safe-area support remain active. Hover feedback is supplementary; core actions work with keyboard and touch.

## Implementation and review

The foundation lives in `apps/web/src/styles/tokens.css`, `global.css`, shared UI and navigation CSS. The customer layer in `styles/customer.css` scopes warm surfaces, heading typography and interaction states to `[data-customer-ui="true"]`, with corresponding dark values. Existing workflows, data permissions and backend migrations are unchanged. Page navigation uses a cancellable 220ms opacity/6px translation without remounting content; press feedback is brief, and reduced motion disables the added effects.

The current customer refresh is documented in [Customer design refresh](CUSTOMER-DESIGN-REFRESH.md). The foundation-pass counts below describe earlier work, rather than current verification of every state.

The follow-up page pass aligns 30 scoped form-control rules, 21 card-padding declarations and 27 section-heading declarations across 38 CSS modules. Cards use 24px padding on larger screens and 20px on phones. Section headings use 20px on larger screens and 18px on phones. Controls retain 16px text, and previously faint input borders use the stronger control boundary. The access screen has a framed card treatment; More uses compact grouped tiles and utility rows. Financial filter and payment actions share the capsule grammar. Existing photographic cards, record tables and application-specific information hierarchy remain purposeful rather than being forced into one layout.

Verification for the foundation pass: frontend TypeScript, CSS parsing and a targeted palette contrast calculation. The subsequent [customer UI implementation](CUSTOMER-UI-IMPLEMENTATION.md) replaces the More category strip with compact grouped tiles/rows and records the controlled synthetic browser review. Physical devices, live roles and accessibility checks still require verification. CSS modules retain purposeful component-specific geometry.
