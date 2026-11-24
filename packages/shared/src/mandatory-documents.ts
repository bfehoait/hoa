import list from "./mandatory-documents.json";
import inspection from "./inspection-records.json";

// Community documents residents can view on screen; downloading needs an
// approved request (owner request, 24 November 2026; migration 093).
// Each has a PDF in public/documents/mandatory (SAMPLE files until the office
// supplies approved ones). Names must match bfe_community_documents (093).
export const mandatoryDocumentFiles: readonly { name: string; file: string }[] =
  list;
export const inspectionRecordFiles: readonly {
  table: string;
  group: string | null;
  name: string;
  file: string;
}[] = inspection;
export const communityDocumentFiles = [
  ...mandatoryDocumentFiles,
  ...inspectionRecordFiles,
];
export const mandatoryDocumentHref = (file: string) =>
  `/documents/mandatory/${file}`;
