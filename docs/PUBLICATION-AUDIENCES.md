# Publication audiences

The Office review dialog now offers checkbox audiences. All members is selected by default and disables the narrower choices. Uncheck it to select one or more of Homeowners, Renters, Board, Security and Drivers. Publishing requires at least one selection. Selecting an audience never grants a role.

Migration `202611130073_publication_audiences.sql` adds the audience set and a review RPC that delegates authorization, consent, version and workflow checks to the existing reviewer function. Ten content readers use the same visibility predicate, including marketplace media, documents, participation and calendar entries. Existing single-audience publications retain their visibility; older single-audience publishers clear any prior set. Marketplace priority ordering is preserved.

## Owner rollout

1. Run migration 073 after 072, before deploying this frontend.
2. Run migration `202611130074_phase_lot_limits.sql` after 073 for the separate lot-validation correction found during the customer wiring review.
3. Redeploy **bfe-create-account** using the complete generated `docs/setup/bfe-create-account.editor.txt`. This is needed for the phase validation change, not for audience selection alone.
4. Deploy the matching frontend through the usual owner workflow.

Phase limits are Phase 1 blocks 01-19 / lots 001-111, Phase 2 blocks 01-09 / lots 001-036, and Phase 3 block 01 / lots 001-054. New resident registrations and member inserts are guarded; existing history is not rewritten.

## Owner browser verification

- Publish synthetic content for Homeowners and Renters. Verify both can read it and an unselected role cannot, including detail/media/document access.
- Verify All members, no-selection validation, rejection, withdrawal, stale review version and an unauthorized review attempt.
- Verify existing single-audience content and the marketplace priority listing retain their expected visibility/order.
- Submit valid phase-boundary addresses and invalid Phase 2/3 addresses through registration and Office creation. Confirm successful registration reaches the Registration inbox and invalid input creates no member.

SQL and Edge runtime behavior have not been executed locally or against production. Browser and role-matrix checks remain with the owner.
