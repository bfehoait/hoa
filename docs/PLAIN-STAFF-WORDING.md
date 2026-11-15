# Plain-English staff wording

15 November 2026. Local wording and Developer sidebar presentation updates; no live database or deployment changes.

Office, Board, Security and Transport screens use shorter everyday descriptions for totals, tasks, errors and unavailable information. Shared finance report requirements and summary-service errors use the same approach. Database identifiers, role names used for authorization, status values, query keys, routes, permission checks and financial calculations are unchanged.

Examples:

| Previous wording                                 | Current wording                                   |
| ------------------------------------------------ | ------------------------------------------------- |
| Posted invoice coverage · YTD                    | Payments applied to this year's bills             |
| Expenses · YTD                                   | Expenses this year                                |
| Your logged incidents                            | Incidents you reported                            |
| Scope: association                               | Includes: all shuttles                            |
| Allocate imported receipts                       | Apply past receipts to bills                      |
| Vehicle / sticker issuance                       | Vehicle stickers to issue                         |
| Review queues                                    | Requests, sections or lists, according to context |
| A required migration or schema reload is missing | Ask the system administrator to check the setup   |

Necessary distinctions remain clear: past receipts do not establish unpaid bills or bank clearance; confirming financial records does not prove money cleared the bank; missing data stays unavailable; turnout requires confirmed voter totals; gate records are not a physical headcount; a past ride average is not a current arrival estimate; viewing financial totals does not grant permission to edit individual records. Preview notices clearly identify sample information and do not promise real approvals, accounts, emails or gate passes.

The Developer sidebar no longer uses a separate inner scroll container that can clip the selector's focus outline. Its sidebar scrolls as one area, and the selector spacing/border, menu spacing and help row align with the other desktop staff sidebars. Native select behavior, workspace routes and role access checks remain unchanged.

## Validation and owner checks

TypeScript/build, targeted lint, formatting and whitespace results are recorded in the verification vault. The owner should compare each staff role in the browser, including long text, financial/permission notices, previews and the Developer workspace selector at short/tall desktop heights. No browser verification, live SQL, live decision, automated suite, commit/push or deployment is claimed.

Frontend deployment only. No new SQL or bfe-create-account Edge Function redeployment is required for this pass. The protected account-creation workflow is unchanged.
