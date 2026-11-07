# Bellefort Estates community portal

Real Supabase sign-in is implemented and is the default mode. Connection values are not configured yet; see [setup instructions](docs/START-HERE.md). Authentication, member lookup and frontend workspace restrictions are separate from the still-synthetic business workflows. Existing database RLS and protected operations require live review before production use. No deployment or database changes were performed.

For the synthetic walkthrough below, explicitly set `VITE_APP_MODE=preview` and restart Vite. Preview mode does not authenticate or enforce roles. Only use synthetic records there.


For the latest everyday-user experience, open `/services` for searchable task tiles and tracking, or `/more` for the grouped feature catalogue. Additional preview tools and supporting explanations expand when needed. [User experience notes](docs/vault/User%20experience.md) describe the new navigation patterns and review tasks. Operation-level backend authorization remains pending.

Start the connected source-informed preview at `/directory`, with an optional synthetic walkthrough. `/explore` has 31 structured modules; `/office/review` joins local drafts to sample publication, and `/coverage` maps all 16 extracted source families and 76 observed feature statements to working local entry points and remaining gates. Read [connected workflows and limits](docs/vault/Connected%20workflows.md) before treating any preview action as production behavior. The original reference snapshot remains isolated and unchanged.

A mobile-first, local product preview rebuilt from the HOA workflow brief. This is a new React application; the reference HTML is not imported, executed, or reused.

**Start with [the walkthrough and next-step instructions](docs/START-HERE.md).** It covers every workspace, local review/publication flows, developer maintenance and what you need to supply before a real backend release. [Developer maintenance](docs/DEVELOPER-MAINTENANCE.md) documents safe local tools and the future protected-maintenance requirements.

The current visual direction pairs the user-requested burgundy/rose palette with the approved mobile-app layout: a burgundy balance card, self-hosted Manrope font, eight service shortcuts, recorded-payment history, compact community updates, and responsive bottom navigation. White and warm neutral surfaces have a corresponding plum/rose dark mode. No provider branding or code is reused. Vehicles and permits have explicit unverified states; the payment-options sheet cannot collect money or change payment status.

## Run locally

Requires Node 22.12+ and npm. From this directory:

```sh
npm install
npm run dev
```

Open the printed URL, normally http://127.0.0.1:5173. On Windows PowerShell with script execution disabled, use `npm.cmd install` and `npm.cmd run dev`.

For a phone on the same trusted Wi-Fi, run `npm run dev -- --host 0.0.0.0` and open the computer’s LAN address on port 5173. Firewall permission may be required. No real resident data should be entered. Web app installation requires a secure origin (localhost is allowed on the computer; plain HTTP LAN origins are not).

## Explore

The whole-system roadmap is in [Master implementation plan](docs/vault/Master%20implementation%20plan.md). Pair it with the [Screen and interaction plan](docs/vault/Screen%20and%20interaction%20plan.md), [Permission planning matrix](docs/vault/Permission%20planning%20matrix.md) and [Release acceptance](docs/vault/Release%20acceptance.md). These are proposed future work, not completed backend capabilities or permission to deploy.

- `/`: status-led resident overview. `/more/settings` links to due, overdue, paid, not-billed, loading, and failure presentations.
- `/account`: statements, bill filters, details, and safe sample CSV export.
- `/community`: searchable notices, detail screens, and saved updates.
- `/services/requests`: validated request creation and status tracking.
- `/services/bookings`: sample space requests, details, and cancellation.
- `/services/visitors`: sample visitor requests. No real gate passes or access codes.
- `/more`: market, transport, learning, governance, documents, profile, support, and preview reset.
- `/admin`: synthetic collections report, aging, household filters, local request review, role descriptions, and local activity history.
- `/office`: dedicated office navigation, application review, property dossiers, finance/expenses/reconciliation, local request assignment and content drafting.
- `/sign-in`, `/recover`, `/reset-password`, `/sign-out`, `/workspaces`: real Auth flow and member-linked workspace selection when configured. Self-registration remains unavailable in authenticated mode. Explicit preview mode retains the synthetic chooser and application flow.
- `/security`, `/driver`, `/board`: separate operational/oversight previews; no real role authority.
- `/developer`: authenticated developer console for an explicitly assigned `developer` role, with scoped connection checks, a read-only account profile and isolated synthetic role previews. Admin alone does not grant access. The diagnostic state lab and fixture tools remain available in explicit preview mode.
- `/services/calendar`, `/more/notifications`: read-only sample calendar and local activity/preferences; no live availability or delivery.

All sample records are synthetic and visibly labelled. The reporting date is deliberately fixed at **4 November 2026**; form date validation uses today in Asia/Manila. Profile and workflow edits use session storage, remain in one browser tab, and may disappear when the tab closes. The only local-storage value is the theme preference.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Install WebKit too (`npx playwright install webkit`) to run the full suite; `npm run test:e2e -- --project=chromium` runs only Chromium. Playwright automatically uses the optional workspace `.browsers` directory when it exists. For a workspace-local browser installation, set `PLAYWRIGHT_BROWSERS_PATH` to that directory before the install command.

Browser tests include axe scans, 360px/1280px layouts, both themes, form validation, dialogs, storage recovery, requests, bookings, and reporting. See `docs/vault/Verification.md` for actual results rather than assuming a script has passed. Run `npm run screenshots` while the dev server serves port 5173 to regenerate the [screenshot gallery](docs/previews/README.md). After a production build, start `npm run preview -- --port 4173`, then run `node scripts/check-production.mjs` to check public-asset caching and offline shell behavior.

## Architecture

`apps/web/src/features` owns route features; `components` owns shared UI; CSS Modules own component styling; `styles/tokens.css` owns the visual tokens. `packages/shared` contains portable zod contracts and pure financial calculations. TanStack Query handles asynchronous repository state. React Router provides deep links and back navigation. Feature routes are split into separate production chunks.

`data/repository.ts` is an explicit demonstration adapter, **not** a production persistence model. Replace it with authenticated row-level API operations. Do not port its browser storage to production. No Supabase client, production project URL, or key is included. `.env.example` reserves new-project configuration only.

The PWA precaches only public application files; it has no private-data runtime cache. Service worker registration is produced for the production build, not ordinary development. A PWA is not an App Store or Google Play release.

The checked dependency graph has zero reported runtime advisories, with 20 remaining low/moderate development-tool advisories (no high/critical). See the verification note for scope. A successful build is not a claim of production release readiness.

## Release boundary

This is a working frontend preview, not a production resident service. Before production: confirm HOA policy and branding, implement authentication and separate dev Supabase tables/RLS/RPCs, verify transactional approvals and server audit, protect file access, implement approved mail delivery, validate privacy and retention requirements, test on actual phones, and run resident usability sessions. Payments and voting deliberately have no pretend backend implementation.

Native distribution is a separate stage. The shared contracts can support Expo/React Native; web UI components are not promised to be native-compatible. Signed Android/iOS builds, real-device testing, privacy disclosures, accessibility review, store metadata and publisher accounts are still needed. iOS compilation requires a supported macOS/Xcode environment. No store submission has been made.

No Git repository, push, remote resource, database, or deployment is created by the local app.
