# UI pass — role/module coverage

Built from actual routes (`AppShell.tsx`) and components. Status is from **reading
each screen's composition**, not from "a file was touched" or "shared CSS applies".
Legend: **Improved** (changed this pass) · **Reviewed** (inspected; composition
already matches the artifact direction — specific reason given) · **Pending**
(not yet inspected in depth this pass).

Verification is local only (tsc + build + diff-check). None of the below is
browser- or behavior-verified — that remains the owner's step.

## Office (staff)
| Screen | Route → component | Status | Notes |
|---|---|---|---|
| Overview | `/office` → StaffHome | Reviewed | OfficePage header + `OfficeReviewInbox compact` (attention) + `StaffCollections` + worklist + "Office tools" gallery. Clear hierarchy, discoverable tools. Matches artifact overview. |
| Review inbox | `/office/approvals` → OfficeReviewInbox | Reviewed | Queue list + `OfficeWorkload` (KPI trio with accent strips/icon chips + workload bars + follow-up list). Live counts from `bfe_office_business_review_inbox`; empty/loading/error states present. |
| People & accounts | `/office/residents` → People | Reviewed | Directory rows (avatar, role badges, property links), **status chips colored by meaning**, search field+query+status+Clear, pagination, result count, empty/loading/error, Create account + member drawer. |
| Member dialogs | MemberWorkspace / CreateAccount | Pending | Not re-read in depth this pass; CreateAccount keeps its `created`/`member_linked` confirmation — do not alter (AGENTS §account workflow). |
| Finance | `/office/finance` → RecordedFinance (+ FinanceReports) | Pending | Finance tabs (Collections & AR / Reports) present via Office.tsx; RecordedFinance internals not deeply re-read. |
| Operations | `/office/operations` → LiveFeatureDirectory / OperationsDesk | Pending | Desk restyled by prior pass; compact summary tables + full-record dialogs not re-verified here. |
| Facilities & calendar | `/office/calendar` → FacilityCalendar | Pending | **Preserve calendar functionality** — needs careful inspection before any edit. |
| Community | `/office/announcements` → AnnouncementManager | Pending | Announcement cards + publish/unpublish/history; not deeply re-read. |
| Helpdesk | `/office/inbox` → RequestDesk | Pending | Request list + thread + reply; unsaved-edit guards — inspect before editing. |
| Lot register | `/office/lots` → LotRegister | Pending | Desktop table + narrow cards + detail dialogs; not re-read. |
| Roles & permissions | AccessManager / TabAccess | Reviewed | 3-level page-access matrix (No access/Read only/Read & edit) + Role & status + Committee tabs + Review→Confirm. **Action-specific confirm** added earlier ("Deactivate X?"). Keep the 3-level model. |

## Board / BOD
| Screen | Route → component | Status | Notes |
|---|---|---|---|
| Overview | `/board` → FieldWorkspace (real: ConnectedHome area=board) | **Improved** | Added navigation card grid (Documents · Elections · Updates · Reports · Shuttle review) to the real routes + clearer header; kept governance-limits note. `FieldWorkspace.tsx`. |
| Documents / Elections | `/board/documents`,`/elections` → CommunityModules | Pending | Shared module; inspect consuming board view. |
| Updates | `/board/updates` → Community | Pending | |
| Reports | `/board/reports` → LiveFeature(board-reports) | Reviewed | Honest "no verified reports connected" placeholder — no invented data (correct). |
| Shuttle review | `/board/shuttle` → Shuttle | Reviewed | Shared shuttle screen (see Transport). |

## Security
| Screen | Route → component | Status | Notes |
|---|---|---|---|
| Visitors / Gate desk | `/security`, `/security/gate` → OperationsDesk / FlowDesk | Pending | Real desks restyled by prior pass; inspect composition before editing. |
| Vehicles / Incidents | `/security/vehicles`,`/incidents` → LiveFeature | Pending | |
| Preview overview | FieldWorkspace (SampleFieldWorkspace) | Reviewed | Synthetic preview, clearly labelled; honest "Unavailable" states; no invented gate metrics. |

## Driver / Transport
| Screen | Route → component | Status | Notes |
|---|---|---|---|
| Shuttle | `/driver`, `/driver/dispatch`, `/more/transport` → Shuttle | Reviewed | Large server-wired screen: availability cards, request list with pickup timeline, driver duty/ready, roster + journey-estimate Sheets, history filter + pagination, honest "Unavailable" for live-location. `Shuttle.module.css` restyled. Composition matches artifact dispatch intent without inventing data. |

## Developer
| Screen | Route → component | Status | Notes |
|---|---|---|---|
| Console / Home / Search | `/developer/*` → Developer, DeveloperHome, DeveloperSearch | Pending | 17 developer files restyled by prior pass; not re-read in depth this session. |
| Access manager | AccessManager / TabAccess | Reviewed | See Office · Roles. |

