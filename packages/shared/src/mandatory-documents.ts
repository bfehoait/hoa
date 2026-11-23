import list from "./mandatory-documents.json";

// Documents the Board must post in common areas (owner list, 19 November 2026).
// Each has a downloadable PDF in public/documents/mandatory (SAMPLE files until
// the office supplies approved ones). Names must match migration 092.
export const mandatoryDocumentFiles: readonly { name: string; file: string }[] =
  list;
export const mandatoryDocumentHref = (file: string) =>
  `/documents/mandatory/${file}`;
