import { z } from "zod";

export const publicationAudienceOptions = [
  { value: "homeowner", label: "Homeowners" },
  { value: "renter", label: "Renters" },
  { value: "board", label: "Board" },
  { value: "security", label: "Security" },
  { value: "driver", label: "Drivers" },
] as const;
export const publicationAudiencesSchema = z
  .array(
    z.enum(["members", "homeowner", "renter", "board", "security", "driver"]),
  )
  .min(1, "Select at least one audience.")
  .max(5)
  .refine(
    (values) => !values.includes("members") || values.length === 1,
    "Choose All members or specific audiences.",
  )
  .transform((values) => [...new Set(values)]);
