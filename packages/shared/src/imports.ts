import { baselineSchema } from "./baseline";

// CSV is parsed as text only. No spreadsheet or uploaded file code is evaluated.
export function parseSampleCsv(input: string) {
  if (input.length > 100000)
    throw new Error("Use a sample CSV smaller than 100 KB.");
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    afterQuote = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else cell += char;
    } else if (char === '"') {
      if (cell || afterQuote)
        throw new Error(
          "A quoted CSV value must start at the beginning of a cell.",
        );
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
      afterQuote = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      afterQuote = false;
    } else {
      if (afterQuote)
        throw new Error("Unexpected content after a closing CSV quote.");
      cell += char;
    }
  }
  if (quoted) throw new Error("A CSV quoted value is not closed.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2)
    throw new Error("Include a header and at least one sample data row.");
  if (rows.length > 101)
    throw new Error("Use at most 100 sample data rows per staging batch.");
  const headers = rows.shift()!.map((value) => value.trim());
  if (
    headers.some((value) => !value) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("CSV headers must be unique and non-empty.");
  if (headers.length > 20 || headers.some((value) => value.length > 100))
    throw new Error("Use at most 20 short column headers.");
  if (rows.some((value) => value.length !== headers.length))
    throw new Error(
      "Every CSV row must contain the same number of cells as the header.",
    );
  return { headers, rows };
}
export const importTemplates = {
  units: {
    title: "Property register",
    module: "unit-register",
    columns: ["unit", "owner", "area", "occupancy"],
    example: ["Demo A-09", "Demo Owner", "120", "Unknown"],
  },
  payments: {
    title: "Payment evidence",
    module: "payment-evidence",
    columns: ["unit", "date", "amount", "reference", "method", "allocation"],
    example: [
      "Demo A-09",
      "2026-11-04",
      "1500.00",
      "DEMO-REF-01",
      "Bank transfer",
      "Demo invoice",
    ],
  },
  expenses: {
    title: "Expense evidence",
    module: "expense-evidence",
    columns: ["date", "category", "amount", "reference"],
    example: ["2026-11-04", "Demo maintenance", "450.00", "DEMO-DOC-01"],
  },
} as const;
export type ImportKind = keyof typeof importTemplates;
export function validateImport(
  kind: ImportKind,
  csv: ReturnType<typeof parseSampleCsv>,
  mapping: Record<string, string>,
) {
  const template = importTemplates[kind];
  const mapped = template.columns.map((key) => mapping[key]);
  if (
    mapped.some((header) => !csv.headers.includes(header)) ||
    new Set(mapped).size !== mapped.length
  )
    throw new Error("Map every required field to a different CSV column.");
  const seen = new Set<string>();
  return csv.rows.map((row, index) => {
    const fields = Object.fromEntries(
      template.columns.map((key) => [
        key,
        row[csv.headers.indexOf(mapping[key])].trim(),
      ]),
    );
    const errors: string[] = [];
    const identity = kind === "units" ? fields.unit : fields.reference;
    if (seen.has(identity))
      errors.push(
        "Duplicate unit or evidence reference within this sample batch.",
      );
    seen.add(identity);
    if (fields.unit && !/^Demo [A-Z]-\d{2}$/.test(fields.unit))
      errors.push("Unit must use the synthetic format Demo A-09.");
    if (fields.owner && !fields.owner.startsWith("Demo "))
      errors.push("Owner must be an invented label starting with Demo.");
    if (!fields.reference && kind !== "units")
      errors.push("Add a synthetic evidence reference.");
    if (fields.reference && !fields.reference.startsWith("DEMO-"))
      errors.push("Evidence references must start with DEMO-.");
    const input = {
      title: `Sample ${template.title.toLowerCase()} · row ${index + 1}`,
      detail:
        "Synthetic CSV staging record. Not verified, posted or submitted to the HOA.",
      fields,
    };
    const validation = baselineSchema(template.module).safeParse(input);
    if (!validation.success)
      errors.push(
        ...validation.error.issues.map(
          (issue) => `${String(issue.path.at(-1))}: ${issue.message}`,
        ),
      );
    return { row: index + 1, input, errors };
  });
}
