# Staff desktop typography

14 November 2026. Reviewed font-size and font-weight declarations across all 76 application stylesheets. The owner's current concern is staff desktop consistency; resident and mobile styles retain their original fallback values.

## Shared scale

The tokens in `apps/web/src/styles/desktop.css` apply only to staff shells at 1024 CSS pixels and above, including their dialogs.

| Role                                    | Size                       | Weight  |
| --------------------------------------- | -------------------------- | ------- |
| Page title                              | 22px                       | 700     |
| Section title                           | 18px                       | 600     |
| Card title                              | 16px                       | 600     |
| Dialog title                            | 20px                       | 600     |
| Body and input values                   | 16px                       | 400     |
| Form label                              | Existing 14–16px           | 500     |
| Supporting text                         | At least 14px              | Regular |
| Actions and emphasized values           | Existing control/body size | 600     |
| Main figures                            | 28px                       | 600     |
| Finance summary figures in narrow cards | Responsive 20–26px         | 600     |

The hierarchy intentionally distinguishes a selected navigation item, a heading or an action from normal descriptive text. Equivalent elements should use equivalent weights; scattered 650, 750 and 800 weights no longer override this desktop system.

## Implementation

Shared tokens control existing CSS Module declarations, including module-specific and Office-specific overrides. Existing values remain as fallbacks, so this pass does not shrink resident/mobile typography or control geometry. Broad heading defaults use low specificity so explicit card/dialog semantics can still select the right token. Finance's four-column summary cards use a smaller responsive figure size to address the reported currency wrapping. Exact amounts, decimal formatting and financial data are unchanged.

New staff headings should use the matching staff token with a mobile/resident fallback rather than introducing another desktop pixel size or font weight. Keep body/input text at 16px, supporting text at least 14px and controls at least 48px.

## Desktop sidebar

The common staff sidebar uses 14px secondary navigation/search/workspace text at weight 500, with weight 600 for the selected destination and count badges. The text wordmark is 22px with a 14px subtitle. Menu icons are 18px; badge geometry is 24px. Links and input/select controls retain 48px minimum targets, and labels may wrap rather than being cut off. These overrides apply to all staff roles at 1024px and above; resident and mobile navigation remain unchanged. Main page input values remain 16px.

## Verification and deployment

Local CSS parsing, TypeScript/production build and whitespace checks are recorded in the verification vault. Browser rendering is not claimed: the owner should compare Finance, Overview, Community, other staff roles and dialogs in light/dark at 1024, 1280 and wider widths, including long titles and amounts. Also check the resident/mobile fallback appearance after resizing below the desktop breakpoint.

Frontend deployment only. No SQL, Edge Function redeployment, data-fetching, account authority, routing or decision-handler changes are part of this typography pass.
