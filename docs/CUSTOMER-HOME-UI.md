# Customer Home, first UI pass

Local frontend changes on 9 November 2026, following the owner's mobile reference and approved Home direction. No SQL or Edge Function update is needed for this layout. The owner confirmed announcement uploads/publication work after the preceding migrations.

- Resident header uses the existing Bellefort logo, theme action and notification bell. The repetitive signed-in status strip is omitted on live resident pages; synthetic preview labels remain.
- Home starts with a compact greeting and Philippine-local date, then up to four published announcements in a manual carousel. Previous/next and individual announcement selectors are keyboard-accessible buttons with 48 px targets. No automatic rotation or new animation. Text-only posts and loading, empty and error states remain supported. Read announcement opens full text in the existing accessible modal; See all opens the existing announcement list.
- Four compact shortcuts lead to visitor, gate, small-delivery and amenity services. Pass shortcuts preselect the corresponding type in the existing pass service. Search filters these and Helpdesk/Documents/Permits shortcuts locally; it is not a search of all database records.
- My account shows the recorded member address and account-holder name, with an unavailable household balance. A recorded address does not establish approved lot ownership, and an account holder is not labelled as the verified homeowner. No bill amounts, accounts or events are fabricated.
- Resident navigation becomes Home, Account, Livelihood, Services, More, subject to existing access visibility. Updates remains available through announcements on Home. Livelihood uses its existing route; its listing child routes select Livelihood rather than More.
- The Home layout uses existing CSS tokens with mobile single-column and desktop split layouts. Account and service detail pages remain their existing workflows. The synthetic fixture Home stays separate; sign in as a resident or use the existing account preview to inspect connected customer screens. Preview remains read-only and is not permission enforcement.

## Owner browser checks

Check a small phone and desktop, light/dark theme, logo visibility, bottom navigation and safe-area clearance. Open each of four announcements, move between them with keyboard/touch controls, and check a text-only post. Verify full text, close/focus return, See all and image expiry/error states. Follow each pass shortcut and confirm its type, then check Amenities, Helpdesk, Documents, Permits and View account. Confirm the intended nav item is active for Livelihood child pages. Test an account with hidden tabs: links should remain hidden and backend rules still enforce access.

TypeScript and whitespace checks are local verification only. No browser screenshots, automated suites, E2E or accessibility scan were run. No commit, push, deployment or live database operation was performed.