## Resident
| Screen | Route → component | Status | Notes |
|---|---|---|---|
| Home | `/` → ConnectedHome (real) / Home (preview) | Pending | From earlier portal redesign; not re-read this session. |
| Account | `/account/*` → HouseholdAccount (real) / SampleAccount (preview) | Reviewed (preview) | SampleAccount: tabs (Bills & statement / Payment history), summary rail (balance, Pay dues, statement link, details), `InvoiceVisual` chart, status filters, invoice list, bill + Pay-dues `Sheet`, empty state, synthetic labels. HouseholdAccount (real) **Pending** deep read. |
| Services | `/services/*` → Services / ConnectedHome area=services | Pending | |
| Livelihood | via CommunityModules(marketplace) / Directory(Market) | Pending | |
| More | `/more/*` → More, Settings, Notifications, MemberProfile, Hotlines | Pending | |
| Shared nav / shell | AppShell, AccountNavigation | Reviewed | Compact 264px sidebar, workspace switcher, grouped nav, screen search (⌘/Ctrl-K), theme + notifications — restyled by prior pass. |

## Changed this pass
- `apps/web/src/features/workspaces/FieldWorkspace.tsx` — Board overview (preview) navigation grid (Improved).
- `apps/web/src/features/home/ConnectedHome.tsx` — **Board overview (real, `/board`)**: replaced generic resident copy ("Community notices and services for your household") with board-specific framing + a Landmark header icon. Board destination grid (Documents/Updates/Elections/Reports) unchanged; "Board reports — not available yet" stays honest (no invented data).
- `apps/web/src/features/connected/OperationsDesk.tsx` — **Security Visitors**: eyebrow is now context-aware — "GATE & SECURITY" on `/security`, "OFFICE OPERATIONS" for office, "RESIDENT SERVICES" for residents (was always "OFFICE OPERATIONS"). Review-queue cards/actions/modal unchanged.
- `apps/web/src/features/transport/Shuttle.tsx` — **Transport/Driver**: role-aware header description ("Accept ride requests and keep your shuttle status up to date." on `/driver`; passenger copy elsewhere). All dispatch/availability/roster logic unchanged.
- (Earlier this session, now in tree / extended by Codex: `global.css` staff elevation + carded tables; `StaffHome` tools gallery; `OfficeWorkload` KPI cards; `People` status colors; `AccessManager` action-specific confirm.)

## Not done / needs continuation
Every **Pending** row above needs per-screen composition inspection and, where a
concrete gap exists, a targeted presentation fix (hierarchy, states, responsive,
dialogs). Calendar and account-provisioning/helpdesk-unsaved-guard screens need
extra care to preserve behavior. No behavior changes were made; any required
behavior change must be raised separately for Codex.

## Codex continuation - Board screenshots, 14 November 2026

This entry supersedes the earlier Board Pending rows; it does not mark other roles complete. Real Board Overview now uses BoardOverview: governance/oversight cards, published report/record counts and recent updates via existing authorized feature readers. Board shell, Documents, Elections, Updates, Reports and Shuttle review received targeted presentation changes. Documents retains its existing library and attachment Sheet; Elections remains candidate information, Reports remains the published report reader, Updates uses a continuous feed. Shuttle adds a per-page individual request table without replacing original actions/history. Verified election/finance metrics and document upload are not fabricated. Separate synthetic role previews retain their original fixture flows. Local TypeScript/build, targeted lint/formatting and diff checks passed; browser verification remains pending. See docs/BOARD-SCREENSHOT-IMPLEMENTATION.md. Remaining non-Board coverage stays outstanding from the broader task and can proceed role by role with the owner.

## Codex continuation - Security screenshots, 14 November 2026

Security Overview, Visitors, Vehicles, Incidents and Gate desk received a targeted presentation pass. This supersedes earlier Security Pending entries. Existing authorized readers/actions remain; unavailable gate aggregates, sticker authority and complete event logs are not invented. See docs/SECURITY-SCREENSHOT-IMPLEMENTATION.md. Local checks do not replace browser verification. Other roles remain governed by their separate coverage entries.

## Codex continuation - Transport screenshots, 14 November 2026

Transport Shuttle and Profile received targeted shell/dispatch/fleet/profile changes. Existing trip/readiness/duty/history/roster workflows remain; unsupported aggregate metrics remain unavailable. Driver Profile uses the existing personal editor and Office-managed read-only assignment data. See docs/TRANSPORT-SCREENSHOT-IMPLEMENTATION.md. Local checks passed; real driver browser verification remains pending. This supersedes the earlier Transport Reviewed entry without claiming completion of unrelated resident modules.
