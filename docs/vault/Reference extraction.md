# Reference extraction

The earlier line references below apply to the original pasted attachment. For the newer user-authorized GitHub snapshot (8,891 lines / 591 named functions, commit recorded there), use [[Source coverage ledger]]. Do not mix line numbers across the two snapshots.

**Observed** — The supplied attachment has 8,828 lines and 588 named function declarations. It was read as text, not executed. It is not in the bundle and was not used as implementation code.

| Source lines | Observed workflow / defect | Rebuild consequence |
| --- | --- | --- |
| 2911–2918 | Finance view assigns age buckets from status labels and hardcodes the oldest bucket | Calculate age from actual due dates and remaining amounts |
| 7051–7068 | Critical account changes request reference/reason information | Specify protected audit and supporting-reference rules with HOA |
| 7076–7083 | Audit success toast is timer-driven, before insert confirmation | Confirm only after the responsible storage operation succeeds |
| 7830–7847 | Statements include billed, paid and balance summaries with PDF/CSV output | Offer clearly scoped, reconcilable statement exports |
| 8390–8407 | Public registration collects contact, unit and proof fields before submission | Design privacy-aware registration with explicit confirmed outcome |
| 8418–8427 | Registration review compares submitted details with registry and existing accounts | Approved review workflow needs trusted registry data; browser matching is not identity proof |
| 8451–8465 | Review and approval are separate client operations | Design transactional approval plus a retryable invitation outbox |

**Unknown** — These observations do not establish official payment, booking, election or privacy policy. The defects established in the user’s brief are accepted requirements and were not treated as a reason to connect to the old backend.
