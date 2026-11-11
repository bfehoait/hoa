# Connected workflows

Date: 5 November 2026. Scope: synthetic local frontend implementation. The source repository remains a read-only information reference; none of its application code, assets, configuration values or resident records is executed/imported.

## What changed

The system now connects the structured baseline to resident and office views. There are **31 structured modules**, including the added candidate-proposal module. `/coverage` maps **all 16 extracted source families and their 76 observed feature statements** to local entry points and explicit server gates. These counts describe the extracted inventory, not independent features proven equivalent to every source function.

| Local area | Implemented connected behavior | Entry point |
| --- | --- | --- |
| Accounts/access | Existing entry/recovery states, synthetic registration review and permission/account-change proposals remain available | `/sign-in`, `/office/access` |
| Announcements | Structured audience/pin metadata goes through local review into the resident update feed; simulated audience selection and synthetic attachment/QR references | `/explore/publishing`, `/office/review`, `/community` |
| Documents/governance | Structured board/disclosure metadata can appear in the local document library and governance directory, with versions and simulated audience selection | `/more/documents`, `/directory/governance` |
| Businesses/classifieds/jobs/garage sales | Category-specific drafts can be submitted, reviewed and published into a searchable sample directory; garage items have individual local review/change-request states; archived entries disappear | `/directory/market`, `/office/review` |
| Booth events/vendors | Published sample events link directly to a vendor draft with the parent preselected; existing booth-number/capacity conflict simulation remains | `/directory/market`, `/explore/booth-applications` |
| Training | Published sample sessions link directly to a participation-interest draft; counts remain local interests and can exceed illustrative capacity without reserving places | `/directory/learning` |
| Rides/carpools | Station/ride/carpool/seat proposals share an operational view; predefined synthetic driver/vehicle pairings and ordered trip simulation retain local history | `/driver/dispatch`, `/directory/transport` |
| Support | Separate complaint/concern/ticket/message drafts are visible in resident and office conversation views; typed local replies and separate unread/read markers persist in the tab | `/services/inbox`, `/office/inbox` |
| Property/households | Imported registry and household-change proposals are searchable together, while fixed synthetic ledger units remain visibly separate | `/office/registry` |
| Gate/security | Walk-in/gate-pass/guard-roster proposals share a searchable view; arrival/departure simulation stops at completion and never changes request authority | `/security/gate` |
| Incidents | Existing non-emergency local capture/review/history remains available | `/security/incidents` |
| Billing/expenses | Existing immutable sample bills/reports, evidence imports, budgets/calculator and review remain; a print-friendly sample statement supports browser print/save-as-PDF | `/account/statement`, `/office/finance` |
| Elections | Candidate metadata links to an election proposal and can appear as synthetic information; schedule/rule proposals are available and voting remains disabled | `/explore/election-candidates`, `/more/elections` |

## Local content lifecycle

Prepare a supported structured draft, optionally add synthetic media references, submit it locally, start local review in `/office/review`, then choose **Publish to local sample views** with a reason. The directory and connected feeds derive from the same workspace records, rather than copied records. An archive transition removes an entry from published selectors.

Publication accepts only supported content modules in the **In review** state. Financial evidence, registry changes, access proposals, operational approvals and ballot records cannot be published through this operation. The generic baseline transition still cannot publish a baseline record. The office publication action is a local UI simulation, not a protected staff capability.

Garage listings require every current item to be marked **Preview reviewed** before local directory publication. Reviewers can instead request changes to individual items. Editing the item list clears previous item reviews so they cannot apply to different items. The local preview limits a garage list to 20 items and preserves reasons/history; these are demonstration bounds and review labels, not an approved HOA item policy or actual authorization.

Notice pinning sorts local pinned notices ahead of other feed entries. Structured notice and board-record audiences affect these simulated displays; switching audience is not authentication or confidentiality enforcement. Existing synthetic fixtures remain available. Home's compact fixed notice samples are not a live notification delivery service.

Media controls add only generated `DEMO-*.pdf/png` names, type and descriptive metadata, capped at eight references per editable draft. There is no file upload, image hosting, usable QR generation, protected download or source photo reuse. Exports contain explicitly synthetic metadata, not an original approved document.

## Conversations and simulations

Resident and Office are explicitly named preview actors. Replies are local, never sent. Each actor has its own read cursor for each sample thread; only opposite-actor messages after that cursor count as unread. Closed/cancelled threads reject further replies. There are local demonstration limits of 200 messages per thread and 1,000 total, not an approved HOA retention policy. Participant isolation, delivery, private evidence and immutable audit remain server requirements.

Dispatch pairing accepts only predefined synthetic labels and refuses completed/closed rides. Trip progression remains sequential. Gate simulation accepts active walk-in/gate-pass enquiries and records only Sample arrival then Sample departure; repeat completion is refused. It does not open a gate, certify a pass or record a real entry/exit.

Printable statements use the original immutable synthetic invoice fixtures. New payment-evidence drafts never change billed/recorded/outstanding totals. The print layout hides application navigation, retains the **SAMPLE STATEMENT — NOT OFFICIAL** label, and relies on browser/OS print or PDF support. No official receipt, signature or production PDF service is implemented.

## Synthetic walkthrough and compatibility

At `/directory`, choose **Load synthetic walkthrough**. It adds one labelled sample per current structured module, with supported content illustrated as preview-published fixtures and operational/financial proposals as locally submitted samples. The fixture history explicitly says no real review occurred. Linked parent IDs and one local Office reply are included. It does not replace existing records or touch the resident store. Duplicate loads are refused to preserve edits. These fixtures are not proof that a real reviewer approved anything.

The existing workspace storage key/version is preserved. Zod defaults add `attachments`, `garageReviews`, `messages` and `readMarks` when reading older compatible tab data. Developer **Workspace only** reset clears these records together with other workspace samples; resident records remain separate. Storage errors report failure rather than successful publication or delivery.

## Remaining boundaries

All 16 areas have local coverage and explicit gates; complete behavioral parity for every source function is not established. Some features are proposals/readiness displays because implementing real authority is outside current authorization. Still required: real identity/session/recovery/invitations; approved effective permissions/view-only hierarchy and RLS; verified ownership/membership; private files/messages; trusted imports; official publishing and delivery; actual finance posting/receipts/reconciliation; real amenity/enrollment/seat/booth decisions; guard verification/device events; authoritative incident handling; verified candidates/photos, secret ballots and certified tallies; operational monitoring/recovery; actual-device/resident acceptance and release.

Garage item review is illustrative and cannot certify real items. Photo/QR content is metadata only. Actual fees, contacts, privacy/consent rules, role precedence and other policy values remain unapproved. `/coverage` exposes these limits beside source features. This work does not migrate live source data or recover the absent backend SQL dependencies.

See [[Verification]] for executed checks. Continue business decisions in [[Product questions]] before backend implementation.

### 11 November 2026 - amenity fees in My account

Prepared 068/069 and frontend for Swimming pool replacement plus reviewed booking charges. An approved booking's Office quote is saved/submitted/independently posted through Finance; it then appears under Other and contributes to Total balance alongside HOA. Verified amenity payments and reversals use the same independent Finance review lifecycle. Booking cancellation never marks payment or automatically waives/refunds a fee. Water remains unavailable; no unposted request is debt. See [Amenity choices and account charges](../AMENITY-ACCOUNT-CHARGES.md) for rollout, chosen conservative defaults, payment-reference safeguards and unimplemented pricing/refund automation. Local synthetic SQL and TypeScript checks passed; live schema/roles/preview/browser acceptance remain unverified.
