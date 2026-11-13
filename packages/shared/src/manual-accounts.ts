import { z } from "zod";
import { canonicalLotAddressSchema } from "./lot-address.ts";

export const manualAccountRoles = [
  "homeowner",
  "renter",
  "admin",
  "board",
  "security",
  "driver",
] as const;
export const manualAccountRoleLabels: Record<string, string> = {
  homeowner: "Homeowner",
  renter: "Renter",
  admin: "Office admin",
  board: "Board member",
  security: "Security",
  driver: "Driver",
};
export const manualAccountSchema = z
  .object({
    requestId: z.uuid(),
    registrationId: z.uuid().optional(),
    name: z.string().trim().min(1, "Enter their name.").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .pipe(z.email("Enter a valid email address.")),
    role: z.enum(manualAccountRoles),
    unit: z.string().trim().max(40),
    password: z.string().min(12, "Use at least 12 characters.").max(128),
    reason: z
      .string()
      .trim()
      .min(3, "Enter a reason of at least 3 characters.")
      .max(200),
  })
  .strict()
  .refine(
    (value) =>
      (value.unit === "" && !["homeowner", "renter"].includes(value.role)) ||
      canonicalLotAddressSchema.safeParse(value.unit).success,
    {
      path: ["unit"],
      message:
        "Enter a valid phase-block-lot address within the selected phase's limits.",
    },
  );
export type ManualAccountInput = z.infer<typeof manualAccountSchema>;

export const deleteAccountSchema = z
  .object({
    operation: z.literal("delete"),
    requestId: z.uuid(),
    userId: z.uuid(),
    confirmation: z.string().min(1).max(120),
    reason: z.string().trim().min(3).max(200),
    expected: z
      .object({
        name: z.string().nullable(),
        unit: z.string().nullable(),
        role: z.string(),
        extra_roles: z.array(z.string()).nullable(),
        status: z.string(),
      })
      .strict(),
  })
  .strict();
