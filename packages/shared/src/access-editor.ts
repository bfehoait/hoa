import { z } from "zod";
export const moduleLabels: Record<string, string> = {
  overview: "Overview",
  people: "People & accounts",
  registrations: "Membership applications",
  profiles: "Member profiles",
  property: "Lot register, vehicles & permits",
  requests: "Helpdesk",
  messages: "Messages",
  operations: "Operations",
  finance: "Finance",
  calendar: "Facilities & calendar",
  security: "Visitors & gate desk",
  community: "Announcements",
  hotlines: "Emergency hotlines",
  livelihood: "Livelihood",
  transport: "Shuttle",
  documents: "Documents",
  elections: "Elections",
  reports: "Reports",
  audit: "Activity history",
};
export const actionLabels: Record<string, string> = {
  create: "Create records",
  reply: "Reply",
  status: "Change status",
  assign: "Assign work",
  publish: "Publish",
  approve: "Approve or reject",
  export: "Download / export records",
  manage: "Manage records",
};
export const moduleActions: Record<string, string[]> = {
  overview: [],
  people: ["create", "manage"],
  registrations: ["status", "approve"],
  profiles: ["manage"],
  property: ["status", "approve", "manage"],
  requests: ["reply", "status", "assign"],
  messages: ["reply"],
  operations: ["approve", "manage"],
  finance: ["create", "approve", "export"],
  calendar: ["create", "approve"],
  security: ["create", "approve", "status"],
  community: ["create", "publish"],
  hotlines: ["manage"],
  livelihood: ["status", "publish"],
  transport: ["status", "manage"],
  documents: ["create", "publish", "approve"],
  elections: ["manage"],
  reports: ["publish", "export"],
  audit: ["export"],
};
export function actionLabel(module: string, action: string) {
  if (module === "calendar" && action === "approve")
    return "Approve or reject bookings";
  if (module === "finance" && action === "approve")
    return "Approve Finance entries / verify booking payments";
  if (module === "security" && action === "approve")
    return "Approve gate passes for Office review";
  if (module === "security" && action === "status")
    return "Approve passes and record gate checks";
  if (module === "property" && action === "status")
    return "Review vehicles, permits and issue documents";
  return actionLabels[action] ?? action;
}
const ruleSchema = z.object({
  module: z.string(),
  scope: z.string(),
  mode: z.enum(["hidden", "view", "edit"]),
});
const actionSchema = z.object({
  module: z.string(),
  scope: z.string(),
  action: z.string(),
  effect: z.enum(["allow", "deny"]),
});
export const accessSnapshotSchema = z.object({
  rules: z.array(ruleSchema),
  actions: z.array(actionSchema),
});
export const accessEditorSchema = z.object({
  snapshot: accessSnapshotSchema,
  effective: z.record(z.string(), z.record(z.string(), z.boolean())).nullable(),
  roles: z.array(z.string()),
  manager: z.boolean(),
  sources: z.array(
    z.object({
      type: z.string(),
      subject_kind: z.string(),
      subject_id: z.string(),
      module: z.string(),
      scope: z.string(),
      action: z.string().nullable(),
      value: z.string(),
    }),
  ),
});
export type AccessSnapshot = z.infer<typeof accessSnapshotSchema>;
export type AccessGroup = {
  id: string;
  label: string;
  scope: string;
  modules: string[];
  assigned?: boolean;
  advanced?: boolean;
  protected?: boolean;
};
export function accessGroups(
  roles: string[],
  kind: string,
  snapshot: AccessSnapshot,
): AccessGroup[] {
  const groups: AccessGroup[] = [];
  const add = (
    id: string,
    label: string,
    scope: string,
    modules: string[],
    assigned = true,
    advanced = false,
  ) => groups.push({ id, label, scope, modules, assigned, advanced });
  const recovery = kind === "user" && roles.includes("developer");
  if (recovery)
    groups.push({
      id: "developer",
      label: "Developer",
      scope: "association",
      modules: [],
      assigned: true,
      protected: true,
    });
  const officeAssigned =
    recovery ||
    roles.some((r) =>
      ["admin", "finance", "grievance", "maintenance"].includes(r),
    ) ||
    kind === "committee";
  if (officeAssigned)
    add(
      "office",
      "Office",
      "association",
      Object.keys(moduleLabels),
      officeAssigned,
    );
  if (roles.includes("board"))
    add(
      "board",
      "Board of Directors",
      "association",
      [
        "overview",
        "documents",
        "elections",
        "community",
        "reports",
        "transport",
        "requests",
      ],
      recovery || roles.includes("board"),
    );
  if (roles.includes("security"))
    add(
      "security",
      "Security",
      "association",
      ["overview", "security", "property", "requests"],
      recovery || roles.includes("security"),
    );
  if (roles.includes("driver"))
    add(
      "driver",
      "Transport",
      "association",
      ["transport", "profiles"],
      recovery || roles.includes("driver"),
    );
  if (roles.some((r) => ["homeowner", "renter"].includes(r)))
    add(
      "home",
      "Homeowner / renter",
      "own",
      [
        "profile",
        "property",
        "requests",
        "finance",
        "calendar",
        "security",
        "livelihood",
        "transport",
        "documents",
      ].filter((m) => m in moduleLabels),
    );
  if (roles.some((r) => ["homeowner", "renter", "board"].includes(r)))
    add(
      "published",
      "View published content",
      "approved",
      [
        "community",
        "hotlines",
        "livelihood",
        "transport",
        "documents",
        "elections",
        "reports",
      ],
      true,
      true,
    );
  if (!groups.length)
    add(
      "all",
      "Other page permissions",
      "association",
      Object.keys(moduleLabels),
      true,
      true,
    );
  for (const scope of ["own", "approved", "assigned", "association"]) {
    const extras = [
      ...new Set(
        [...snapshot.rules, ...snapshot.actions]
          .filter(
            (r) =>
              r.scope === scope &&
              !groups.some(
                (g) => g.scope === scope && g.modules.includes(r.module),
              ),
          )
          .map((r) => r.module),
      ),
    ];
    if (extras.length)
      add("extra-" + scope, "Saved exceptions", scope, extras, true, true);
  }
  return groups;
}
// Draft UI adapter only: keeps existing unchecked action choices when lifting
// a view-only module to permit the action the manager explicitly selected.
export function checkboxActionDraft(
  snapshot: AccessSnapshot,
  module: string,
  scope: string,
  action: string,
  allow: boolean,
  effective?: Record<string, boolean>,
): AccessSnapshot {
  const next = { rules: [...snapshot.rules], actions: [...snapshot.actions] };
  const mode = snapshot.rules.find(
    (r) => r.module === module && r.scope === scope,
  )?.mode;
  if (allow && !moduleAccessChecks(mode, effective).changes) {
    for (const other of moduleActions[module] ?? []) {
      if (
        other !== action &&
        effective?.[other] === false &&
        !next.actions.some(
          (r) => r.module === module && r.scope === scope && r.action === other,
        )
      ) {
        next.actions.push({ module, scope, action: other, effect: "deny" });
      }
    }
  }
  next.actions = next.actions.filter(
    (r) => !(r.module === module && r.scope === scope && r.action === action),
  );
  next.actions.push({
    module,
    scope,
    action,
    effect: allow ? "allow" : "deny",
  });
  if (allow) {
    next.rules = next.rules.filter(
      (r) => !(r.module === module && r.scope === scope),
    );
    next.rules.push({ module, scope, mode: "edit" });
  }
  return next;
}
export function moduleAccessChecks(
  mode: "hidden" | "view" | "edit" | undefined,
  effective: Record<string, boolean> | undefined,
): { view: boolean | undefined; changes: boolean | undefined } {
  if (mode) return { view: mode !== "hidden", changes: mode === "edit" };
  if (typeof effective?.view !== "boolean")
    return { view: undefined, changes: undefined };
  if (!effective.view) return { view: false, changes: false };
  const actions = Object.entries(effective).filter(([key]) => key !== "view");
  return {
    view: true,
    changes: actions.length
      ? actions.some(([, allowed]) => allowed)
      : undefined,
  };
}
export function effectiveAccessSummary(
  module: string,
  effective: Record<string, boolean> | undefined,
) {
  if (!effective || typeof effective.view !== "boolean") return "Not reported";
  if (!effective.view) return "No access";
  const actions = moduleActions[module] ?? [];
  if (!actions.length) return savedLevel(effective);
  if (actions.some((action) => typeof effective[action] !== "boolean"))
    return "View allowed; action details not reported";
  const allowed = actions.filter((action) => effective[action]).length;
  if (!allowed && !effective.approve)
    return "View only (0 of " + actions.length + " actions allowed)";
  return `${allowed === actions.length ? "Manage" : "Custom"} (${allowed} of ${actions.length} actions allowed)`;
}
export function savedLevel(effective: Record<string, boolean> | undefined) {
  if (!effective) return "Not reported";
  if (!effective.view) return "No access";
  return Object.entries(effective).some(
    ([action, allowed]) => action !== "view" && allowed,
  )
    ? "Manage (see actions)"
    : "View only";
}
