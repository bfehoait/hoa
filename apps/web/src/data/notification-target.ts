import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { featureRpc } from "./feature-records";
import { useAuth } from "./auth";
import { useAccountActions } from "./accounts";

export function useReadOpenedNotification(found: boolean) {
  const [params] = useSearchParams();
  const id = z.uuid().safeParse(params.get("notification")).data;
  const { mutate } = useAccountActions().markRead;
  useEffect(() => {
    if (found && id) mutate([id]);
  }, [found, id, mutate]);
}

// An exact owned-record read, independent of dashboard pagination. Its server
// endpoint reuses the existing authorized dashboards; no role is set here.
export function useNotificationTarget<T>(
  kind: "booking" | "visitor" | "feature" | "participation",
  schema: z.ZodType<T>,
  module = "",
  enabled = true,
) {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const rawId = params.get("record");
  const id = z.uuid().safeParse(rawId).data;
  const live = !auth.preview && !auth.rolePreview && !auth.memberPreview;
  const query = useQuery({
    queryKey: ["notification-target", auth.userId, kind, id, module],
    enabled:
      enabled &&
      live &&
      !!id &&
      !!auth.userId &&
      !auth.checking &&
      !auth.memberError,
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const record = await featureRpc("bfe_open_notification_record", {
        p_kind: kind,
        p_id: id,
        p_module: module || null,
      });
      return record === null ? null : schema.parse(record);
    },
  });
  return {
    ...query,
    requested: enabled && !!rawId,
    unavailable:
      enabled &&
      !!rawId &&
      (!id || !live || (query.isSuccess && query.data === null)),
    clear: () => {
      const next = new URLSearchParams(params);
      next.delete("record");
      next.delete("notification");
      setParams(next, { replace: true });
    },
  };
}
