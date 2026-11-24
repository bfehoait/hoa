import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  communityDocumentFiles,
  inspectionRecordFiles,
  mandatoryDocumentFiles,
} from "./mandatory-documents";
import { mandatoryDocuments } from "./request-topics";

it("has a sample PDF for every community document, matching migration 093", () => {
  expect(mandatoryDocumentFiles).toHaveLength(7);
  expect(inspectionRecordFiles).toHaveLength(10);
  expect(new Set(communityDocumentFiles.map((d) => d.file)).size).toBe(17);
  expect(mandatoryDocuments).toEqual(mandatoryDocumentFiles.map((d) => d.name));
  const migration = readFileSync(
    new URL(
      "../../../supabase/migrations/202611240093_document_download_requests.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const { name, file } of communityDocumentFiles) {
    const pdf = new URL(
      `../../../public/documents/mandatory/${file}`,
      import.meta.url,
    );
    expect(existsSync(pdf), file).toBe(true);
    expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(migration).toContain(`('${name}','`);
    expect(migration).toContain(`','${file}')`);
  }
});
