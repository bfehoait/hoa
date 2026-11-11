import type { SupabaseClient } from "@supabase/supabase-js";
export function accountPreviewScope(path: string) {
  const match = /^\/developer\/account-preview\/([0-9a-f-]{36})(?:\/|$)/i.exec(
    path,
  );
  return match
    ? { id: match[1], basename: `/developer/account-preview/${match[1]}` }
    : null;
}
export const accountPreview =
  typeof window === "undefined"
    ? null
    : accountPreviewScope(window.location.pathname);
const reads = new Set([
  "bfe_get_member",
  "bfe_get_profile",
  "bfe_my_access",
  "bfe_my_notifications",
  "bfe_list_lots",
  "bfe_my_linked_properties",
  "bfe_my_hoa_balance",
  "bfe_lot_detail",
  "bfe_lot_receipts",
  "bfe_staff_directory",
  "bfe_access_members",
  "bfe_member_assignments",
  "bfe_monitor_module",
  "bfe_feature_dashboard",
  "bfe_booking_dashboard",
  "bfe_booking_availability",
  "bfe_visitor_dashboard",
  "bfe_workflow_history",
  "bfe_participation_dashboard",
  "bfe_shuttle_dashboard",
  "bfe_preview_requests",
  "bfe_preview_request_thread",
  "bfe_listing_media",
]);
export function readOnlyPreviewClient(
  client: SupabaseClient,
  scope = accountPreview,
): SupabaseClient {
  if (!scope) return client;
  return new Proxy(client, {
    get(target, property) {
      if (property === "rpc")
        return (name: string, args: Record<string, unknown> = {}) => {
          if (!reads.has(name))
            throw new Error("Read-only account preview: changes are disabled.");
          return target.rpc("bfe_account_preview_read", {
            p_session: scope.id,
            p_name: name,
            p_args: args,
          });
        };
      throw new Error(
        "Direct account access is disabled in read-only preview.",
      );
    },
  });
}
