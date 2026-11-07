# Product questions

**Unknown** — These questions are deferred by the user and do not block the synthetic local UI. They do block real-data/backend/release work as applicable.

1. Production Supabase/Vercel ownership, active resident usage and ownership of a separate development project.
2. Kate’s schema export, RLS, triggers, functions and missing SQL scripts.
3. Which registry, dues figures, board documents and election records are real and approved.
4. Authority and privacy requirements for personal data, retention, contact sharing and document access.
5. Recording versus processing payments; authorized verification, allocation, credits, reversals, fees and receipts.
6. Reporting definitions: household paid/part-paid, unbilled denominator, aging bands, reporting cutoff and reconciliation.
7. Eligibility, secrecy, proxies, one-vote rules, tally responsibility and election disputes.
8. Role combinations, page overrides, view-only precedence and super-admin powers.
9. Official brand identity and logo permission.
10. Booking capacity, availability, fees, conflicts, cancellations and operating hours.
11. Verified contact/emergency details; incident escalation; transport/marketplace/training policies.
12. Whether reviewed Tagalog/Taglish is required and who signs off translations.
13. Native release approach, publisher accounts, supported phones and store requirements.

## Decision ownership and planning gates

**Planned** — These dependencies are mapped for review, not a request to answer everything immediately. The responsible people are roles to identify; no named person’s authority is assumed. Keep answers in [[Decisions]] only after actual approval, and update affected screen/data/permission specifications.

| Decision group | Responsible reviewer to identify | Blocks |
| --- | --- | --- |
| System selection, first-release features and funding/staffing | Boss / project sponsor | Moving beyond planning into the selected production build |
| Environment ownership, approved dev setup and technical evidence (1–2) | Authorized technical owners | P1 setup and any real connection; migration/cutover remain separate |
| Registry truth, membership and record provenance (3) | HOA office / registry owner | P2 and truthful resident accounts |
| Privacy, consent, retention and sensitive-file access (4, 11) | Responsible HOA privacy/data owner | Real personal data, files, contact sharing and external delivery |
| Financial authority, dues, allocation/correction and metric definitions (5–6) | Authorized HOA finance/board reviewers | P3 finance and P4 reporting |
| Effective permissions, overrides, view-only and privileged powers (8) | Authorized HOA decision maker and system/security owner | P1 enforcement and every protected module |
| Brand and reviewed language (9, 12) | HOA brand/content reviewers | Final presentation and any translated release; visual prototypes may remain explicitly provisional |
| Booking, gate, vehicle, incident, permit and service rules (10–11) | Responsible HOA operations/security reviewers | P5 confirmation/issuance and operational use |
| Marketplace, training and transport responsibilities (11) | Responsible module owners | Each P6 extension |
| Election process and secrecy (7) | Authorized election/governance reviewers | P7 design and any actual ballot |
| Pilot, support, release ownership and native approach (13 plus release scope) | Sponsor, operations and technical owners | P8/P9; actual release authorization is still required |

Unresolved policy does not prevent drawing a synthetic screen/state map. It does prevent making up approval powers, eligibility, fees or real completion states. See [[Master implementation plan]], [[Screen and interaction plan]] and [[Release acceptance]].

The later source snapshot adds detailed livelihood, booth/garage-sale, job, dispatch/carpool, import and messaging coverage to review in [[Source coverage ledger]]. Confirm which belong in the first release and verify their operating rules; source implementation and seeded defaults do not answer those questions. The three referenced-but-absent SQL files and required `my_role()` definition remain missing evidence, not files we can invent or safely apply.
