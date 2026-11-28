import { expect, it } from "vitest";
import {
  accessGroups,
  savedLevel,
  effectiveAccessSummary,
  moduleAccessChecks,
  checkboxActionDraft,
  actionLabel,
  moduleActions,
} from "./access-editor";
it("groups assigned workspaces while preserving additional scoped rules", () => {
  const groups = accessGroups(["admin", "homeowner", "security"], "user", {
    rules: [{ module: "reports", scope: "assigned", mode: "view" }],
    actions: [],
  });
  expect(groups.map((g) => g.id)).toEqual([
    "office",
    "security",
    "home",
    "published",
    "extra-assigned",
  ]);
  expect(groups.find((g) => g.id === "extra-assigned")?.advanced).toBe(true);
  expect(groups.find((g) => g.id === "office")?.modules).toContain("calendar");
  expect(groups.find((g) => g.id === "security")?.modules).toContain(
    "security",
  );
});
it("does not invent effective access when the server has not reported it", () => {
  expect(savedLevel(undefined)).toBe("Not reported");
  expect(savedLevel({ view: true, approve: false })).toBe("View only");
  expect(savedLevel({ view: true, approve: true })).toBe(
    "Manage (see actions)",
  );
  expect(actionLabel("finance", "approve")).toContain(
    "verify booking payments",
  );
});

it("shows only assigned workspaces and keeps viewing scopes under advanced permissions", () => {
  const snapshot = { rules: [], actions: [] };
  const main = (held: string[]) =>
    accessGroups(held, "user", snapshot)
      .filter((g) => !g.advanced)
      .map((g) => g.id);
  expect(main(["admin"])).toEqual(["office"]);
  expect(main(["admin", "security", "board"])).toEqual([
    "office",
    "board",
    "security",
  ]);
  expect(main(["admin", "homeowner"])).toEqual(["office", "home"]);
  expect(main(["homeowner"])).toEqual(["home"]);
  expect(main(["driver"])).toEqual(["driver"]);
  expect(main(["security"])).toEqual(["security"]);
  const viewing = accessGroups(["homeowner"], "user", snapshot).find(
    (g) => g.id === "published",
  );
  expect(viewing?.advanced).toBe(true);
  expect(viewing?.label).toBe("View published content");
  expect(accessGroups(["security"], "role", snapshot).map((g) => g.id)).toEqual(
    ["security"],
  );
});

it("keeps Office gate approval separate from Security ID and plate checks", () => {
  expect(moduleActions.security).toContain("approve");
  expect(moduleActions.security).toContain("status");
  expect(actionLabel("security", "approve")).toContain("Office review");
  expect(actionLabel("security", "status")).toContain("gate checks");
});

it("puts protected Developer access first without inventing editable technical modules", () => {
  const snapshot = {
    rules: [{ module: "finance", scope: "own", mode: "view" as const }],
    actions: [],
  };
  const groups = accessGroups(
    ["admin", "developer", "security", "board"],
    "user",
    snapshot,
  );
  expect(groups[0]).toMatchObject({
    id: "developer",
    label: "Developer",
    protected: true,
    modules: [],
  });
  expect(groups.filter((g) => !g.advanced).map((g) => g.id)).toEqual([
    "developer",
    "office",
    "board",
    "security",
  ]);
  expect(groups.find((g) => g.id === "office")?.modules).toContain("calendar");
  expect(groups.find((g) => g.id === "extra-own")?.advanced).toBe(true);
  expect(snapshot.rules).toEqual([
    { module: "finance", scope: "own", mode: "view" },
  ]);
  expect(
    accessGroups(["developer"], "user", { rules: [], actions: [] })[0].id,
  ).toBe("developer");
  expect(
    accessGroups(["admin"], "user", snapshot).some((g) => g.protected),
  ).toBe(false);
  expect(
    accessGroups(["developer"], "role", snapshot).some((g) => g.protected),
  ).toBe(false);
});

it("summarizes only reported effective module actions without implying blanket management", () => {
  expect(
    effectiveAccessSummary("property", {
      view: true,
      approve: false,
      status: false,
      manage: false,
      create: true,
    }),
  ).toBe("View only (0 of 3 actions allowed)");
  expect(
    effectiveAccessSummary("property", {
      view: true,
      approve: true,
      status: false,
      manage: false,
    }),
  ).toBe("Custom (1 of 3 actions allowed)");
  expect(
    effectiveAccessSummary("calendar", {
      view: true,
      approve: true,
      create: true,
    }),
  ).toBe("Manage (2 of 2 actions allowed)");
  expect(
    effectiveAccessSummary("property", {
      view: false,
      approve: true,
      status: true,
      manage: true,
    }),
  ).toBe("No access");
  expect(
    effectiveAccessSummary("property", { view: true, approve: true }),
  ).toBe("View allowed; action details not reported");
  expect(effectiveAccessSummary("property", undefined)).toBe("Not reported");
  expect(effectiveAccessSummary("property", { approve: true })).toBe(
    "Not reported",
  );
});

it("maps checkbox choices to existing view/edit restrictions without fabricating unknown defaults", () => {
  expect(moduleAccessChecks("hidden", { view: true, approve: true })).toEqual({
    view: false,
    changes: false,
  });
  expect(moduleAccessChecks("view", { view: true, approve: true })).toEqual({
    view: true,
    changes: false,
  });
  expect(moduleAccessChecks("edit", undefined)).toEqual({
    view: true,
    changes: true,
  });
  expect(moduleAccessChecks(undefined, { view: true, approve: true })).toEqual({
    view: true,
    changes: true,
  });
  expect(moduleAccessChecks(undefined, { view: false, approve: true })).toEqual(
    { view: false, changes: false },
  );
  expect(moduleAccessChecks(undefined, { view: true, approve: false })).toEqual(
    { view: true, changes: false },
  );
  expect(moduleAccessChecks(undefined, undefined)).toEqual({
    view: undefined,
    changes: undefined,
  });
});

it("enables a selected action without enabling other unchecked actions or mutating saved rules", () => {
  const snapshot = {
    rules: [
      { module: "property", scope: "association", mode: "view" as const },
    ],
    actions: [],
  };
  const next = checkboxActionDraft(
    snapshot,
    "property",
    "association",
    "approve",
    true,
    { view: true, status: false, approve: false, manage: false },
  );
  expect(next.rules).toEqual([
    { module: "property", scope: "association", mode: "edit" },
  ]);
  expect(next.actions).toEqual(
    expect.arrayContaining([
      {
        module: "property",
        scope: "association",
        action: "approve",
        effect: "allow",
      },
      {
        module: "property",
        scope: "association",
        action: "status",
        effect: "deny",
      },
      {
        module: "property",
        scope: "association",
        action: "manage",
        effect: "deny",
      },
    ]),
  );
  expect(snapshot.actions).toEqual([]);
  expect(snapshot.rules[0].mode).toBe("view");
  expect(
    checkboxActionDraft(
      next,
      "property",
      "association",
      "approve",
      false,
    ).actions.find((r) => r.action === "approve")?.effect,
  ).toBe("deny");
  expect(
    checkboxActionDraft(
      { rules: [], actions: [] },
      "property",
      "association",
      "approve",
      true,
    ).actions,
  ).toHaveLength(1);
});
