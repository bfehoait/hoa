import { z } from "zod";
export const facilitySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  opens: z.string(),
  closes: z.string(),
  slot_minutes: z.number().int(),
  max_minutes: z.number().int(),
  capacity: z.number().int(),
  renters: z.boolean(),
  active: z.boolean(),
  policy_reference: z.string(),
});
export const bookingSchema = z.object({
  id: z.uuid(),
  facility_id: z.uuid(),
  facility_name: z.string(),
  purpose: z.string(),
  attendees: z.number().int(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(["Pending", "Approved", "Rejected", "Cancelled"]),
  version: z.number().int(),
});
export const bookingDashboardSchema = z.object({
  rows: z.array(bookingSchema),
  total: z.number().int(),
  facilities: z.array(facilitySchema),
  can_manage: z.boolean(),
  can_approve: z.boolean(),
});
export const visitorPassSchema = z.object({
  id: z.uuid(),
  visitor: z.string(),
  purpose: z.string(),
  plate: z.string(),
  physical_id: z.string(),
  valid_from: z.string(),
  valid_until: z.string(),
  status: z.enum([
    "Pending",
    "Approved",
    "Rejected",
    "Cancelled",
    "Entered",
    "Exited",
  ]),
  effective_status: z.string(),
  version: z.number().int(),
  pass_kind: z.enum(["visitor", "gate", "small_delivery"]).optional(),
  arrival_mode: z.enum(["commute", "vehicle"]).optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  party_count: z.number().int().optional(),
  items: z.string().optional(),
});
export const visitorDashboardSchema = z.object({
  rows: z.array(visitorPassSchema),
  total: z.number().int(),
  can_create: z.boolean(),
  can_approve: z.boolean(),
  can_gate: z.boolean(),
  lots: z.array(
    z.object({
      id: z.uuid(),
      physical_id: z.string(),
      homeowner: z.string().nullable().optional(),
      phase: z.number().optional(),
      block: z.number().optional(),
      lot: z.number().optional(),
    }),
  ),
});
export type Booking = z.infer<typeof bookingSchema>;
export type VisitorPass = z.infer<typeof visitorPassSchema>;
export function manilaInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Choose a date and time in Philippine time.");
  const date = new Date(value + ":00+08:00");
  if (!Number.isFinite(date.getTime()))
    throw new Error("Choose a valid date and time.");
  return date.toISOString();
}
