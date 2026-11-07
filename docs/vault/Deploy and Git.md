# Deploy and Git

**Observed** — No Git initialization, commit, push, hosted Site registration, database connection or deployment was performed. Work remains in the user’s local workspace.

Use `npm run dev` locally. `npm run build` produces `dist`; `npm run preview` serves it locally. See README for PowerShell’s `npm.cmd` alternative and trusted-LAN phone testing.

**Planned** — A future static host needs SPA route fallback to index.html, correct public path, HTTPS, security headers and controlled service-worker rollout. Real private records must never enter the service-worker cache. A future native distribution needs signed platform builds and actual-device review, separate from the web build.

Commit, push, production configuration and deployment require explicit user approval. Never target Kate’s projects. See [[Security]].
