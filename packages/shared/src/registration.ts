import { z } from "zod";
import { lotPartsSchema, refinePhaseLot } from "./lot-address";
const answer = z.enum(["not_provided", "yes", "no"]);
export const householdPersonSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    relationship: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(40),
    senior: answer,
    pwd: answer,
  })
  .strict();
export const registrationSchema = z
  .object({
    clientId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
    phone: z.string().trim().min(7).max(40),
    role: z.enum(["homeowner", "renter"]),
    ...lotPartsSchema.shape,
    street: z.string().trim().max(120),
    ownerName: z.string().trim().min(1).max(120),
    proof: z.string().trim().max(60).optional(),
    proofRef: z.string().trim().max(120).optional(),
    healthNote: z.string().trim().max(1000).default(""),
    note: z.string().trim().max(1000),
    senior: answer,
    pwd: answer,
    household: z.array(householdPersonSchema).max(20),
    consent: z.literal(true),
    website: z.literal(""),
  })
  .strict()
  .superRefine(refinePhaseLot);
export type MembershipApplication = z.infer<typeof registrationSchema>;
