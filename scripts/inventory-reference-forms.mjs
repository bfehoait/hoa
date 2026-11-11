import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";

// Static metadata extraction only. Never evaluate, import or render reference code.
// Output contains control identifiers, owner symbols and evidence lines, not values.
const file = "reference/upstream-hoa/index.html";
const html = fs.readFileSync(file, "utf8");
const functions = [];
const symbol = (node) => {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (
    (ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)) &&
    parent.name &&
    ts.isIdentifier(parent.name)
  )
    return parent.name.text;
  return "anonymous";
};
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/dgi)) {
  const offset = match.indices[1][0];
  const tree = ts.createSourceFile(
    "reference.js",
    match[1],
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (tree.parseDiagnostics.length)
    throw new Error("Reference parse requires review.");
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      functions.push({
        symbol: symbol(node),
        start: offset + node.getStart(tree),
        end: offset + node.end,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
const owners = new Map();
const unique = new Set();
let controlTags = 0;
for (const match of html.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)) {
  const identifiers = [
    ...match[0].matchAll(/\b(?:name|id)=["']([A-Za-z_][\w.-]*)["']/gi),
  ].map((m) => m[1]);
  if (!identifiers.length) continue;
  controlTags++;
  const owner = functions
    .filter((f) => f.start <= match.index && f.end > match.index)
    .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
  const line = html.slice(0, match.index).split("\n").length;
  const key = owner ? `${owner.symbol}:${owner.start}` : "static";
  if (!owners.has(key))
    owners.set(key, {
      owner: owner?.symbol ?? "static",
      firstControlLine: line,
      controls: new Set(),
    });
  for (const id of identifiers) {
    owners.get(key).controls.add(id);
    unique.add(id);
  }
}
const currentFile = "packages/shared/src/baseline.ts";
const currentSource = fs.readFileSync(currentFile, "utf8");
const tree = ts.createSourceFile(
  currentFile,
  currentSource,
  ts.ScriptTarget.Latest,
  true,
);
const currentModules = [];
const visit = (node) => {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    const fields = [];
    const field = (n) => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        ["field", "select", "number"].includes(n.expression.text) &&
        ts.isStringLiteral(n.arguments[0])
      )
        fields.push(n.arguments[0].text);
      ts.forEachChild(n, field);
    };
    field(node.arguments[4]);
    currentModules.push({
      module: node.arguments[0].text,
      line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
      fields,
    });
  }
  ts.forEachChild(node, visit);
};
visit(tree);
// Additive project-owned form questions live outside the original module array.
// Parse their identifiers without executing either project or reference code.
const additionsFile = "packages/shared/src/business-form-fields.ts";
const additionsTree = ts.createSourceFile(
  additionsFile,
  fs.readFileSync(additionsFile, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const collectAdditions = (node) => {
  if (
    ts.isPropertyAssignment(node) &&
    ts.isArrayLiteralExpression(node.initializer)
  ) {
    const key =
      ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
        ? node.name.text
        : null;
    const entry = currentModules.find((m) => m.module === key);
    if (entry) {
      const keys = [];
      const collect = (n) => {
        if (
          ts.isCallExpression(n) &&
          ts.isIdentifier(n.expression) &&
          ["text", "choices"].includes(n.expression.text) &&
          ts.isStringLiteral(n.arguments[0])
        )
          keys.push(n.arguments[0].text);
        ts.forEachChild(n, collect);
      };
      collect(node.initializer);
      entry.additionalFields = [...new Set(keys)];
    }
  }
  ts.forEachChild(node, collectAdditions);
};
collectAdditions(additionsTree);
const output = {
  referenceFile: file,
  referenceSha256: crypto.createHash("sha256").update(html).digest("hex"),
  method:
    "Static literal input/select/textarea identifiers grouped by enclosing function. Search/filter controls and helpers included; dynamically generated controls may be omitted. Not a count of complete business forms or field parity.",
  controlTagCount: controlTags,
  distinctControlIdentifiers: unique.size,
  referenceOwners: [...owners.values()].map((row) => ({
    ...row,
    controls: [...row.controls].sort(),
  })),
  currentCatalogFile: currentFile,
  currentAdditionalQuestionsFile: additionsFile,
  currentCatalogModules: currentModules,
  limitations:
    "Current dedicated forms are assessed separately in docs/LEGACY-FORM-COVERAGE-ASSESSMENT.md. A catalog entry is not proof of routing, permission, persistence or fulfillment. No live state was inspected.",
};
fs.writeFileSync(
  "docs/legacy-form-control-inventory.json",
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    controlTags,
    distinctIdentifiers: unique.size,
    referenceControlOwners: owners.size,
    currentCatalogModules: currentModules.length,
  }),
);
