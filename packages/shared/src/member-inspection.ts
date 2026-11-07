import { z } from "zod";
import { capabilitySchema } from "./permissions";
export const inspectionSections = [
  "requests",
  "submissions",
  "bookings",
  "visitor-passes",
  "shuttle",
  "participation",
] as const;
export const inspectionSessionSchema = z.object({
  id: z.uuid(),
  expires_at: z.string(),
});
export const memberInspectionSchema = z.object({
  read_only: z.literal(true),
  server_now: z.string(),
  expires_at: z.string(),
  member: z.object({
    user_id: z.uuid(),
    name: z.string().nullable(),
    unit: z.string().nullable(),
    role: z.string(),
    extra_roles: z.array(z.string()).nullable(),
    status: z.string(),
  }),
  active_roles: z.array(z.string()),
  capabilities: z.array(capabilitySchema),
  rows: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      detail: z.string(),
      status: z.string(),
      created_at: z.string(),
    }),
  ),
  total: z.number().int(),
});
