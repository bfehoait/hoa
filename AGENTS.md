# Working rules

- This directory is the rebuilt portal checkout of `https://github.com/bfehoait/hoa`, on `main`. The owner integrated and published the rebuild; older descriptions of an isolated, uncommitted workspace are historical. Do not access other projects or change hosting/database state without explicit authorization.
- User-authorized reference exception (4 November 2026): a read-only clone of `https://github.com/bfehoait/hoa` is allowed in `reference/upstream-hoa` for static information extraction. Never edit/push its source, execute/import its code, reuse its design/assets, or connect to its backend. Keep raw source ignored and denied by the dev server; derived inventories contain metadata only.
- No commit, push, publication, live database connection, or store submission without explicit authorization.
- Current authorization: local implementation of the rebuilt frontend and preparation of backend migrations/scripts. The owner runs live SQL and performs browser checks. No automated test suites, end-to-end runs or axe sweeps unless requested; keep TypeScript checking after frontend edits. Association policy decisions remain with the owner.
- Never import, execute, or reuse reference application code. Evidence is workflow information only.
- All preview records must stay clearly labelled synthetic. Unknown official values remain unavailable.
- No resident control may set payment status, role, approval, or election tally. Production authority must be server-owned.
- Browser preview mode is not authentication or permission enforcement. Never claim it is.
- Preserve React 19, TypeScript, React Router, TanStack Query, shared zod schemas, plain CSS tokens and CSS Modules. No component kits or Tailwind.
- Mobile first, 16px body text, at least 14px secondary text, 48px controls, keyboard focus, reduced motion and safe-area support.
- Owner UI preference: avoid redundant headings and repeated instructions. When a tab or dialog already names the section, omit a second equivalent heading inside it. Keep necessary state, scope, synthetic labels and action guidance concise.
- Avoid duplicate navigation actions to a section already available in the same visible tab bar (for example, a Change in Role & status link beneath the Role & status tab).
- New records are local sample records until backend confirmation exists. Never label local persistence as an HOA confirmation.
- Review substantive changes, typecheck frontend edits, and update affected vault notes. Report what was actually checked and what remains for owner browser verification. Never treat skipped tests as passing.
- No credentials or real personal information in source, logs, fixtures, tests, or screenshots.
