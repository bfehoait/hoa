import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accountPreviewScope,
  readOnlyPreviewClient,
} from "../../../apps/web/src/data/account-preview-client";
it("keeps normal clients intact and binds preview reads to the owner-bound session", () => {
  const rpc = vi.fn(() => ({ data: [] }));
  const client = { rpc } as unknown as SupabaseClient;
  expect(readOnlyPreviewClient(client, null)).toBe(client);
  const scope = accountPreviewScope(
    "/developer/account-preview/88000000-0000-4000-8000-000000000001/services/requests",
  );
  expect(scope?.basename).toBe(
    "/developer/account-preview/88000000-0000-4000-8000-000000000001",
  );
  const preview = readOnlyPreviewClient(client, scope);
  preview.rpc("bfe_preview_requests", { p_page: 1 });
  expect(rpc).toHaveBeenCalledWith("bfe_account_preview_read", {
    p_session: scope!.id,
    p_name: "bfe_preview_requests",
    p_args: { p_page: 1 },
  });
});
it("refuses raw tables, Auth, storage, function APIs and mutation RPCs before sending a request", () => {
  const rpc = vi.fn();
  const preview = readOnlyPreviewClient({ rpc } as unknown as SupabaseClient, {
    id: "88000000-0000-4000-8000-000000000001",
    basename: "/developer/account-preview/test",
  });
  for (const name of [
    "bfe_create_request",
    "bfe_save_profile",
    "bfe_mark_notifications",
    "bfe_account_preview_read",
    "bfe_update_shuttle_request",
  ])
    expect(() => preview.rpc(name, {})).toThrow(/disabled/);
  expect(() => preview.from("bfe_requests")).toThrow(/disabled/);
  expect(() => preview.auth).toThrow(/disabled/);
  expect(() => preview.storage).toThrow(/disabled/);
  expect(() => preview.functions).toThrow(/disabled/);
  expect(rpc).not.toHaveBeenCalled();
});
