import { z } from "zod";

export const shuttleCodes = [
  "Shuttle 1",
  "Shuttle 2",
  "Alternate Shuttle",
] as const;
export const shuttleStatuses = [
  "Waiting for Shuttle",
  "Accepted",
  "On the way",
  "Arrived",
  "Picked up",
  "Lapsed / Unserved",
  "Cancelled",
  "Passenger absent",
] as const;
export const shuttleInput = z.object({
  pickup: z.string().trim().min(3).max(200),
  destination: z.string().trim().min(3).max(200),
  passengers: z.coerce.number().int().min(1).max(20),
  pickup_note: z.string().trim().max(1000).optional(),
});
export const shuttleRequestSchema = shuttleInput.extend({
  driver_name: z.string().nullable().optional(),
  driver_note: z.string().optional(),
  estimated_arrival: z.string().nullable().optional(),
  id: z.uuid(),
  owner_id: z.uuid(),
  driver_id: z.uuid().nullable(),
  shuttle_code: z.enum(shuttleCodes).nullable(),
  status: z.enum(shuttleStatuses),
  created_at: z.string(),
  expires_at: z.string(),
  arrived_at: z.string().nullable(),
  version: z.number().int().positive(),
  reason: z.string().nullable(),
  prior_day: z.boolean(),
});
export const shuttleDashboardSchema = z.object({
  prior_day_request: z
    .object({
      id: z.uuid(),
      version: z.number().int().positive(),
      status: z.enum(shuttleStatuses),
      expires_at: z.string(),
    })
    .nullable()
    .optional(),
  server_now: z.string(),
  driver: z.boolean(),
  reviewer: z.boolean(),
  manager: z.boolean(),
  total: z.number().int().nonnegative(),
  waiting_count: z.number().int().nonnegative(),
  rows: z.array(shuttleRequestSchema),
  latest_outcome: z
    .object({ status: z.enum(shuttleStatuses), at: z.string() })
    .nullable(),
  shuttles: z.array(
    z.object({
      code: z.enum(shuttleCodes),
      driver_name: z.string(),
      capacity: z.number().int().min(1).max(50),
      on_duty: z.boolean(),
      available: z.boolean(),
      ready: z.boolean(),
      contact: z.string().regex(/^(\+[0-9]{8,15})?$/),
      active: z.boolean(),
      busy: z.boolean(),
      driver_id: z.uuid().nullable(),
    }),
  ),
  eligible_drivers: z.array(
    z.object({ id: z.uuid(), name: z.string().nullable() }),
  ),
});
export type ShuttleDashboard = z.infer<typeof shuttleDashboardSchema>;
export type ShuttleRequest = z.infer<typeof shuttleRequestSchema>;

export function shuttleActions(
  row: ShuttleRequest,
  own: boolean,
  driver: boolean,
  userId: string,
  now: number,
) {
  const active = [
    "Waiting for Shuttle",
    "Accepted",
    "On the way",
    "Arrived",
  ].includes(row.status);
  if (
    !active ||
    (row.status !== "Arrived" && Date.parse(row.expires_at) <= now)
  )
    return [];
  const actions: string[] = own ? ["Cancelled"] : [];
  if (!driver) return actions;
  if (row.status === "Waiting for Shuttle") actions.push("Accepted");
  if (row.driver_id !== userId) return actions;
  if (row.status === "Accepted") actions.push("On the way");
  if (row.status === "On the way") actions.push("Arrived");
  if (row.status === "Arrived") {
    actions.push("Picked up");
    if (row.arrived_at && now >= Date.parse(row.arrived_at) + 300_000)
      actions.push("Passenger absent");
  }
  return actions;
}
