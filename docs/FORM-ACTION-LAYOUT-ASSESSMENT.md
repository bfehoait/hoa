# Form action layout assessment

11 November 2026. Source review of the rebuilt application, followed by the owner-authorized layout fixes described below. No environment file, credentials, reference application code or live database was read. This is not a browser or accessibility-conformance audit.

## Coverage

Static TypeScript AST inventory found **54 native form declarations across 37 TSX files**, including searches, sample/preview forms and reusable business forms. This is a source-template count, not a count of business workflows or rendered screens. Shared field/action CSS and the ItemRows, ListingMedia, booking composer and modal helpers were also reviewed. Configured workflows inherit these shared templates.

| Area | Source templates reviewed |
| --- | --- |
| Shared search and workspace | CustomerSearch, WorkspaceUI |
| Authentication and membership | Access, PreviewAccess, Registration |
| Sample feature baseline | FeatureBaseline |
| Community and marketplace | AnnouncementManager, FeatureSubmissionForm, GarageSaleItems, LiveFeature, Marketplace |
| Operational submissions and decisions | HouseholdApplication, OperationsDesk, ParticipationDesk, RequestIssuance, Inbox |
| Access management | AccessManager, DeveloperSearch |
| Resident account and navigation | MemberProfile, More, Settings |
| Office accounting and accounts | AccountingWorkbench, CreateAccount, DeleteAccount, HouseholdRoster, MemberWorkspace, OfficeConfiguration, People, RegistrationReview |
| Property register | LotRegister, PropertyBusinessDetails, WorkbookAccountLinks |
| Helpdesk and service entry | RequestBusinessDetails, RequestDesk, Services |
| Transport | CarpoolDemo, Shuttle |

## Findings

| Priority | Finding | Evidence and affected scope |
| --- | --- | --- |
| 1 | A repeat-row removal action stretches to the height of a labelled field | Registration renders Remove member directly inside CreateAccount.module.css's two-column `.fields` grid, with no alignment override. Default grid stretching includes the neighbouring label and input height. Confirmed by the supplied screenshot and source. |
| 1 | Many form actions acquire full width implicitly | LiveFeature, MemberWorkspace, LotRegister, RequestDesk and Shuttle use grid forms/fieldsets with direct button children. Grid items stretch horizontally without an explicit placement rule. Examples include Find account, Check account & lot, Check property, Confirm property link, review decisions, issuance confirmation and shuttle configuration. This is a sizing inconsistency; it does not imply a submission or permission failure. |
| 2 | Repeat-item add controls are visually too prominent | ItemRows uses a grid containing the Add another button, so the quiet helper stretches across the editor. ListingMedia uses a grid for link rows below its desktop breakpoint; Remove link can also stretch horizontally there. Its desktop row already uses `align-items: end`, so it does not share Registration's vertical-stretch defect. |
| 2 | Action alignment differs between templates | Some forms already use `.form-actions`, local flex actions or persistent modal footers. Others place confirmation/helper actions directly into a grid. The former should be preserved; applying a blanket width or alignment rule to every button would break intentional mobile actions and filter bars. |
| 2 | Focus rings look heavier outside staff workspaces | Global focus is 3px with a 4px offset, customer focus is 3px/3px, while staff controls use 2px/2px. Search/media/booking/settings/access controls also have local overrides. This makes otherwise identical controls appear different. Focus must remain clearly visible. |
| 3 | Long labels can make a button legitimately taller | The shared Button has a minimum 48px target, 12px vertical padding and wrapping text. A minimum height is not a fixed height. Wrapping at narrow widths or zoom must remain possible rather than clipping text to force identical heights. |

## Existing patterns to preserve

- Sign-in, public membership application and carpool demo primary submissions intentionally span their narrow form column.
- Main marketplace/operational submission forms already use `.form-actions`; Helpdesk reply/creation and several Office editors use explicit action groups.
- Office member editing already has a persistent footer and content-sized actions; its details rows should not be rebuilt.
- Search/filter bars use flex alignment with labels. Do not globally change Button's `align-self`, which would misalign those controls.
- ItemRows removal controls already use an aligned flex row and a 48px icon target.
- Booking and modal actions intentionally stack on mobile. Do not apply desktop widths at every breakpoint.
- Card-sized navigation, record rows, calendar days and time-range options are not oversized form submit buttons.

## Authorized correction

1. Give household member removal its own action row below the member fields, without changing field values or removal behavior.
2. Set explicit content-sized placement for direct actions in the shared grid-form families. Keep mobile primary submissions full-width where appropriate and preserve explicit block buttons, flex action groups, toolbars and persistent footers.
3. Keep repeat-item/link helper actions compact and visually subordinate.
4. Standardize the reviewed focus indicators at 2px with a compact offset, retaining inset rings where necessary for clipped/scrolling surfaces.
5. Retain 48px minimum controls, wrapping labels, semantic button types, pending/disabled states, validation, submitted fields and all server authority.

## Verification boundary

No form was submitted during assessment. All 37 native-form source files were inventoried and their shared action styles reviewed, but every rendered state and configured workflow has not been visually inspected. Browser acceptance should include the expanded membership household list, public sign-in/application, Office linking and issuance, marketplace item/link editors, Helpdesk, booking, accounting, configuration and shuttle forms at desktop/mobile widths and 200% zoom. Check long labels, helper/remove actions, pending state and keyboard focus. No new SQL is needed for these presentation changes.

## Implementation completed

- Registration's household-member removal is now a dedicated full-grid-width action row containing a compact secondary button; the button itself stays content-sized. Add household member is a quiet helper with a 48px minimum target. Existing row state, disabled behavior and submission fields are unchanged.
- Six shared grid-form CSS families (LiveFeature, MemberWorkspace, LotRegister, RequestDesk, Shuttle and Settings) explicitly size direct buttons to content rather than the grid cell. At 767px and below, direct submit buttons can fill the column. Explicit block buttons and existing grouped actions retain their own width rules. No global Button alignment override was introduced.
- ItemRows' Add another and ListingMedia's Remove link helpers no longer acquire accidental grid width. Link removal uses the shared small visual variant, which still has a 48px minimum target.
- Shared form-action and member/workflow flex rows now center their controls vertically, preventing a long adjacent action from stretching every button in its row.
- Reviewed 3px focus outlines and positive 3/4px offsets were normalized to 2px. Existing inset outlines remain inset to avoid clipping. Search and password wrappers show the outer ring for input focus; their separate buttons retain their own focus ring, avoiding two simultaneous rings on one action.

TypeScript and production build passed. Targeted ESLint on edited TSX files and Prettier on edited TSX/CSS passed. The existing production bundle-size warning remains. No automated test suites, browser submissions, live database changes or SQL application were performed. Owner browser verification remains necessary for rendered dimensions, keyboard focus and every configured workflow state.
