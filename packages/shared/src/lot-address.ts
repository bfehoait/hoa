import { z } from "zod";

export const lotAddressFields = [
  { name: "phase", label: "Phase", max: 3, width: 1 },
  { name: "block", label: "Block", max: 19, width: 2 },
  { name: "lot", label: "Lot", max: 111, width: 3 },
] as const;
export function lotLimitsForPhase(phase: unknown) {
  return Number(phase) === 2
    ? { block: 9, lot: 36 }
    : Number(phase) === 3
      ? { block: 1, lot: 54 }
      : { block: 19, lot: 111 };
}
export function refinePhaseLot(
  parts: { phase: number; block: number; lot: number },
  ctx: z.RefinementCtx,
) {
  const limits = lotLimitsForPhase(parts.phase);
  for (const key of ["block", "lot"] as const) {
    if (parts[key] > limits[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `Phase ${parts.phase}: ${key} must be 1–${limits[key]}.`,
      });
  }
}

export const lotPartsSchema = z
  .object({
    phase: z.coerce.number().int().min(1).max(3, "Choose phase 1–3."),
    block: z.coerce.number().int().min(1).max(19, "Choose block 01–19."),
    lot: z.coerce.number().int().min(1).max(111, "Choose lot 001–111."),
  })
  .superRefine(refinePhaseLot);

export function formatLotAddress(parts: z.input<typeof lotPartsSchema>) {
  const parsed = lotPartsSchema.safeParse(parts);
  if (!parsed.success) return "";
  const { phase, block, lot } = parsed.data;
  return `${phase}-${String(block).padStart(2, "0")}-${String(lot).padStart(3, "0")}`;
}

export const canonicalLotAddressSchema = z
  .string()
  .regex(
    /^[1-3]-(?:0[1-9]|1[0-9])-(?:00[1-9]|0[1-9][0-9]|10[0-9]|11[01])$/,
    "Choose phase 1–3, block 01–19 and lot 001–111 (for example, 1-01-005).",
  )
  .refine((value) => {
    const [phase, block, lot] = value.split("-").map(Number);
    const limits = lotLimitsForPhase(phase);
    return block <= limits.block && lot <= limits.lot;
  }, "Check the block and lot limits for the selected phase.");

// Accept the previous registration display when opening an older application.
// Out-of-range or unknown addresses must be reviewed by staff.
export function splitLotAddress(unit: string) {
  const match = unit
    .trim()
    .match(/^(?:P(\d+) B(\d+) L(\d+)|(\d+)-(\d+)-(\d+))$/);
  const parts = match
    ? {
        phase: match[1] ?? match[4],
        block: match[2] ?? match[5],
        lot: match[3] ?? match[6],
      }
    : { phase: "", block: "", lot: "" };
  const formatted = formatLotAddress(parts);
  const [phase = "", block = "", lot = ""] = formatted.split("-");
  return { phase, block, lot };
}
