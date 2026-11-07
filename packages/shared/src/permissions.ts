import { z } from "zod";

export const accessModules = [
  "overview",
  "people",
  "registrations",
  "profiles",
  "property",
  "requests",
  "messages",
  "operations",
  "finance",
  "calendar",
  "security",
  "community",
  "hotlines",
  "livelihood",
  "transport",
  "documents",
  "elections",
  "reports",
  "audit",
  "access",
  "profile",
  "support",
  "technical",
] as const;
export const accessActions = [
  "view",
  "summary",
  "create",
  "reply",
  "status",
  "assign",
  "publish",
  "approve",
  "export",
  "manage",
  "monitor",
] as const;
export const accessScopes = [
  "own",
  "approved",
  "assigned",
  "association",
] as const;
export const capabilitySchema = z.object({
  module: z.enum(accessModules),
  action: z.enum(accessActions),
  scope: z.enum(accessScopes),
});
export type Capability = z.infer<typeof capabilitySchema>;
export const effectiveAccessSchema = z.object({
  developer_control: z.boolean().optional().default(false),
  access_manager: z.boolean().optional().default(false),
  tab_modes: z
    .array(
      z.object({
        module: z.enum(accessModules),
        scope: z.enum(accessScopes),
        mode: z.enum(["hidden", "view", "edit"]),
      }),
    )
    .optional()
    .default([]),
  version: z.literal(1),
  capabilities: z.array(capabilitySchema),
  committees: z.array(z.string()),
});
export type EffectiveAccess = z.infer<typeof effectiveAccessSchema>;
export function hasCapability(
  access: EffectiveAccess | undefined,
  requirement: Capability,
) {
  return (
    !!access?.developer_control ||
    !!access?.capabilities.some(
      (item) =>
        item.module === requirement.module &&
        item.action === requirement.action &&
        item.scope === requirement.scope,
    )
  );
}

// UI routing only. The database independently checks each protected operation.
// Unknown office destinations fail closed instead of inheriting a broad admin grant.
export function officeRequirement(
  input: string,
): Capability | null | undefined {
  const path = input.split(/[?#]/)[0].replace(/\/$/, "");
  if (
    path !== "/office" &&
    !path.startsWith("/office/") &&
    path !== "/admin" &&
    !path.startsWith("/admin/")
  )
    return null;
  const section = path.replace(/^\/(office|admin)\/?/, "").split("/")[0];
  const modules: Record<string, Capability["module"]> = {
    "": "overview",
    residents: "people",
    registry: "property",
    lots: "property",
    registrations: "registrations",
    profiles: "profiles",
    requests: "requests",
    inbox: "requests",
    operations: "operations",
    review: "operations",
    permits: "operations",
    vehicles: "security",
    finance: "finance",
    community: "community",
    announcements: "community",
    documents: "documents",
    calendar: "calendar",
    bookings: "calendar",
    visitors: "security",
    reports: "reports",
    access: "access",
    audit: "audit",
  };
  const module = modules[section];
  return module
    ? {
        module,
        action: module === "overview" ? "summary" : "view",
        scope: "association",
      }
    : undefined;
}

export const committeeNames = [
  "Finance",
  "Audit & Inventory",
  "Grievance",
  "Peace & Order",
  "Maintenance",
  "Livelihood",
  "Community Events & Education",
  "Environment & Sustainability",
  "Youth, Sports & GAD",
  "Disaster & Risk Management",
  "Election",
  "Data Governance",
] as const;
export const permissionQuestions = [
  "Unreadable workbook cells remain ungranted.",
  "Super admin and All Access have no automatic grant.",
  "Committee duty, management and review labels do not approve individual actions.",
  "Board summaries do not grant private records, approvals or ballot access.",
  "Developer control requires an active developer role. Role previews remain synthetic.",
] as const;
