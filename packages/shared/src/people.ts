import { z } from "zod";

// Explicit field lists: never fetch passwords, Auth metadata or registration proof.
export const directoryFields =
  "id,user_id,name,email,phone,unit,title,role,extra_roles,status,last_seen";
export const applicationFields =
  "id,name,email,phone,unit,role,status,created_at,review_note";
export const directoryMemberSchema = z.object({
  id: z.string().min(1),
  user_id: z.uuid().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  unit: z.string().nullable(),
  title: z.string().nullable(),
  role: z.string(),
  extra_roles: z.array(z.string()).nullable(),
  status: z.string(),
  last_seen: z.string().nullable(),
});
export const applicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  unit: z.string().nullable(),
  role: z.string().nullable(),
  status: z.string(),
  created_at: z.string().nullable(),
  review_note: z.string().nullable(),
});
export type DirectoryMember = z.infer<typeof directoryMemberSchema>;
export type DirectoryApplication = z.infer<typeof applicationSchema>;
export const peoplePageSize = 20;
export function literalSearch(value: string) {
  return value
    .trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&");
}
export function assignedRoleLabels(member: DirectoryMember) {
  return [...new Set([member.role, ...(member.extra_roles ?? [])])];
}
