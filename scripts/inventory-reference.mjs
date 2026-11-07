import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";

// Static analysis only: no eval, imports, browser rendering or source execution.
const root = path.resolve("reference/upstream-hoa");
const file = path.join(root, "index.html");
if (!fs.existsSync(file))
  throw new Error("The separately authorized reference checkout is missing.");
const html = fs.readFileSync(file, "utf8");
const safe = (value) => /^[A-Za-z_$][A-Za-z0-9_$]{0,70}$/.test(value);
const keyName = (node, tree) => node?.getText(tree).replace(/^['"]|['"]$/g, "");
const fields = (object, tree) =>
  object.properties
    .map((property) => keyName(property.name, tree))
    .filter((value) => value && safe(value));
const functions = [],
  views = [],
  datasets = [],
  recordShapes = [];
let parseDiagnostics = 0;
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/dgi)) {
  const script = match[1];
  if (!script.trim()) continue;
  const offset = match.indices[1][0];
  const baseLine = html.slice(0, offset).split("\n").length - 1;
  const tree = ts.createSourceFile(
    "legacy-evidence.js",
    script,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  parseDiagnostics += tree.parseDiagnostics.length;
  const line = (node) =>
    baseLine + tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
  function structure(name, node, depth = 0) {
    if (depth > 2) return;
    if (ts.isArrayLiteralExpression(node)) {
      const columns = [
        ...new Set(
          node.elements
            .filter(ts.isObjectLiteralExpression)
            .flatMap((value) => fields(value, tree)),
        ),
      ];
      datasets.push({
        name,
        line: line(node),
        shape: "array",
        sourceEntryCount: node.elements.length,
        fields: columns,
      });
    } else if (ts.isObjectLiteralExpression(node)) {
      datasets.push({
        name,
        line: line(node),
        shape: "object",
        sourceEntryCount: null,
        fields: fields(node, tree),
      });
      for (const property of node.properties) {
        const key = keyName(property.name, tree);
        if (
          key &&
          safe(key) &&
          ts.isPropertyAssignment(property) &&
          (ts.isObjectLiteralExpression(property.initializer) ||
            ts.isArrayLiteralExpression(property.initializer))
        )
          structure(`${name}.${key}`, property.initializer, depth + 1);
      }
    } else
      datasets.push({
        name,
        line: line(node),
        shape: ts.SyntaxKind[node.kind],
        sourceEntryCount: null,
        fields: [],
      });
  }
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name)
      functions.push({ name: node.name.text, line: line(node) });
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const name = node.name.text;
      const object = node.initializer;
      if (name === "store")
        for (const property of object.properties) {
          const key = keyName(property.name, tree);
          if (key && safe(key) && ts.isPropertyAssignment(property))
            structure(key, property.initializer);
        }
      if (
        [
          "ADMIN",
          "HOME",
          "RENTER",
          "DRIVER",
          "SECURITY",
          "BOARD",
          "NAV",
        ].includes(name)
      )
        for (const property of object.properties) {
          const key = keyName(property.name, tree);
          if (key && safe(key))
            views.push({ workspace: name, page: key, line: line(property) });
        }
      const columns = fields(object, tree);
      if (
        ["item", "row", "fields", "r", "p", "rec"].includes(name) &&
        columns.length >= 6
      )
        recordShapes.push({ name, line: line(node), fields: columns });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
const tableReferences = [
  ...html.matchAll(/\.from\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g),
].map((match) => ({
  name: match[1],
  line: html.slice(0, match.index).split("\n").length,
}));
const rpcReferences = [
  ...html.matchAll(/\.rpc\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g),
].map((match) => ({
  name: match[1],
  line: html.slice(0, match.index).split("\n").length,
}));
const sourceFiles = [
  "index.html",
  "HOA-1.html",
  "privacy.html",
  "supabase-registrations.sql",
  "vercel.json",
].map((name) => {
  const bytes = fs.readFileSync(path.join(root, name));
  return {
    name,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
});
const commit = execFileSync(
  "git",
  [
    "-c",
    `safe.directory=${root.replaceAll("\\", "/")}`,
    "-C",
    root,
    "rev-parse",
    "HEAD",
  ],
  { encoding: "utf8" },
).trim();
const areas = [
  {
    name: "Accounts and registration",
    route: "/register",
    keys: ["accounts", "household", "linked"],
    evidence: [1097, 7146, 7262, 7313, 8324, 8432, 8474, 8522],
    features: [
      "Registration and proof review",
      "Invitations and manual login setup",
      "Household profiles",
      "Main and extra roles",
      "Profile/privacy preferences",
    ],
    gaps: [
      "Real auth and invitations",
      "Approved household verification",
      "Server-owned account changes",
    ],
  },
  {
    name: "Access and audit",
    route: "/office/access",
    keys: ["hiddenPages", "userAccess", "accessAdmins"],
    evidence: [2029, 6970, 7146, 7170, 8203, 8244, 8290],
    features: [
      "Role and page access",
      "Individual overrides",
      "Access managers",
      "View-only mode",
      "Account-change supporting references",
      "Audit search and history",
    ],
    gaps: [
      "Approved effective-permission rules",
      "RLS/RPC enforcement",
      "Protected server audit",
    ],
  },
  {
    name: "Announcements and inbox",
    route: "/office/community",
    keys: ["announcements", "notifs"],
    evidence: [3427, 3500, 3579, 4736, 4750, 4851, 5402],
    features: [
      "Audience-targeted and pinned notices",
      "Notice attachments, images and QR content",
      "Resident-office messaging",
      "Unread/conversation state",
      "Notifications",
    ],
    gaps: [
      "Approved publishing audiences",
      "Protected files",
      "Real message delivery and read state",
    ],
  },
  {
    name: "Properties and master data",
    route: "/office/residents",
    keys: ["units", "settings"],
    evidence: [2538, 2581, 7412, 7585, 7590],
    features: [
      "Lot and owner registry",
      "Occupancy and rate metadata",
      "Search and column mappings",
      "Unit import and export",
      "Approved master-data settings",
    ],
    gaps: [
      "Trusted registry and transfer rules",
      "Validated import review",
      "Versioned normalized tables",
    ],
  },
  {
    name: "Operations and support",
    route: "/office/operations",
    keys: ["requests", "complaints", "concerns", "tickets", "faqs"],
    evidence: [2659, 3635, 7944, 7958, 7976, 8171, 8184],
    features: [
      "Requests with assignment, priorities and replies",
      "Complaints and named-party handling",
      "Concerns and resident-office replies",
      "Support tickets",
      "FAQ/help and status dashboards",
    ],
    gaps: [
      "Distinct approved workflow definitions",
      "Confidentiality boundaries",
      "Escalation and delivery",
    ],
  },
  {
    name: "Amenities and calendar",
    route: "/services/calendar",
    keys: ["bookings", "amenityRules", "events", "calMonth"],
    evidence: [2760, 3069, 5335, 6728, 6798, 6803],
    features: [
      "Community events and combined calendar",
      "Amenity rules and facility selection",
      "Requests and booking decisions",
      "Booking status tables",
      "Fees/capacity and conflicts",
    ],
    gaps: [
      "Actual availability/conflict prevention",
      "Approved capacity, fees and cancellation",
      "Server confirmation",
    ],
  },
  {
    name: "Gate, visitors and vehicles",
    route: "/security",
    keys: ["passes", "stickers", "gatePasses", "guards", "secAdmin"],
    evidence: [2258, 4133, 4269, 5118, 5119, 5160, 5163, 5741, 7912],
    features: [
      "Visitor lookup and walk-ins",
      "Visitor and vehicle passes",
      "Separate gate-pass purposes/items",
      "Guard roster and security assignments",
      "Vehicle stickers and access history",
    ],
    gaps: [
      "Approved guard capabilities",
      "Pass validity and device events",
      "No real QR or gate authority in preview",
    ],
  },
  {
    name: "Incidents",
    route: "/security/incidents",
    keys: ["incidents"],
    evidence: [5182, 7926, 7940],
    features: [
      "Incident reporting and closure",
      "Location, evidence and responsible staff",
      "Restricted security review",
    ],
    gaps: [
      "Confidentiality and escalation",
      "Approved operational response",
      "Verified emergency contacts",
    ],
  },
  {
    name: "Billing and receipts",
    route: "/office/finance",
    keys: ["dues", "lotPayments", "ledger"],
    evidence: [1570, 6575, 6590, 7519, 7538, 7844, 7859],
    features: [
      "Billing modes and runs",
      "Dues and lot-payment histories",
      "Official-receipt/reference fields",
      "Statements and outstanding balances",
      "Payment entry/import mappings",
    ],
    gaps: [
      "Approved accounting definitions",
      "Server-owned receipts and allocations",
      "No payment gateway connected",
    ],
  },
  {
    name: "Expenses and reporting",
    route: "/office/finance/expenses",
    keys: ["expenses", "budget", "collectionsHistory", "reportLog"],
    evidence: [3004, 7599, 7614, 7630, 7666, 7700, 7767],
    features: [
      "Expense categories and approval",
      "Expense imports/templates",
      "Monthly expenses and budget",
      "Collection-history reports",
      "Report exports",
    ],
    gaps: [
      "Approved review/reversal policy",
      "Bank reconciliation",
      "Authorized real exports and file evidence",
    ],
  },
  {
    name: "Business and buy/sell",
    route: "/more/marketplace",
    keys: ["marketplace"],
    evidence: [1223, 1456, 3120, 5992, 6046],
    features: [
      "Resident businesses and owner profiles",
      "Business hours, contact and external links",
      "Buy/sell categories and listing photos",
      "Owner listing management",
      "Listing visibility and moderation",
    ],
    gaps: [
      "Detailed category-specific forms",
      "Provider verification/contact consent",
      "Moderation and protected media",
    ],
  },
  {
    name: "Jobs, garage sales and booths",
    route: "/more/marketplace",
    keys: ["marketplace", "boothEvents", "boothApps"],
    evidence: [
      1195, 1280, 1293, 3152, 3310, 3355, 6116, 6182, 6234, 6337, 6361, 6390,
    ],
    features: [
      "Hiring and service-seeking job listings",
      "Job setup, deadline and application link",
      "Garage sale schedules and item review",
      "Booth events and applications",
      "Vendor directory, numbered booth assignment and capacity",
    ],
    gaps: [
      "These detailed submodules are not fully implemented",
      "Approved fees/capacity/moderation",
      "Safe media/contact handling",
    ],
  },
  {
    name: "Training",
    route: "/more/training",
    keys: ["marketplace"],
    evidence: [5781, 5797, 5809, 5823],
    features: [
      "Training schedule and facilitator",
      "Capacity, fee and attendee counts",
      "Join/leave and enrollment states",
      "Training listing review",
    ],
    gaps: [
      "Detailed enrollment/capacity workflow",
      "Approved fees and personal-data scope",
      "No real session enrollment",
    ],
  },
  {
    name: "Rides and carpools",
    route: "/driver",
    keys: ["rides", "carpools"],
    evidence: [4969, 5012, 5071, 5547, 5603, 5636, 5660, 5683, 5703, 5713],
    features: [
      "Stations and dispatch queues",
      "Ride request/acceptance/progress",
      "Driver/vehicle assignment and pickup",
      "Trip histories",
      "Resident carpools and join/leave/cancel",
    ],
    gaps: [
      "Full dispatch and carpool workflow",
      "Verified driver/route/fare rules",
      "No real trip or seat authority",
    ],
  },
  {
    name: "Board documents and disclosures",
    route: "/board",
    keys: ["boardDocs", "boardDocs_note", "disclosures", "rules"],
    evidence: [5206, 5246, 5272, 6837],
    features: [
      "Board oversight and financial summaries",
      "Board document metadata and links",
      "Disclosures and house rules",
      "Governance reports",
    ],
    gaps: [
      "Approved official files and versions",
      "Protected role-specific access",
      "Trusted financial provenance",
    ],
  },
  {
    name: "Elections",
    route: "/more/elections",
    keys: ["election"],
    evidence: [4627, 5281, 8031, 8037, 8047, 8083],
    features: [
      "Candidate management and photos",
      "Election opening/closing",
      "Eligibility/participation presentation",
      "Ballot and tally presentation",
    ],
    gaps: [
      "Approved eligibility/proxy/secrecy design",
      "Server-owned ballot submission and tally",
      "No ballots or totals migrated",
    ],
  },
];
const sqlText = fs.readFileSync(
  path.join(root, "supabase-registrations.sql"),
  "utf8",
);
const sqlEvidence = {
  file: "supabase-registrations.sql",
  lines: sqlText.split(/\r?\n/).length - (sqlText.endsWith("\n") ? 1 : 0),
  table: "registrations",
  columns: sqlText.split(/\r?\n/).flatMap((text, index) => {
    const match = text.match(
      /^\s*([a-z_][a-z0-9_]*)\s+(uuid|timestamptz|text|integer|numeric|boolean)\b/i,
    );
    return match ? [{ name: match[1], type: match[2], line: index + 1 }] : [];
  }),
  requiredFunctions: [
    ...new Set(
      [...sqlText.matchAll(/public\.([a-z_][a-z0-9_]*)\(\s*\)/gi)].map(
        (match) => match[1],
      ),
    ),
  ],
  missingReferencedFiles: [
    ...new Set((html + "\n" + sqlText).match(/\b[a-zA-Z0-9_-]+\.sql\b/g) ?? []),
  ].filter((name) => !fs.existsSync(path.join(root, name))),
};
const output = {
  repository: "https://github.com/bfehoait/hoa",
  commit,
  snapshotDate: "2026-11-04",
  lines: html.split(/\r?\n/).length - (html.endsWith("\n") ? 1 : 0),
  functionCount: functions.length,
  rootStoreFieldCount: datasets.filter((item) => !item.name.includes("."))
    .length,
  identicalAppCopies: sourceFiles[0].sha256 === sourceFiles[1].sha256,
  parseDiagnostics,
  sourceFiles,
  areas,
  datasets,
  recordShapes,
  views,
  functions,
  tableReferences,
  rpcReferences,
  sqlEvidence,
  warning:
    "Static source metadata only. No data values, credentials, images, SQL execution or backend access. Preview coverage is partial; source defaults are not approved policy.",
};
fs.writeFileSync(
  "packages/shared/src/reference-inventory.json",
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    commit,
    lines: output.lines,
    functions: functions.length,
    rootStoreFields: output.rootStoreFieldCount,
    structures: datasets.length,
    recordShapes: recordShapes.length,
    viewEntries: views.length,
    areas: areas.length,
    parseDiagnostics,
  }),
);
