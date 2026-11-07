import { rolePreviewScope } from "../../../../packages/shared/src/auth";
import { accountPreview } from "./account-preview-client";

export const previewScope =
  typeof window === "undefined"
    ? null
    : rolePreviewScope(window.location.pathname);
export function sampleStorageKey(base: string) {
  if (accountPreview)
    return `bellefort-account-preview:${accountPreview.id}:${base}`;
  return previewScope
    ? `bellefort-role-preview:${previewScope.role}:${base}`
    : base;
}
