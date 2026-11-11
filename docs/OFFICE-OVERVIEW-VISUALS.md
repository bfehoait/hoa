# Office overview workload charts

10 November 2026. Overview now presents the existing authorized review-inbox response as three totals (awaiting review, in review, follow-up/dispatch) and a stacked horizontal bar chart of the six busiest review queues. Each bar links to its review desk. Extra queues remain available through Review inbox. Follow-up links remain separate from approval work.

The chart compares absolute current counts, scaled against the largest displayed queue. It is not a completion rate, daily trend or performance score. Status labels and numbers accompany colors; all queue links retain keyboard access. The same data/refresh/error handling powers both the visual overview and detailed inbox; no extra request, database migration or permission grant is introduced. Totals cover all accessible queues even when only six bars are shown.

Customer pages and the full review-inbox layout are unchanged. Error states hide totals instead of substituting zero; successful empty responses display confirmed zeros.

Validation: TypeScript passed. Six synthetic Chromium renders at 1024×768 and 1440×900 covered populated, empty and denied reads, total calculations and chart links. One additional dark render passed. No detected page overflow, undersized scanned controls, page errors or unknown fixture RPCs. Light-theme desktop output visually inspected. Owner live-data verification remains necessary; no server data or deployment was changed.
