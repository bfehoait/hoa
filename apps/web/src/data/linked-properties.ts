import { z } from "zod";
import { useAuth } from "./auth";
import { useRegistryRpc } from "./registry";

const linkedPropertiesSchema = z.object({
  rows: z.array(
    z.object({
      lot_id: z.uuid(),
      physical_id: z.string(),
      phase: z.number().int(),
      block: z.number().int(),
      lot: z.number().int(),
      relationships: z.array(z.enum(["owner", "renter", "household"])),
      linear_park: z.enum(["yes", "no"]).nullable().default(null),
      monthly_dues_centavos: z
        .number()
        .int()
        .nonnegative()
        .nullable()
        .default(null),
    }),
  ),
});

/** Own links only, including for staff accounts with association-wide access. */
export function useLinkedPropertyAddress(enabled = true, poll = false) {
  const auth = useAuth();
  const query = useRegistryRpc(
    "bfe_my_linked_properties",
    {},
    linkedPropertiesSchema,
    enabled,
    { refetchInterval: poll && !auth.memberPreview ? 30000 : false },
  );
  const unit = auth.member?.unit?.trim();
  const recordedAddress =
    unit && !/^(n\/?a|none|-+)$/i.test(unit) ? unit : null;
  const properties = query.isError ? [] : (query.data?.rows ?? []);
  const address = properties.length
    ? properties
        .map((p) => `Phase ${p.phase} · Block ${p.block} · Lot ${p.lot}`)
        .join("; ")
    : (recordedAddress ??
      (query.isError
        ? "Linked properties unavailable"
        : query.isPending && !auth.preview && !auth.rolePreview
          ? "Checking property links…"
          : "Address not recorded"));
  return { ...query, properties, address, recordedAddress };
}
