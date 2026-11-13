import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  lotPageSchema,
  lotDetailSchema,
  receiptPageSchema,
} from "../../../../packages/shared/src/registry";
import { makeClient, useAuth } from "./auth";

export function registryError(
  error: { code?: string } | null,
  readName?: string,
) {
  if (!error) return;
  if (
    readName === "bfe_my_account_balance" &&
    ["PGRST202", "42883", "42P01"].includes(error.code ?? "")
  )
    throw new Error(
      "Your account balance is currently unavailable. Please contact the HOA office for help.",
    );
  if (
    readName === "bfe_my_hoa_balance" &&
    ["PGRST202", "42883", "42P01"].includes(error.code ?? "")
  )
    throw new Error(
      "Your HOA balance is currently unavailable. Please contact the HOA office for help.",
    );
  if (
    ["bfe_private_health_note", "bfe_staff_linked_properties"].includes(
      readName ?? "",
    ) &&
    ["PGRST202", "42883", "42P01"].includes(error.code ?? "")
  )
    throw new Error(
      "Member details are currently unavailable. Please contact the HOA office for help.",
    );
  if (readName === "bfe_lot_receipts") {
    throw new Error(
      error.code === "42501"
        ? "Payment history access could not be verified. Contact the office."
        : error.code === "22023"
          ? "Check the payment date range."
          : "Payment records could not be loaded. Please contact the HOA office for help.",
    );
  }
  if (["42883", "42P01", "PGRST202", "PGRST205"].includes(error.code ?? ""))
    throw new Error(
      "Property details are currently unavailable. Please contact the HOA office for help.",
    );
  if (
    ["bfe_my_linked_properties", "bfe_list_lots", "bfe_lot_detail"].includes(
      readName ?? "",
    )
  )
    throw new Error(
      error.code === "42501"
        ? "Your property access could not be verified. Please contact the HOA office for help."
        : error.code === "22023" && readName === "bfe_list_lots"
          ? "Check the lot search filters and try again."
          : "Your property records could not be loaded. Try again or contact the HOA office for help.",
    );
  if (readName)
    throw new Error(
      error.code === "42501"
        ? "Your account cannot view these records. Please contact the HOA office for help."
        : "These records could not be loaded. Try again or contact the HOA office for help.",
    );
  if (error.code === "40001")
    throw new Error("This record changed. Refresh before saving.");
  if (error.code === "42501")
    throw new Error(
      "Your account cannot perform this operation. Ask an authorized reviewer.",
    );
  throw new Error(
    "The operation could not be confirmed. Refresh to check the saved record before retrying.",
  );
}
export function useRegistryRpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  enabled = true,
  options?: { refetchInterval?: number | false },
) {
  const auth = useAuth();
  return useQuery({
    queryKey: ["registry", auth.userId, auth.rolePreview, name, args],
    enabled:
      enabled &&
      !auth.preview &&
      !auth.rolePreview &&
      !!auth.userId &&
      !auth.checking &&
      !auth.memberPending &&
      !auth.memberError,
    gcTime: 300_000,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: options?.refetchInterval,
    queryFn: async ({ signal }) => {
      const client = makeClient();
      if (!client) throw new Error("Sign-in is not connected.");
      const { data, error } = await client.rpc(name, args).abortSignal(signal);
      registryError(error, name);
      const parsed = schema.safeParse(data);
      if (!parsed.success)
        throw new Error("The registry response could not be verified.");
      return parsed.data;
    },
  });
}
export const useLots = (args: Record<string, unknown>) =>
  useRegistryRpc("bfe_list_lots", args, lotPageSchema);
export const useLot = (id: string) =>
  useRegistryRpc(
    "bfe_lot_detail",
    { p_lot: id },
    lotDetailSchema,
    z.uuid().safeParse(id).success,
  );
export const useReceipts = (args: Record<string, unknown>, enabled = true) =>
  useRegistryRpc("bfe_lot_receipts", args, receiptPageSchema, enabled);
export function useRegistryAction() {
  const client = useQueryClient();
  const auth = useAuth();
  return useMutation({
    mutationFn: async ({
      name,
      args,
    }: {
      name: string;
      args: Record<string, unknown>;
    }) => {
      if (auth.preview || auth.rolePreview)
        throw new Error("Role previews never change real registry records.");
      const api = makeClient();
      if (!api) throw new Error("Sign-in is not connected.");
      const { error } = await api.rpc(name, args);
      registryError(error);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["registry"] }),
  });
}
