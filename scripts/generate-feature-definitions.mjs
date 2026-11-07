// Generates only project-owned form metadata; never reads reference application code.
import { readFile, writeFile } from "node:fs/promises";
import { baselineModules } from "../packages/shared/src/baseline.ts";
const capability = {
  Property: "property",
  Finance: "finance",
  Livelihood: "livelihood",
  Learning: "livelihood",
  Transport: "transport",
  Support: "requests",
  Security: "security",
  Community: "community",
  Governance: "documents",
  Administration: "operations",
};
const publicModules = [
  "businesses",
  "buy-sell",
  "jobs",
  "garage-sales",
  "booth-events",
  "workshops",
  "carpools",
  "publishing",
  "events",
  "board-records",
  "election-candidates",
];
const residentModules = [
  "businesses",
  "buy-sell",
  "jobs",
  "garage-sales",
  "workshops",
  "participation",
  "booth-applications",
  "carpool-interests",
  "household-changes",
  "carpools",
  "payment-evidence",
];
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const rows = baselineModules.map(
  (m) =>
    `(${quote(m.id)},${quote(capability[m.group] ?? "operations")},${residentModules.includes(m.id)},${publicModules.includes(m.id)},${quote(JSON.stringify(m.fields))}::jsonb)`,
);
const path = new URL(
  "../supabase/migrations/202611060007_feature_records.sql",
  import.meta.url,
);
let sql = await readFile(path, "utf8");
sql = sql.replace(
  /-- DEFINITIONS[\s\S]*?NOTIFY pgrst/,
  "-- DEFINITIONS\nINSERT INTO public.bfe_feature_definitions(code,capability,resident_create,publishable,fields) VALUES\n" +
    rows.join(",\n") +
    ";\nNOTIFY pgrst",
);
await writeFile(path, sql);
