import { z } from "zod";
import { directoryMemberSchema } from "./people";

export const memberDetailsInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the recorded name.").max(120),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+0-9 () .-]*$/, "Check the phone number."),
    unit: z.string().trim().max(40),
    title: z.string().trim().max(120),
    reason: z.string().trim().min(3, "Enter a correction reason.").max(200),
  })
  .strict();
export const memberExpectedSchema = directoryMemberSchema.omit({
  last_seen: true,
});
const details = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  unit: z.string().nullable(),
  title: z.string().nullable(),
});
export const memberWorkspaceSchema = z.object({
  member: directoryMemberSchema,
  expected: memberExpectedSchema,
  auth_state: z.enum(["unlinked", "missing", "linked"]),
  can_edit: z.boolean(),
  can_link: z.boolean(),
  can_history: z.boolean(),
  can_view_properties: z.boolean(),
  profile: z
    .object({
      display_name: z.string(),
      phone: z.string(),
      updated_at: z.string(),
    })
    .nullable(),
  properties: z.array(
    z.object({
      membership_id: z.uuid(),
      lot_id: z.uuid(),
      physical_id: z.string(),
      relationship: z.string(),
      state: z.string(),
      starts_at: z.string(),
      expires_at: z.string().nullable(),
      reference: z.string(),
      active_import: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.uuid(),
      actor_id: z.uuid(),
      actor_name: z.string(),
      before_values: details,
      after_values: details,
      reason: z.string(),
      changed_at: z.string(),
    }),
  ),
  history_total: z.number().int().nonnegative(),
  link_history: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      action: z.string(),
      reference: z.string(),
      actor_name: z.string(),
      physical_id: z.string(),
      relationship: z.string(),
    }),
  ),
});
export type MemberWorkspace = z.infer<typeof memberWorkspaceSchema>;
