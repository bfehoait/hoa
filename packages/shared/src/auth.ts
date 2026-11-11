import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(1024),
});
export const recoveryEmailSchema = signInSchema.pick({ email: true });
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Passwords must match.",
  });

export const roles = [
  "admin",
  "homeowner",
  "renter",
  "board",
  "security",
  "driver",
  "developer",
] as const;
export type MemberRole = (typeof roles)[number];
export const memberSchema = z.object({
  id: z.string().min(1),
  user_id: z.uuid(),
  name: z.string().nullable(),
  unit: z.string().nullable(),
  role: z.string(),
  extra_roles: z.array(z.string()).nullable(),
  status: z.string(),
  title: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type AuthMember = z.infer<typeof memberSchema>;

// UI workspace selection only. Database RLS/RPCs must independently enforce
// every real operation. Extra roles come only from the server member record.
export function memberRoles(member: AuthMember): MemberRole[] {
  if (member.status !== "Active") return [];
  return [...new Set([member.role, ...(member.extra_roles ?? [])])].filter(
    (role): role is MemberRole => roles.some((known) => known === role),
  );
}
export const workspaces = [
  {
    id: "developer",
    title: "Developer console",
    path: "/developer",
    roles: ["developer"],
  },
  {
    id: "resident",
    title: "My household",
    path: "/",
    roles: ["homeowner", "renter"],
  },
  {
    id: "office",
    title: "Office & administration",
    path: "/office",
    roles: ["admin", "developer"],
  },
  {
    id: "board",
    title: "Board",
    path: "/board",
    roles: ["board", "developer"],
  },
  {
    id: "security",
    title: "Security",
    path: "/security",
    roles: ["security", "developer"],
  },
  {
    id: "driver",
    title: "Driver",
    path: "/driver",
    roles: ["driver", "developer"],
  },
] as const;
export function memberWorkspaces(member: AuthMember) {
  const assigned = memberRoles(member);
  return workspaces.filter((workspace) =>
    workspace.roles.some((role) => assigned.includes(role)),
  );
}
// Navigation preference only. Every destination still passes route/server checks.
export function memberHomePath(member: AuthMember): string {
  const assigned = memberRoles(member);
  if (!assigned.length) return "/more/profile";
  if (assigned.includes("developer")) return "/developer";
  const primary = workspaces.find((area) =>
    area.roles.some((role) => role === member.role),
  );
  return primary?.path ?? memberWorkspaces(member)[0]?.path ?? "/more/profile";
}
function under(path: string, root: string) {
  return path === root || path.startsWith(root + "/");
}
// Navigation context only; authorization is checked separately by canOpenPath.
export function isBoardWorkspacePath(member: AuthMember | null, path: string) {
  return (
    under(path, "/board") ||
    (!!member &&
      memberRoles(member).includes("board") &&
      ["/more/documents", "/more/elections", "/directory/governance"].includes(
        path,
      ))
  );
}
export function canOpenPath(member: AuthMember, input: string): boolean {
  if (
    !input.startsWith("/") ||
    input.startsWith("//") ||
    /[\\\r\n]/.test(input)
  )
    return false;
  let path: string;
  try {
    path = decodeURIComponent(new URL(input, "https://route.invalid").pathname);
  } catch {
    return false;
  }
  if (
    /[\\%]/.test(path) ||
    path.includes(String.fromCharCode(0)) ||
    path.includes("//")
  )
    return false;
  const assigned = memberRoles(member);
  if (!assigned.length) return false;
  // Marketplace browsing is shared by signed-in community accounts. Server
  // audience/expiry/permission checks still control every listing and action.
  if (["/directory/market", "/more/marketplace"].includes(path)) return true;
  if (
    assigned.includes("developer") &&
    ["/office", "/admin", "/board", "/security", "/driver", "/explore"].some(
      (root) => under(path, root),
    )
  )
    return true;
  if (
    [
      "/workspaces",
      "/more",
      "/sign-out",
      "/more/profile",
      "/more/help",
      "/more/hotlines",
      "/search",
      "/more/notifications",
    ].includes(path)
  )
    return true;
  if (under(path, "/more/lots")) return true;
  // The marketplace is also an operational posting/review workspace.
  // Its protected endpoints still enforce individual create/publish permissions.
  if (
    ["/directory/market", "/directory/learning"].includes(path) &&
    assigned.some((role) => role === "admin" || role === "developer")
  )
    return true;
  if (under(path, "/office") || under(path, "/admin"))
    return assigned.includes("admin");
  if (under(path, "/developer") || under(path, "/coverage"))
    return assigned.includes("developer");
  if (under(path, "/security")) return assigned.includes("security");
  if (under(path, "/driver")) return assigned.includes("driver");
  if (under(path, "/board")) return assigned.includes("board");
  if (
    assigned.includes("board") &&
    ["/more/documents", "/more/elections", "/directory/governance"].includes(
      path,
    )
  )
    return true;
  if (
    assigned.includes("driver") &&
    ["/more/transport", "/directory/transport"].includes(path)
  )
    return true;
  if (under(path, "/explore")) {
    if (assigned.includes("admin")) return true;
    const residentModules = [
      "businesses",
      "buy-sell",
      "jobs",
      "garage-sales",
      "booth-events",
      "booth-applications",
      "workshops",
      "participation",
      "carpools",
      "carpool-interests",
      "household-changes",
      "payment-evidence",
      "complaints",
      "concerns",
      "tickets",
      "messages",
      "ride-requests",
      "unit-register",
    ];
    return (
      assigned.some((role) => role === "homeowner" || role === "renter") &&
      (path === "/explore" ||
        residentModules.some((module) => path === "/explore/" + module))
    );
  }
  return assigned.some((role) => role === "homeowner" || role === "renter");
}

export const previewRoles = [
  "homeowner",
  "renter",
  "admin",
  "board",
  "security",
  "driver",
] as const;
export type PreviewRole = (typeof previewRoles)[number];
export function rolePreviewScope(
  path: string,
): { role: PreviewRole; basename: string } | null {
  const match = /^\/developer\/preview\/([a-z]+)(?:\/|$)/.exec(path);
  if (!match || !previewRoles.some((role) => role === match[1])) return null;
  return {
    role: match[1] as PreviewRole,
    basename: `/developer/preview/${match[1]}`,
  };
}
export function previewMember(role: PreviewRole): AuthMember {
  return {
    id: `synthetic-${role}`,
    user_id: "00000000-0000-4000-8000-000000000001",
    name: `Sample ${role === "board" ? "board member" : role}`,
    unit: "Sample household",
    role,
    extra_roles: [],
    status: "Active",
    title: "Synthetic role preview",
    phone: null,
  };
}
export function safeReturnPath(
  value: string | null,
  member: AuthMember,
): string {
  if (value && !/[\\\r\n]/.test(value)) {
    try {
      const parsed = new URL(value, "https://return.invalid");
      if (
        parsed.origin === "https://return.invalid" &&
        parsed.pathname !== "/sign-out" &&
        canOpenPath(member, parsed.pathname)
      )
        return parsed.pathname + parsed.search;
    } catch {
      /* Use automatic account landing. */
    }
  }
  return "/workspaces";
}
