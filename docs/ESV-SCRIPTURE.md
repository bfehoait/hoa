# Daily ESV verse

On 11 November 2026, the owner requested ESV wording for the compact resident-home verse card.

The 75 selection slots retain their order and the existing Philippine-time rotation. Each entry in `apps/web/src/data/scripture.ts` contains its official ESV.org passage URL. Text was obtained from each page's full selected passage, excluding verse numbers, cross-reference/footnote markers and Psalm headings. Longer metadata descriptions were unsuitable because they truncate verses. Divine-name small caps are represented as LORD. Complete selected verses are shown without paraphrasing or shortening; a few selections are longer than the former excerpts.

Psalm references were converted to ESV numbering. The previous Lamentations 3:22 selection included the following verse's theme, so its ESV reference is now 3:22–23. The collection contains 76 verses across 75 slots. In particular, the former Psalm 18:2 entry is Psalm 19:1 in ESV.

The card now says Today's Verse, since the rotation includes Psalms and other books as well as Gospel passages. At the owner's correction, the card displays only the verse and its reference, without an ESV label, button or popup. The publisher notice and source link are available under Scripture copyright in Settings. Full text remains local; rendering makes no external requests and requires no API key. The external link is opened only when selected.

Source/quotation terms reviewed: [Crossway ESV digital permissions](https://www.crossway.org/permissions/#esv-digital-permissions). The published standard guidelines permit up to 500 quoted verses subject to the stated limits and attribution. This small collection is part of the wider portal, rather than a standalone Bible reference work. Keep the supplied copyright notice and ESV marks. ESV content is not covered by any Creative Commons grant on other project material. Future expansion requires checking the publisher's limits again.

Checks: reviewed all extracted selections and source URLs, removed six extracted Psalm headings, verified that all 75 slots were retained, and retained the rotation function unchanged. Frontend TypeScript and `git diff --check` passed, including the subsequent removal of the card's ESV button/popup. No automated suite or browser run was performed. Owner should verify long-verse wrapping, the card's plain reference, Settings copyright disclosure, external source link, dark mode and narrow-phone layout. No SQL, backend, credentials, deployment or publication changed.
