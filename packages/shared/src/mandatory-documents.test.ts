import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { mandatoryDocumentFiles } from "./mandatory-documents";
import { mandatoryDocuments } from "./request-topics";

it("has a sample PDF for every mandatory document, matching migration 092", () => {
  expect(mandatoryDocumentFiles).toHaveLength(7);
  expect(new Set(mandatoryDocumentFiles.map((d) => d.file)).size).toBe(7);
  expect(mandatoryDocuments).toEqual(mandatoryDocumentFiles.map((d) => d.name));
  const migration = readFileSync(
    new URL(
      "../../../supabase/migrations/202611230092_mandatory_document_downloads.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const { name, file } of mandatoryDocumentFiles) {
    const pdf = new URL(
      `../../../public/documents/mandatory/${file}`,
      import.meta.url,
    );
    expect(existsSync(pdf), file).toBe(true);
    expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(migration).toContain(`'${name}'`);
  }
});
