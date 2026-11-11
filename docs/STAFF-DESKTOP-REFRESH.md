# Staff desktop refresh

10 November 2026. Local implementation only; no publication or database changes.

## Scope

Office, Board, Security, Driver and Developer workspaces. New visual rules start at 1024 CSS pixels. Customer Home, homeowner/renter screens and their mobile layouts are excluded. Shared modules use the staff shell attribute before applying desktop overrides.

## Assessment and implementation

- Give the staff shell a consistent 240px sidebar, sticky header, readable centered content width and aligned page introductions.
- Use neutral panels for routine work; reserve burgundy for active navigation and primary actions. Keep the existing font system.
- Align table padding, filter panels, record lists, detail labels and section controls across connected workflows.
- Make Office overview categories easier to scan; hide the duplicate request visualization on desktop while retaining its mobile presentation.
- Improve People directory, lot register, finance reports, connected record screens, request desk and Developer maintenance cards through their existing components.

This is a shared desktop layout pass, not a replacement of every workflow or completion of unavailable backend services. Operational authority remains in existing protected server functions.

## State management

People search, search field, status and page now live in validated URL parameters. Typing stays local until search submission. Browser Back/Forward restores committed filters and pagination; changing filters closes the selected detail dialog. Member data continues to use identity-scoped TanStack Query keys, cancellation and existing cache clearing on account changes.

Successful Office booking actions now invalidate booking summaries as well as operation/availability queries. This runs only in the Office context. Existing announcement refresh behavior and authentication cache boundaries were reviewed; no global state library or customer state rewrite was added.

## Verification

- TypeScript check and production build passed. Existing large-chunk and dependency annotation build warnings remain.
- Isolated Chromium with intercepted synthetic responses: 22 staff routes at 1024×768, 1280×800 and 1920×1080 (66 renders). No document overflow, visible button/input/select targets below 48px, or JavaScript page errors detected by the targeted script.
- Focused follow-up: populated People and document screens at 1024 and 1280 after fixing synthetic response shapes; no unknown RPC fixtures or page errors in that run.
- People detail open/Escape, search submission, pagination Back/Forward and closing a stale selection passed at both widths.
- Homeowner shell checks at both desktop widths confirmed no staff attribute and no matching selectors from the new desktop stylesheet. Additional source review verified staff scoping of new shared-module overrides.
- Representative Office, People, Finance, Announcements, Board and Developer screenshots were visually inspected. Evidence stays in ignored `.private-imports/staff-desktop`; it contains synthetic data only.

The screen scan is not an exhaustive interaction or accessibility audit. Real permissions, live records, server mutations, account creation, financial approvals, every modal and physical-device behavior still require owner verification. No live database, member account or payment record was changed.
