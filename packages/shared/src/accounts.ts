import { z } from "zod";

export const profilePreferencesSchema = z.object({
  display_name: z.string().trim().max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, "Use a valid contact number."),
  bio: z.string().trim().max(240),
});
export const ownProfileSchema = profilePreferencesSchema.extend({
  updated_at: z.string().nullable(),
});
export const notificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["request", "account", "access", "community", "shuttle"]),
  title: z.string(),
  body: z.string(),
  path: z.enum([
    "/services/requests",
    "/office/requests",
    "/more/profile",
    "/developer/access",
    "/more/notifications",
    "/more/transport",
    "/driver/dispatch",
  ]),
  created_at: z.string(),
  read_at: z.string().nullable(),
});
export const notificationsSchema = z.object({
  rows: z.array(notificationSchema),
  total: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
});
export type AppNotification = z.infer<typeof notificationSchema>;
export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;
export function notificationGroup(
  item: AppNotification,
  now = new Date(),
): "New" | "Today" | "Earlier" {
  if (!item.read_at) return "New";
  return new Date(item.created_at).toDateString() === now.toDateString()
    ? "Today"
    : "Earlier";
}
export function relativeNotificationTime(value: string, now = Date.now()) {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "Date unavailable";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}
export const installDismissMs = 7 * 24 * 60 * 60 * 1000;
export function shouldSuggestInstall(
  visits: number,
  dismissedUntil: number,
  installed: boolean,
  now = Date.now(),
) {
  return !installed && visits >= 2 && dismissedUntil <= now;
}
