import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  accessModules,
  accessActions,
  accessScopes,
} from "../../packages/shared/src/permissions";
import {
  baselineModule,
  baselineModules,
  sampleBaselineFields,
} from "../../packages/shared/src/baseline";
import {
  liveFieldLabel,
  listingFieldLabel,
} from "../../packages/shared/src/feature-records";

const configured = process.env.BELLEFORT_TEST_AUTH === "configured";
test.describe("readable populated request details", () => {
  test.skip(!configured);
  for (const [role, readOnly] of [
    ["homeowner", false],
    ["renter", false],
    ["admin", false],
    ["security", false],
    ["admin", true],
  ] as const) {
    test(`${role}${readOnly ? " view only" : ""} can read request facts before taking an action`, async ({
      page,
    }) => {
      await workspaceAccessMock(page, { auditRole: role, readOnly });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const writes: string[] = [];
      await page.route(
        "**/rest/v1/rpc/bfe_feature_dashboard",
        async (route) => {
          const { p_module } = route.request().postDataJSON();
          return route.fulfill({
            json: {
              rows:
                p_module === "vehicles"
                  ? [
                      {
                        id: "11111111-1111-4111-8111-111111111196",
                        module: "vehicles",
                        title: "Synthetic sticker request",
                        detail: "A replacement household sticker.",
                        fields: {
                          request: "New sticker",
                          plate: "TEST 1234",
                          vehicleType: "Car",
                          makeModel: "Synthetic car",
                          colour: "Blue",
                          unit: "1-01-001",
                          owner: "Homeowner",
                          company: "Inactive field must stay hidden",
                          internal_key: "Unknown field must stay hidden",
                        },
                        status: "In review",
                        version: 1,
                        created_at: "2026-11-20T00:00:00Z",
                      },
                    ]
                  : [],
              total: p_module === "vehicles" ? 1 : 0,
              can_create: role === "homeowner" || role === "renter",
              can_review:
                !readOnly && (role === "admin" || role === "security"),
              can_publish: false,
              publishable: false,
            },
          });
        },
      );
      await page.route("**/rest/v1/rpc/bfe_workflow_history", (route) =>
        route.fulfill({ json: [] }),
      );
      page.on("request", (request) => {
        if (
          /\/rpc\/bfe_(create|save|review|approve|submit|publish)_/.test(
            request.url(),
          )
        )
          writes.push(request.url());
      });
      await login(page);
      const resident = role === "homeowner" || role === "renter";
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          resident
            ? "/more/vehicles"
            : role === "security"
              ? "/security/vehicles"
              : "/office/review?module=vehicles",
        );
        const popup = resident || width >= 768;
        if (popup)
          await page
            .getByRole("button", {
              name: resident
                ? /Synthetic sticker request/
                : "Open Synthetic sticker request",
            })
            .first()
            .click();
        const dialog = popup
          ? page.getByRole("dialog").last()
          : page.locator("main");
        const facts = dialog.locator('dl[aria-label="Request information"]');
        await expect(facts).toBeVisible();
        await expect(
          facts.getByText("TEST 1234", { exact: true }),
        ).toBeVisible();
        await expect(
          facts.getByText("Inactive field must stay hidden"),
        ).toHaveCount(0);
        await expect(
          facts.getByText("Unknown field must stay hidden"),
        ).toHaveCount(0);
        await expect(
          dialog.getByRole("heading", {
            name: "Synthetic sticker request",
            exact: true,
          }),
        ).toHaveCount(1);
        const review = dialog.getByRole("button", {
          name: "Review & decide",
          exact: true,
        });
        if (resident || readOnly) {
          await expect(review).toHaveCount(0);
        } else {
          await review.click();
          const decision = page.getByRole("dialog").last();
          await expect(
            decision.getByRole("heading", {
              name: "Review: Synthetic sticker request",
            }),
          ).toBeVisible();
          await expect(
            decision
              .locator('dl[aria-label="Request information"]')
              .getByText("TEST 1234", { exact: true }),
          ).toBeVisible();
          await expect(
            decision.getByRole("option", {
              name: "Approve vehicle request",
              exact: true,
            }),
          ).toHaveCount(1);
          await decision
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
        }
        await expect(page.locator("body")).not.toHaveCSS(
          "overflow-x",
          "scroll",
        );
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 2,
            ),
          )
          .toBe(true);
        mkdirSync(".artifacts/usability-records", { recursive: true });
        await page.screenshot({
          animations: "disabled",
          path: `.artifacts/usability-records/${role}${readOnly ? "-readonly" : ""}-${width}.png`,
        });
        await dialog
          .getByRole("button", { name: "View history", exact: true })
          .click();
        await expect(
          page
            .getByRole("dialog")
            .last()
            .getByText("No updates yet", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("dialog")
          .last()
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        if (popup)
          await dialog
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
      }
      expect(writes).toEqual([]);
    });
  }
});
test.describe("member access and service entry points", () => {
  test.skip(!configured);
  test("developer-only account opens creation forms for every connected submission type", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await api(page, {
      accounts: true,
      developerControl: true,
      member: { ...baseMember, role: "developer", extra_roles: [] },
    });
    await page.route("**/rest/v1/rpc/bfe_feature_dashboard", (route) =>
      route.fulfill({
        json: {
          rows: [],
          total: 0,
          can_create: true,
          can_review: true,
          can_publish: true,
          publishable: true,
        },
      }),
    );
    await login(page);
    await page.goto("/developer");
    await page
      .getByRole("link", { name: "Create & review submissions", exact: true })
      .click();
    for (const definition of baselineModules) {
      await page
        .getByRole("combobox", { name: "Section", exact: true })
        .selectOption(definition.id);
      await page
        .getByRole("button", {
          name:
            definition.id === "publishing"
              ? "New announcement"
              : "New submission",
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Title", { exact: true })).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: /^Submit for review$/i }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
  });
  test("workspace access refuses unavailable server data instead of guessing permissions", async ({
    page,
  }) => {
    await workspaceAccessMock(page, { missing: true });
    await login(page);
    await page.goto("/developer/access");
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    await expect(
      page.getByRole("region", { name: "Workspace access" }).getByRole("alert"),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Manage", exact: true }),
    ).toHaveCount(0);
  });
  test("workspace access presents Developer recovery first and keeps references read-only", async ({
    page,
  }) => {
    const state = await workspaceAccessMock(page, {
      targetRoles: ["admin", "developer", "board", "security"],
    });
    await login(page);
    await page.goto("/developer/access");
    const member = page.getByRole("button", { name: /Sample Staff/ });
    await expect(member).toContainText(
      "Office admin / Developer / Board member / Security",
    );
    await expect(member).toContainText("Protected Developer");
    await member.click();
    const panel = page.getByRole("region", { name: "Workspace access" });
    const picker = panel.getByRole("navigation", { name: "Choose workspace" });
    await expect(picker.getByRole("button").first()).toHaveAccessibleName(
      "Developer",
    );
    await expect(
      picker.getByRole("button", { name: "Developer", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(picker).toContainText("Protected system access");
    const explanation = panel.getByRole("region", {
      name: "Developer protected access",
    });
    await expect(explanation).toContainText("system recovery procedures");
    await expect(
      page.getByRole("searchbox", { name: "Find a module", exact: true }),
    ).toHaveCount(0);
    await expect(panel.getByRole("radio")).toHaveCount(0);
    for (const name of ["Office", "Board of Directors", "Security"]) {
      await picker.getByRole("button", { name, exact: true }).click();
      await expect(
        panel.getByRole("region", { name: name + " pages", exact: true }),
      ).toBeVisible();
      await expect(panel.getByRole("radio")).toHaveCount(0);
      await expect(panel.getByRole("combobox")).toHaveCount(0);
    }
    await expect(panel.getByRole("checkbox")).toHaveCount(0);
    await expect(panel.getByRole("switch")).toHaveCount(0);
    await expect(panel.getByRole("combobox")).toHaveCount(0);
    await expect(
      panel.getByRole("button", {
        name: /Allow access management|Remove access management|Review changes|Confirm and save/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Protected account. Page access is read-only here.", {
        exact: true,
      }),
    ).toBeVisible();
    await picker
      .getByRole("button", { name: "Developer", exact: true })
      .click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await picker.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `.artifacts/developer-protected-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-label="Workspace access"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.screenshot({
      path: ".artifacts/developer-protected-dark.png",
      animations: "disabled",
    });
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Workspace access"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(state.saves).toBe(0);
    expect(state.delegations).toBe(0);
  });

  test("workspace access staff search shows additional roles and keeps ordinary Office delegation", async ({
    page,
  }) => {
    const state = await workspaceAccessMock(page, {
      targetRoles: ["admin", "board", "security"],
    });
    await login(page);
    await page.goto("/developer/access");
    await page
      .getByRole("combobox", { name: "Assigned role", exact: true })
      .selectOption("security");
    const result = page.getByRole("button", { name: /Sample Staff/ });
    await expect(result).toContainText(
      "Office admin / Board member / Security",
    );
    const search = page.getByRole("textbox", {
      name: "Find a member by name or unit",
      exact: true,
    });
    await search.fill("nobody");
    await expect(
      page.getByRole("heading", { name: "No matching members" }),
    ).toBeVisible();
    await search.fill("Sample Staff");
    await expect(result).toBeEnabled();
    await result.click();
    const panel = page.getByRole("region", { name: "Workspace access" });
    const delegationPanel = panel.getByRole("region", {
      name: "Manage other users’ access",
      exact: true,
    });
    const toggle = delegationPanel.getByRole("switch", {
      name: "Manage other users’ access",
      exact: true,
    });
    const reason = delegationPanel.getByRole("textbox", {
      name: "Reason for this change",
      exact: true,
    });
    const confirm = delegationPanel.getByRole("button", {
      name: "Confirm change",
      exact: true,
    });
    await expect(toggle).not.toBeChecked();
    await expect(reason).toHaveCount(0);
    await toggle.check();
    await expect(confirm).toBeDisabled();
    expect(state.delegations).toBe(0);
    await toggle.uncheck();
    await expect(reason).toHaveCount(0);
    await toggle.check();
    await reason.fill("Synthetic assigned access duties");
    await expect(confirm).toBeEnabled();
    expect(
      state.searches.some(
        (s) => s.p_role === "security" && s.p_search === "Sample Staff",
      ),
    ).toBe(true);
    expect(state.saves).toBe(0);
    await confirm.click();
    await expect(toggle).toBeChecked();
    await expect(reason).toHaveCount(0);
    expect(state.delegations).toBe(1);
    expect(state.manager).toBe(true);
    await toggle.uncheck();
    await expect(confirm).toBeDisabled();
    await delegationPanel
      .getByRole("button", { name: "Cancel change" })
      .click();
    await expect(toggle).toBeChecked();
    expect(state.delegations).toBe(1);
    await toggle.uncheck();
    await reason.fill("Synthetic reassignment of access duties");
    await confirm.click();
    await expect(toggle).not.toBeChecked();
    await expect(reason).toHaveCount(0);
    expect(state.delegations).toBe(2);
    expect(state.manager).toBe(false);
  });

  test("access management toggle fits phone and desktop and preserves a rejected draft", async ({
    page,
  }) => {
    const state = await workspaceAccessMock(page, { targetRoles: ["admin"] });
    await login(page);
    await page.goto("/developer/access");
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    const panel = page.getByRole("region", {
      name: "Manage other users’ access",
      exact: true,
    });
    const toggle = panel.getByRole("switch");
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await toggle.scrollIntoViewIfNeeded();
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toBeChecked();
      await expect(
        page.getByRole("tab", { name: "Role & status", exact: true }),
      ).toBeDisabled();
      const bounds = await panel.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await expect(
        panel.getByRole("button", { name: "Confirm change" }),
      ).toBeDisabled();
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-label="Manage other users’ access"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await panel.getByRole("button", { name: "Cancel change" }).click();
      await expect(toggle).not.toBeChecked();
    }
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_set_access_manager",
      (route) =>
        route.fulfill({
          status: 403,
          json: { code: "42501", message: "Synthetic permission denial" },
        }),
    );
    await toggle.check();
    const reason = panel.getByRole("textbox", {
      name: "Reason for this change",
    });
    await reason.fill("Synthetic delegation failure test");
    await panel.getByRole("button", { name: "Confirm change" }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(reason).toHaveValue("Synthetic delegation failure test");
    await expect(panel.getByRole("status")).toContainText("Not saved");
    expect(state.delegations).toBe(0);
    expect(state.manager).toBe(false);
    await panel.getByRole("button", { name: "Cancel change" }).click();
    await expect(toggle).not.toBeChecked();
  });

  test("workspace access hides unassigned roles and separates published viewing settings", async ({
    page,
  }) => {
    await workspaceAccessMock(page, { targetRoles: ["admin", "homeowner"] });
    await login(page);
    await page.goto("/developer/access");
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    const panel = page.getByRole("region", { name: "Workspace access" });
    const nav = panel.getByRole("navigation", { name: "Choose workspace" });
    await expect(
      nav.getByRole("button", { name: "Office", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("button", { name: "Homeowner / renter", exact: true }),
    ).toBeVisible();
    for (const name of [
      "Security",
      "Board of Directors",
      "Transport",
      "View published content",
    ])
      await expect(nav.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      );
    await nav
      .getByRole("button", { name: "Homeowner / renter", exact: true })
      .click();
    await expect(
      panel.getByText("Submission does not grant publishing permission.", {
        exact: false,
      }),
    ).toBeVisible();
    const advanced = panel.getByRole("navigation", {
      name: "Advanced permission scopes",
    });
    await expect(advanced).toBeHidden();
    await panel
      .locator("summary")
      .filter({ hasText: /^Advanced permissions$/ })
      .click();
    await expect(advanced).toBeVisible();
    await expect(advanced).not.toContainText("Role assigned");
    await advanced
      .getByRole("button", { name: "View published content", exact: true })
      .click();
    await expect(
      panel.getByText("This does not allow publishing them.", { exact: false }),
    ).toBeVisible();
  });
  test("workspace access groups modules and saves explicit actions after review", async ({
    page,
  }) => {
    const state = await workspaceAccessMock(page, {
      targetRoles: ["admin", "security", "board"],
    });
    await login(page);
    await page.goto("/developer/access");
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    const panel = page.getByRole("region", { name: "Workspace access" });
    const workspaces = panel.getByRole("navigation", {
      name: "Choose workspace",
    });
    for (const name of ["Office", "Board of Directors", "Security"])
      await expect(
        workspaces.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await workspaces
      .getByRole("button", { name: "Security", exact: true })
      .click();
    await expect(
      panel.getByRole("region", {
        name: "Security: Visitors & gate desk",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      workspaces.getByRole("button", { name: "Transport", exact: true }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("region", {
        name: "Office: Facilities & calendar",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(state.saves).toBe(0);
    await workspaces
      .getByRole("button", { name: "Office", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Find a module", exact: true })
      .fill("bookings");
    const row = panel.getByRole("region", {
      name: "Office: Facilities & calendar",
      exact: true,
    });
    await expect(row).toContainText("Current: No access");
    const approval = row.getByRole("checkbox", {
      name: "Office Facilities & calendar Approve or reject bookings",
      exact: true,
    });
    await expect(approval).toHaveCount(0);
    await row
      .getByRole("switch", {
        name: "Office Facilities & calendar Tab visibility",
        exact: true,
      })
      .check();
    await expect(
      row.getByRole("checkbox", { name: /Allow changes/ }),
    ).toHaveCount(0);
    await approval.check();
    await expect(page.getByText(/3 unsaved changes/)).toBeVisible();
    const visibility = row.getByRole("switch", {
      name: "Office Facilities & calendar Tab visibility",
      exact: true,
    });
    await visibility.uncheck();
    await expect(approval).toHaveCount(0);
    await expect(
      row.getByRole("group", {
        name: "Office Facilities & calendar actions",
        exact: true,
      }),
    ).toHaveCount(0);
    await visibility.check();
    await expect(approval).toBeEnabled();
    await expect(approval).toBeChecked();
    await expect(page.getByText(/3 unsaved changes/)).toBeVisible();
    await approval.press("Space");
    await expect(approval).not.toBeChecked();
    await approval.press("Space");
    await expect(approval).toBeChecked();
    await expect(
      panel.locator("summary").filter({ hasText: "Default settings" }),
    ).toHaveCount(0);
    const resets = panel.locator("details").filter({
      has: page.locator("summary", { hasText: "Reset custom access" }),
    });
    await expect(
      panel.locator("summary").filter({ hasText: "Reset custom access" }),
    ).toHaveCount(1);
    await resets.locator("summary").first().click();
    await expect(
      resets.getByRole("button", {
        name: "Reset Approve or reject bookings to defaults",
        exact: true,
      }),
    ).toBeVisible();
    await resets
      .getByRole("button", {
        name: "Reset Approve or reject bookings to defaults",
        exact: true,
      })
      .click();
    await expect(page.getByText(/2 unsaved changes/)).toBeVisible();
    await expect(approval).not.toBeChecked();
    await approval.check();
    await expect(
      panel.locator("summary").filter({ hasText: "How access rules work" }),
    ).toHaveCount(1);
    await expect(
      row
        .locator("summary")
        .filter({ hasText: "Where this access comes from" }),
    ).toHaveCount(0);
    await expect(row).toContainText("Finance payment approval");
    expect(state.saves).toBe(0);
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirm and save", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Reason for changes", { exact: true })
      .fill("Synthetic booking duty");
    await expect(
      page.getByRole("region", { name: "Review access changes" }),
    ).toContainText("Approve or reject bookings");
    await page
      .getByRole("button", { name: "Confirm and save", exact: true })
      .click();
    await expect(
      page.getByText(
        "Permissions saved. Current access below has been checked by the server.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(state.saves).toBe(1);
    await expect(row).toContainText("Current: Custom (1 of 2 actions allowed)");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `.artifacts/workspace-access-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-label="Workspace access"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  });
  test("announcement monitor opens the existing creation workflow and respects unavailable posting", async ({
    page,
  }) => {
    await api(page, {
      accounts: true,
      monitor: true,
      developerControl: true,
      member: { ...baseMember, role: "developer", extra_roles: [] },
    });
    let canCreate = true;
    let submissions = 0;
    await page.route("**/rest/v1/rpc/bfe_submit_feature", (route) => {
      const args = route.request().postDataJSON();
      expect(args.p_module).toBe("publishing");
      expect(args.p_title).toBe("Synthetic community notice");
      expect(args.p_consent).toBe(true);
      expect(args).not.toHaveProperty("status");
      submissions++;
      return route.fulfill({ json: "85000000-0000-4000-8000-000000000009" });
    });
    await page.route("**/rest/v1/rpc/bfe_feature_dashboard", (route) =>
      route.fulfill({
        json: {
          rows: [],
          total: 0,
          can_create: canCreate,
          can_review: true,
          can_publish: false,
          publishable: true,
        },
      }),
    );
    await login(page);
    await page.goto("/developer");
    await expect(
      page.getByRole("link", { name: "Create announcement", exact: true }),
    ).toHaveAttribute("href", "/office/announcements?new=1");
    await expect(
      page.getByRole("link", {
        name: "Create & review submissions",
        exact: true,
      }),
    ).toHaveAttribute("href", "/office/review");
    await page.goto("/developer/modules/community");
    await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Manage announcements", exact: true }),
    ).toHaveAttribute("href", "/office/announcements");
    await page
      .getByRole("link", { name: "Create announcement", exact: true })
      .click();
    await expect(page).toHaveURL(/office\/announcements\?new=1/);
    const dialog = page.getByRole("dialog", {
      name: "New announcement",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Title", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Submit for review", exact: true }),
    ).toBeVisible();
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Synthetic community notice");
    await dialog
      .getByLabel("Details", { exact: true })
      .fill("Synthetic announcement details for local workflow verification.");
    const values = sampleBaselineFields("publishing");
    for (const field of baselineModule("publishing").fields) {
      const control = field.options
        ? dialog.getByRole("combobox", {
            name: liveFieldLabel(field.label),
            exact: true,
          })
        : dialog.getByLabel(liveFieldLabel(field.label), { exact: true });
      if (field.options) await control.selectOption(values[field.key]);
      else await control.fill(values[field.key]);
    }
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Submit for review", exact: true })
      .click();
    await expect(
      page.getByText("Submission saved by the server. Review is pending.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(submissions).toBe(1);
    canCreate = false;
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("Posting is not enabled for your account.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New announcement", exact: true }),
    ).toHaveCount(0);
  });
});
test.describe("authenticated view without sample fallbacks", () => {
  test.skip(!configured);
  test("home and services use member identity without reading or replacing local demo stores", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("bellefort-preview-v1", "unread-sample-marker");
      sessionStorage.setItem(
        "bellefort-workspace-v1",
        "unread-workspace-marker",
      );
    });
    await api(page, { accounts: true, liveRequests: true });
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Welcome, Synthetic", exact: true }),
    ).toBeVisible();
    for (const path of ["/", "/services", "/more", "/more/help"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Data status" }),
      ).toContainText("Account services");
      await expect(page.locator("main")).not.toContainText(
        "Sample lighting repair",
      );
      await expect(page.locator("main")).not.toContainText(
        "locally saved records",
      );
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem("bellefort-preview-v1"),
        ),
      ).toBe("unread-sample-marker");
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem("bellefort-workspace-v1"),
        ),
      ).toBe("unread-workspace-marker");
    }
    await page.goto("/more/vehicles");
    await expect(
      page.getByRole("heading", { name: "Not available yet", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /add|register|sample/i }),
    ).toHaveCount(0);
    await page.goto("/services/inbox");
    await expect(
      page.getByRole("button", { name: "New request", exact: true }),
    ).toBeEnabled();
  });
  test("unfinished office and legacy surfaces cannot render sample data after sign-in", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "admin" },
      accounts: true,
      liveRequests: true,
      permissions: [
        "overview",
        "people",
        "property",
        "requests",
        "operations",
        "security",
        "finance",
      ].flatMap((module) =>
        ["view", "summary"].map((action) => ({
          module,
          action,
          scope: "association",
        })),
      ),
    });
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    for (const path of [
      "/office/registry",
      "/office/history",
      "/office/vehicles",
      "/office/permits",
      "/office/settings",
      "/admin/operations",
      "/explore/imports",
      "/explore/calculator",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", {
          name: ["/office/history", "/office/settings"].includes(path)
            ? "Module access required"
            : "Not available yet",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("main")).not.toContainText(
        "Sample lighting repair",
      );
      await expect(
        page.locator("main").locator("input,textarea,select"),
      ).toHaveCount(0);
    }
    expect(
      await page.evaluate(() => sessionStorage.getItem("bellefort-preview-v1")),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("bellefort-workspace-v1"),
      ),
    ).toBeNull();
  });
  test("board published records load without waiting on a sample workspace", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "board" },
      accounts: true,
    });
    await page.route("**/rest/v1/rpc/bfe_feature_dashboard", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          rows: [],
          total: 0,
          can_create: false,
          can_review: false,
          can_publish: false,
          publishable: true,
        }),
      }),
    );
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto("/board");
    await expect(
      page.getByRole("heading", { name: "Board workspace", exact: true }),
    ).toBeVisible();
    await page.goto("/board/documents");
    await expect(
      page.getByRole("heading", {
        name: "No records in this view.",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("bellefort-workspace-v1"),
      ),
    ).toBeNull();
  });
  test("developer roles open access management and role simulations stay out of the authenticated app", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "developer" },
      accounts: true,
      liveRequests: true,
    });
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto("/developer/roles");
    await expect(
      page.getByRole("heading", {
        name: "Roles & committee access",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("a[href^='/developer/preview/']")).toHaveCount(0);
    await page.goto("/developer/preview/homeowner/");
    await expect(
      page.getByRole("heading", { name: "Not available yet", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Back to developer console",
        exact: true,
      }),
    ).toHaveAttribute("href", "/developer");
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("bellefort-workspace-v1"),
      ),
    ).toBeNull();
  });
});
test.describe("consistent workspace UI and configurable tabs", () => {
  test.skip(!configured);
  test("marketplace monitoring opens posting tools and empty facilities do not offer a dead booking form", async ({
    page,
  }) => {
    await api(page, {
      accounts: true,
      developerControl: true,
      monitor: true,
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
    });
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        const reply = (data: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        if (name === "bfe_feature_dashboard")
          return reply({
            rows: [],
            total: 0,
            can_create: true,
            can_review: true,
            can_publish: true,
            publishable: true,
          });
        if (name === "bfe_booking_dashboard")
          return reply({
            rows: [],
            total: 0,
            facilities: [],
            can_manage: true,
            can_approve: true,
          });
        return route.fallback();
      },
    );
    await login(page);
    await page.goto("/developer/modules/livelihood?section=boothEvents");
    await page
      .getByRole("link", { name: "Open marketplace workspace", exact: true })
      .click();
    await expect(page).toHaveURL(/directory\/market\?section=booth-events/);
    await page
      .getByRole("button", { name: "New submission", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "New submission", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.goto("/office/bookings");
    await expect(
      page.getByRole("button", { name: "New booking", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Booking is not available yet/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Configure facility", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
  test("listing owners add consented links and a processed cover while publications stay reviewed", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await api(page, { accounts: true });
    const id = "85000000-0000-4000-8000-000000000010",
      path = id + "/synthetic-cover.webp";
    let cover = false,
      links: { label: string; url: string }[] = [],
      uploads = 0;
    const record = {
      id,
      module: "businesses",
      title: "Synthetic local business",
      detail: "Synthetic local business description",
      fields: sampleBaselineFields("businesses"),
      status: "Submitted",
      publication_consent: true,
      version: 1,
      created_at: new Date().toISOString(),
    };
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1),
          args = route.request().postDataJSON();
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_feature_dashboard")
          return reply({
            rows: args.p_view === "mine" ? [record] : [],
            total: args.p_view === "mine" ? 1 : 0,
            can_create: true,
            can_review: false,
            can_publish: false,
            publishable: true,
          });
        if (name === "bfe_listing_media")
          return reply({ cover_path: cover ? path : null, links });
        if (name === "bfe_save_listing_links") {
          links = args.p_links;
          return reply(null);
        }
        if (name === "bfe_prepare_listing_cover") {
          cover = true;
          return reply(path);
        }
        return route.fallback();
      },
    );
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
      "base64",
    );
    await page.route(
      "https://bellefort-auth-test.invalid/storage/v1/**",
      async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() === "GET")
          return route.fulfill({ contentType: "image/png", body: png });
        if (url.pathname.includes("/object/sign/"))
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              signedURL:
                "/object/sign/bfe-listing-covers/" + path + "?token=synthetic",
            }),
          });
        uploads++;
        expect(
          route
            .request()
            .postDataBuffer()
            ?.toString("latin1")
            .includes("image/webp"),
        ).toBe(true);
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ Key: path, Id: id }),
        });
      },
    );
    await login(page);
    await page.goto("/explore/businesses");
    await expect(
      page.getByRole("heading", {
        name: "Synthetic local business",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit publication links", exact: true })
      .click();
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await page
      .getByLabel("Link label", { exact: true })
      .fill("Synthetic website");
    await page
      .getByLabel("HTTPS address", { exact: true })
      .fill("https://business.example.test");
    await page
      .getByRole("button", { name: "Save links for review", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Synthetic website", exact: true }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    const image = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 40;
      c.getContext("2d")!.fillRect(0, 0, 40, 40);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.getByLabel("Add cover photo", { exact: true }).setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
    await expect(
      page.getByRole("img", { name: "Listing cover", exact: true }),
    ).toBeVisible();
    expect(uploads).toBe(1);
    await expect(
      page.getByRole("button", { name: "Review & decide", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("workspace role defaults save separately from individual permissions", async ({
    page,
  }) => {
    const state = await workspaceAccessMock(page);
    await login(page);
    await page.goto("/developer/access?accessTab=defaults");
    const panel = page
      .getByRole("region", { name: "Workspace access" })
      .filter({ visible: true });
    await panel.getByLabel("Role", { exact: true }).selectOption("security");
    await page
      .getByRole("searchbox", { name: "Find a module", exact: true })
      .fill("Visitors");
    const row = panel.getByRole("region", {
      name: "Security: Visitors & gate desk",
      exact: true,
    });
    await row.getByRole("switch", { name: / Tab visibility$/ }).check();
    await row
      .getByRole("checkbox", {
        name: / Approve passes and record gate checks$/,
      })
      .check();
    await panel
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Confirm and save", exact: true }),
    ).toBeDisabled();
    await panel
      .getByLabel("Reason for changes", { exact: true })
      .fill("Synthetic Security default");
    await panel
      .getByRole("button", { name: "Confirm and save", exact: true })
      .click();
    await expect(
      panel.getByText("Defaults saved. Individual restrictions still apply.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(state.lastKind).toBe("role");
    expect(state.lastSubject).toBe("security");
  });
});
test.describe("developer account interface preview", () => {
  test.skip(!configured);
  test("opens the member portal navigation and real read endpoints without changing the developer login", async ({
    page,
  }) => {
    const calls = await api(page, {
      accounts: true,
      developerControl: true,
      member: { ...baseMember, role: "developer", name: "Synthetic Developer" },
    });
    const target = "87000000-0000-4000-8000-000000000001",
      session = "87000000-0000-4000-8000-000000000002";
    const routed: string[] = [];
    let ended = false;
    let targetRole = "homeowner";
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1),
          args = route.request().postDataJSON();
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_access_members")
          return reply({
            total: 1,
            rows: [
              {
                user_id: target,
                name: "Synthetic Target Member",
                unit: "Synthetic test lot",
                role: targetRole,
                extra_roles: [],
                status: "Active",
              },
            ],
          });
        if (name === "bfe_start_member_inspection") {
          expect(args.p_target).toBe(target);
          expect(args.p_reason).toBe("Account interface preview (read-only)");
          return reply({
            id: session,
            expires_at: new Date(Date.now() + 600000).toISOString(),
          });
        }
        if (name === "bfe_end_member_inspection") {
          ended = true;
          expect(args.p_id).toBe(session);
          return reply(null);
        }
        if (name === "bfe_account_preview_read") {
          expect(args.p_session).toBe(session);
          routed.push(args.p_name);
          if (args.p_name === "bfe_get_member")
            return reply({
              ...baseMember,
              id: "synthetic-target",
              role: targetRole,
              user_id: target,
              name: "Synthetic Target Member",
              unit: "Synthetic test lot",
              _preview_expires_at: new Date(Date.now() + 600000).toISOString(),
              _preview_server_now: new Date().toISOString(),
            });
          if (args.p_name === "bfe_my_access")
            return reply({
              version: 1,
              developer_control: false,
              committees: [],
              capabilities: [
                ...(targetRole === "admin"
                  ? [
                      {
                        module: "overview",
                        action: "summary",
                        scope: "association",
                      },
                    ]
                  : []),
                { module: "requests", action: "view", scope: "own" },
                { module: "requests", action: "create", scope: "own" },
                { module: "requests", action: "reply", scope: "own" },
              ],
            });
          if (args.p_name === "bfe_get_profile")
            return reply({
              display_name: "Synthetic Target Member",
              phone: "",
              bio: "",
              updated_at: null,
            });
          if (args.p_name === "bfe_my_notifications")
            return reply({ rows: [], total: 0, unread: 0 });
          if (args.p_name === "bfe_preview_requests")
            return reply({
              records: [
                {
                  id: "87000000-0000-4000-8000-000000000003",
                  owner_id: target,
                  client_id: "87000000-0000-4000-8000-000000000004",
                  title: "Synthetic member-only request",
                  description: "Synthetic target account request details",
                  category: "Idea",
                  unit_snapshot: "Synthetic test lot",
                  status: "Open",
                  version: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              total: 1,
              sample: false,
            });
          throw new Error("Unexpected preview endpoint " + args.p_name);
        }
        return route.fallback();
      },
    );
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto("/developer/members");
    await page
      .getByRole("button", { name: "Preview account", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp("/developer/account-preview/" + session + "/"),
    );
    await expect(
      page.getByRole("region", { name: "Account preview", exact: true }),
    ).toContainText("Synthetic Target Member");
    await page.goto(
      "/developer/account-preview/" + session + "/services/requests",
    );
    await expect(
      page.getByRole("heading", { name: "How can we help?", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic member-only request", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 850 });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const banner = document.querySelector(
              '[aria-label="Account preview"]',
            )!,
            sidebar = document.querySelector(
              'aside[aria-label="Main navigation"]',
            )!;
          return (
            sidebar.getBoundingClientRect().top -
            banner.getBoundingClientRect().bottom
          );
        }),
      )
      .toBeGreaterThanOrEqual(-1);
    await page
      .getByRole("button", { name: "New request", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form
      .getByLabel("Title", { exact: true })
      .fill("Preview must not save");
    await form
      .getByLabel("Details", { exact: true })
      .fill("Synthetic preview submission must remain unsaved.");
    await form
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    expect(routed).not.toContain("bfe_create_request");
    await form
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Roles & committee access", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(routed).toContain("bfe_preview_requests");
    expect(
      routed.every(
        (name) =>
          ![
            "bfe_create_request",
            "bfe_save_profile",
            "bfe_mark_notifications",
          ].includes(name),
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Exit account preview", exact: true })
      .click();
    await expect(page).toHaveURL(/\/developer\/members$/);
    expect(ended).toBe(true);
    targetRole = "admin";
    await page.reload();
    await page
      .getByRole("button", { name: "Preview account", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp("/developer/account-preview/" + session + "/office$"),
    );
    await expect(
      page.getByRole("heading", {
        name: "Overview",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await page.goto(
      "/developer/account-preview/" + session + "/office/finance",
    );
    await expect(
      page.getByRole("heading", {
        name: "Module access required",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Exit account preview", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Exit account preview", exact: true })
      .click();
    expect(calls.filter((c) => c === "POST /auth/v1/token")).toHaveLength(1);
  });
});
test.describe("new protected feature services", () => {
  test.skip(!configured);
  test("activity applications save pending and only expose resident withdrawal", async ({
    page,
  }) => {
    await api(page, { accounts: true });
    const activity = "86000000-0000-4000-8000-000000000001",
      id = "86000000-0000-4000-8000-000000000002";
    const rows: Array<Record<string, unknown>> = [];
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1),
          args = route.request().postDataJSON();
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_business_participation_dashboard")
          return reply({
            rows,
            total: rows.length,
            can_create: true,
            can_approve: false,
            activities: [
              {
                id: activity,
                title: "Synthetic workshop",
                capacity: 2,
                confirmed: 0,
              },
            ],
          });
        if (name === "bfe_request_business_participation") {
          expect(args.p_activity).toBe(activity);
          expect(args.p_places).toBe(2);
          rows.push({
            id,
            activity_title: "Synthetic workshop",
            places: 2,
            details: args.p_details,
            status: "Pending",
            version: 1,
            history: [],
          });
          return reply(id);
        }
        if (name === "bfe_decide_participation") {
          expect(args.p_status).toBe("Withdrawn");
          rows[0].status = "Withdrawn";
          rows[0].version = 2;
          return reply(null);
        }
        return route.fallback();
      },
    );
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto(
      `/directory/market?section=workshops&view=applications&activity=${activity}`,
    );
    let dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Activity", exact: true })
      .selectOption(activity);
    await dialog.getByLabel("Places", { exact: true }).fill("2");
    await dialog
      .getByLabel("Participant name", { exact: true })
      .fill("Synthetic participant");
    await dialog
      .getByLabel("Contact phone", { exact: true })
      .fill("09170000000");
    await dialog
      .getByLabel("Application details")
      .fill("Synthetic workshop application");
    await dialog.getByRole("button", { name: "Submit application" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Application saved. Confirmation is pending."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Manage application" }).click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("option", { name: "Confirmed", exact: true }),
    ).toHaveCount(0);
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic resident withdrawal");
    await dialog
      .getByRole("button", { name: "Withdraw application", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
  });
  test("live structured fields save only through the server and preserve restricted views", async ({
    page,
  }) => {
    await api(page, { accounts: true });
    const records: Array<Record<string, unknown>> = [];
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1),
          args = route.request().postDataJSON();
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_feature_dashboard")
          return reply({
            rows: args.p_view === "mine" ? records : [],
            total: args.p_view === "mine" ? records.length : 0,
            can_create: true,
            can_review: false,
            can_publish: false,
            publishable: true,
          });
        if (name === "bfe_submit_feature") {
          expect(args.p_module).toBe("businesses");
          expect(args.p_consent).toBe(true);
          expect(args.p_fields.contact).toBe("sample@example.invalid");
          records.push({
            id: "85000000-0000-4000-8000-000000000001",
            module: args.p_module,
            title: args.p_title,
            detail: args.p_detail,
            fields: args.p_fields,
            status: "Submitted",
            version: 1,
            publication_consent: true,
            created_at: new Date().toISOString(),
          });
          return reply(records[0].id);
        }
        return route.fallback();
      },
    );
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto("/explore/businesses");
    await page
      .getByRole("button", { name: "New submission", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Synthetic business submission");
    await dialog
      .getByLabel("Details", { exact: true })
      .fill(
        "Synthetic private business details for the field validation test.",
      );
    const sample = sampleBaselineFields("businesses");
    for (const field of baselineModule("businesses").fields) {
      const control = field.options
        ? dialog.getByRole("combobox", {
            name: listingFieldLabel(field.label),
            exact: true,
          })
        : dialog.getByLabel(listingFieldLabel(field.label), { exact: true });
      if (field.options) await control.selectOption(sample[field.key]);
      else await control.fill(sample[field.key]);
    }
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Submit for review" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Submission saved by the server. Review is pending."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Synthetic business submission" }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "View", exact: true })
      .selectOption("published");
    await expect(
      page.getByRole("heading", { name: "Synthetic business submission" }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("facility and visitor forms use Philippine time and resident actions stay restricted", async ({
    page,
  }) => {
    await api(page, { accounts: true });
    const rows: Array<Record<string, unknown>> = [],
      visitors: Array<Record<string, unknown>> = [];
    const fid = "85000000-0000-4000-8000-000000000002",
      lid = "85000000-0000-4000-8000-000000000003";
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1),
          args = route.request().postDataJSON();
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_booking_dashboard")
          return reply({
            rows,
            total: rows.length,
            can_manage: false,
            can_approve: false,
            facilities: [
              {
                id: fid,
                name: "Synthetic facility",
                opens: "08:00:00",
                closes: "18:00:00",
                slot_minutes: 30,
                max_minutes: 120,
                capacity: 10,
                renters: true,
                active: true,
                policy_reference: "Synthetic approved policy",
              },
            ],
          });
        if (name === "bfe_booking_availability")
          return reply([
            { start: "2026-11-20T03:00:00Z", end: "2026-11-20T04:00:00Z" },
          ]);
        if (name === "bfe_create_booking") {
          expect(args.p_start).toBe("2026-11-20T01:00:00.000Z");
          rows.push({
            id: fid,
            facility_id: fid,
            facility_name: "Synthetic facility",
            starts_at: args.p_start,
            ends_at: args.p_end,
            purpose: args.p_purpose,
            attendees: args.p_attendees,
            status: "Pending",
            version: 1,
          });
          return reply(fid);
        }
        if (name === "bfe_visitor_dashboard")
          return reply({
            rows: visitors,
            total: visitors.length,
            can_create: true,
            can_approve: false,
            can_gate: false,
            lots: [{ id: lid, physical_id: "1-01-001" }],
          });
        if (name === "bfe_create_visitor_pass") {
          expect(args.p_from).toBe("2026-11-20T01:00:00.000Z");
          visitors.push({
            id: lid,
            visitor: args.p_visitor,
            purpose: args.p_purpose,
            plate: args.p_plate,
            physical_id: "1-01-001",
            valid_from: args.p_from,
            valid_until: args.p_until,
            status: "Pending",
            effective_status: "Pending",
            version: 1,
          });
          return reply(lid);
        }
        if (name === "bfe_workflow_history")
          return reply([
            {
              action: "Pending",
              note: "Synthetic pending submission",
              at: new Date().toISOString(),
            },
          ]);
        return route.fallback();
      },
    );
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto("/services/bookings");
    await page
      .getByRole("button", { name: "New booking", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Facility", exact: true })
      .selectOption(fid);
    await dialog.getByLabel("Date", { exact: true }).fill("2026-11-20");
    await expect(
      dialog.getByRole("button", { name: "11:00 AM Reserved", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "9:00 AM", exact: true }).click();
    await dialog.getByRole("button", { name: "9:30 AM", exact: true }).click();
    await expect(dialog.getByLabel("Start time")).toHaveValue("09:00");
    await expect(dialog.getByLabel("End time")).toHaveValue("10:00");
    await dialog.getByText("Enter times manually", { exact: true }).click();
    await dialog.getByLabel("Start time").fill("11:00");
    await dialog.getByLabel("End time").fill("12:00");
    await expect(
      dialog.getByRole("button", { name: "Submit for approval", exact: true }),
    ).toBeDisabled();
    await dialog.getByLabel("Start time").fill("09:00");
    await dialog.getByLabel("End time").fill("10:00");
    await dialog.getByLabel("Date", { exact: true }).fill("2026-11-21");
    await expect(dialog.getByLabel("Start time")).toHaveValue("");
    await expect(dialog.getByLabel("End time")).toHaveValue("");
    await dialog.getByLabel("Date", { exact: true }).fill("2026-11-20");
    await dialog.getByRole("button", { name: "9:00 AM", exact: true }).click();
    await dialog.getByRole("button", { name: "9:30 AM", exact: true }).click();
    await page.screenshot({ path: "test-results/ui-review/booking-slots.png" });
    await dialog.getByLabel("Attendees").fill("2");
    await dialog.getByLabel("Purpose").fill("Synthetic family meeting");
    await dialog.getByRole("button", { name: "Submit for approval" }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto("/services/visitors");
    await page
      .getByRole("button", { name: "New visitor pass", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Verified lot", exact: true })
      .selectOption(lid);
    await dialog.getByLabel("Visitor name").fill("Synthetic visitor");
    await dialog.getByLabel("Valid from").fill("2026-11-20T09:00");
    await dialog.getByLabel("Valid until").fill("2026-11-20T10:00");
    await dialog.getByLabel("Purpose").fill("Synthetic household visit");
    await dialog.getByRole("button", { name: "Submit for approval" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "View actions" }).click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("option", { name: "Approved", exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("option", { name: "Entered", exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("option", { name: "Cancelled", exact: true }),
    ).toHaveCount(1);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
});
const uid = "11111111-1111-4111-8111-111111111111";
const identityRead = (call: string) =>
  call.endsWith("/rpc/bfe_get_member") || call.endsWith("/rpc/bfe_my_access");
const readRpc = (call: string) =>
  /POST \/rest\/v1\/rpc\/(bfe_get_member|bfe_my_access|bfe_get_profile|bfe_my_notifications|bfe_staff_directory|bfe_monitor_module|bfe_access_members|bfe_member_assignments)$/.test(
    call,
  );
const baseMember = {
  id: "synthetic-member",
  user_id: uid,
  name: "Synthetic Member",
  unit: "Sample A",
  role: "homeowner",
  extra_roles: [] as string[],
  status: "Active",
};
type Options = {
  accounts?: boolean;
  developerControl?: boolean;
  slowProfile?: boolean;
  seedRequest?: boolean;
  permissions?: Array<{ module: string; action: string; scope: string }>;
  tabModes?: Array<{ module: string; scope: string; mode: string }>;
  permissionsMissing?: boolean;
  monitor?: boolean;
  monitorDenied?: boolean;
  liveRequests?: boolean;
  people?: boolean;
  peopleDenied?: boolean;
  member?: typeof baseMember | null;
  loginFails?: boolean;
  identityFails?: boolean;
  memberFails?: boolean;
  duplicate?: boolean;
};
async function api(page: Page, options: Options = {}) {
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "sample@example.invalid",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { role: "admin" },
  };
  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    const access = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: uid,
          aud: "authenticated",
          role: "authenticated",
          exp: now + 3600,
          iat: now,
        }),
      ).toString("base64url"),
      "synthetic-not-a-signature",
    ].join(".");
    return {
      access_token: access,
      refresh_token: "synthetic-not-a-real-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
      user,
    };
  };
  const calls: string[] = [];
  const requestRows: Array<Record<string, unknown>> = options.seedRequest
    ? [
        {
          id: "50000000-0000-4000-8000-000000000009",
          client_id: "50000000-0000-4000-8000-000000000008",
          owner_id: "11111111-1111-4111-8111-111111111112",
          title: "Sample resident repair",
          description: "An invented repair request for testing.",
          category: "Maintenance",
          unit_snapshot: "Sample B",
          status: "Open",
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    : [];
  const requestMessages: Array<Record<string, unknown>> = [];
  let preferences = {
    display_name: "",
    phone: "",
    bio: "",
    updated_at: null as string | null,
  };
  const notices = options.accounts
    ? [
        {
          id: "71000000-0000-4000-8000-000000000001",
          kind: "request",
          title: "Synthetic request update",
          body: "An invented request update.",
          path: "/services/requests",
          created_at: new Date(Date.now() - 120000).toISOString(),
          read_at: null as string | null,
        },
        {
          id: "71000000-0000-4000-8000-000000000002",
          kind: "account",
          title: "Synthetic account activity",
          body: "An invented account update.",
          path: "/more/profile",
          created_at: new Date().toISOString(),
          read_at: new Date().toISOString(),
        },
        {
          id: "71000000-0000-4000-8000-000000000003",
          kind: "community",
          title: "Synthetic earlier reminder",
          body: "An invented earlier reminder.",
          path: "/more/notifications",
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
          read_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      ]
    : [];
  const staff = {
    user_id: "11111111-1111-4111-8111-111111111112",
    name: "Sample Staff",
    unit: "Sample B",
    role: "admin",
    extra_roles: [] as string[],
    status: "Active",
  };
  await page.route("https://bellefort-auth-test.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);
    const reply = (
      body: unknown,
      status = 200,
      headers?: Record<string, string>,
    ) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers,
        body: JSON.stringify(body),
      });
    if (url.pathname === "/auth/v1/token")
      return options.loginFails
        ? reply(
            {
              error: "invalid_grant",
              error_description: "Synthetic rejection",
            },
            400,
          )
        : reply(token());
    if (url.pathname === "/auth/v1/user") {
      if (options.identityFails)
        return reply({ message: "Synthetic invalid session" }, 401);
      return reply(user);
    }
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 });
    if (url.pathname === "/auth/v1/recover") return reply({});
    if (url.pathname === "/rest/v1/rpc/bfe_session_status")
      return reply({
        valid: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        idle_expires_at: new Date(Date.now() + 86400000).toISOString(),
        server_now: new Date().toISOString(),
      });
    if (url.pathname === "/rest/v1/rpc/bfe_navigation_action_badges")
      return reply({ as_of: new Date().toISOString() });
    if (
      url.pathname === "/rest/v1/bfe_requests" ||
      url.pathname === "/rest/v1/bfe_request_messages"
    ) {
      if (!options.liveRequests)
        return reply(
          { code: "PGRST205", message: "Synthetic missing request storage" },
          404,
        );
      let rows = url.pathname.endsWith("messages")
        ? requestMessages
        : requestRows;
      if (url.searchParams.get("status")) {
        const filter = url.searchParams.get("status")!;
        rows = rows.filter((row) =>
          filter.startsWith("neq.")
            ? `neq.${row.status}` !== filter
            : `eq.${row.status}` === filter,
        );
      }
      if (url.searchParams.get("request_id"))
        rows = rows.filter(
          (row) =>
            `eq.${row.request_id}` === url.searchParams.get("request_id"),
        );
      return reply(request.method() === "HEAD" ? null : rows, 200, {
        "content-range": rows.length
          ? `0-${rows.length - 1}/${rows.length}`
          : "*/0",
        "access-control-expose-headers": "content-range",
      });
    }
    if (url.pathname === "/rest/v1/rpc/bfe_get_member") {
      if (!options.accounts)
        return reply(
          { code: "PGRST202", message: "Synthetic legacy membership lookup" },
          404,
        );
      if (options.memberFails || options.duplicate)
        return reply(
          { code: "42501", message: "Synthetic membership refusal" },
          403,
        );
      return reply(options.member === undefined ? baseMember : options.member);
    }
    if (
      [
        "bfe_get_profile",
        "bfe_save_profile",
        "bfe_my_notifications",
        "bfe_mark_notifications",
        "bfe_access_members",
        "bfe_member_assignments",
        "bfe_provision_access",
        "bfe_update_member_access",
        "bfe_revoke_assignment",
      ].some((name) => url.pathname === `/rest/v1/rpc/${name}`)
    ) {
      if (!options.accounts)
        return reply(
          { code: "PGRST202", message: "Synthetic missing account setup" },
          404,
        );
      const name = url.pathname.split("/").at(-1);
      const args = request.postDataJSON();
      if (name === "bfe_get_profile") return reply(preferences);
      if (name === "bfe_save_profile") {
        expect(args.user_id).toBeUndefined();
        expect(args.role).toBeUndefined();
        if (options.slowProfile)
          await new Promise((resolve) => setTimeout(resolve, 3000));
        preferences = {
          display_name: args.p_display_name,
          phone: args.p_phone,
          bio: args.p_bio,
          updated_at: new Date().toISOString(),
        };
        notices.unshift({
          id: "71000000-0000-4000-8000-000000000004",
          kind: "account",
          title: "Profile updated",
          body: "Your profile preferences were saved.",
          path: "/more/profile",
          created_at: new Date().toISOString(),
          read_at: null,
        });
        return reply(preferences);
      }
      if (name === "bfe_my_notifications") {
        const filtered = notices.filter(
          (n) => !args.p_unread_only || !n.read_at,
        );
        return reply({
          rows: filtered.slice(args.p_page * 20, args.p_page * 20 + 20),
          total: filtered.length,
          unread: notices.filter((n) => !n.read_at).length,
        });
      }
      if (name === "bfe_mark_notifications") {
        for (const n of notices)
          if (!args.p_ids || args.p_ids.includes(n.id))
            n.read_at ??= new Date().toISOString();
        return reply(null);
      }
      if (name === "bfe_access_members")
        return reply({ rows: [staff], total: 1 });
      if (name === "bfe_member_assignments") return reply([]);
      if (name === "bfe_update_member_access") {
        expect(args.p_reference).toBe("Synthetic approved change");
        expect(args.p_expected).toEqual({
          role: staff.role,
          extra_roles: staff.extra_roles,
          status: staff.status,
        });
        staff.role = args.p_role;
        staff.extra_roles = args.p_extra;
        staff.status = args.p_status;
        return reply(null);
      }
      if (name === "bfe_provision_access")
        return reply("81000000-0000-4000-8000-000000000001");
      return reply(null);
    }
    if (url.pathname === "/rest/v1/rpc/bfe_staff_directory") {
      if (!options.people)
        return reply(
          { code: "PGRST202", message: "Synthetic missing staff directory" },
          404,
        );
      if (options.peopleDenied)
        return reply({ code: "42501", message: "Synthetic refusal" }, 403);
      const args = request.postDataJSON();
      const offset = args.p_page * 20;
      const search = !!args.p_search;
      const rows = Array.from(
        { length: search ? 1 : offset ? 1 : 20 },
        (_, index) => ({
          id: `synthetic-directory-${offset + index}`,
          user_id: null,
          name: `Sample Person ${offset + index}`,
          email: `person${offset + index}@example.invalid`,
          phone: null,
          unit: null,
          title: null,
          role: "renter",
          extra_roles: ["homeowner"],
          status: args.p_kind === "registrations" ? "Pending" : "Active",
          last_seen: null,
          created_at: "2026-11-05T00:00:00Z",
          review_note: null,
        }),
      );
      return reply({ rows, total: search ? 1 : 21 });
    }
    if (url.pathname === "/rest/v1/rpc/bfe_my_access") {
      if (options.permissionsMissing)
        return reply(
          { code: "PGRST202", message: "Synthetic missing access setup" },
          404,
        );
      const modules = [
        "overview",
        "people",
        "registrations",
        "requests",
        "operations",
        "finance",
        "community",
        "documents",
        "calendar",
      ];
      return reply({
        version: 1,
        developer_control: options.developerControl ?? false,
        committees: [],
        tab_modes: options.tabModes ?? [],
        capabilities:
          options.permissions ??
          modules
            .flatMap((module) =>
              ["view", "summary", "reply", "status"].map((action) => ({
                module,
                action,
                scope: "association",
              })),
            )
            .concat([
              { module: "requests", action: "reply", scope: "own" },
              { module: "calendar", action: "view", scope: "own" },
              { module: "calendar", action: "create", scope: "own" },
            ]),
      });
    }
    if (url.pathname === "/rest/v1/rpc/bfe_monitor_module") {
      expect(request.method()).toBe("POST");
      if (!options.monitor)
        return reply(
          { code: "PGRST202", message: "Synthetic missing monitor" },
          404,
        );
      if (options.monitorDenied)
        return reply(
          { code: "42501", message: "Synthetic monitoring refusal" },
          403,
        );
      const args = request.postDataJSON();
      if (args.p_section === "incidents")
        return reply({
          source: "incidents",
          present: false,
          total: null,
          rows: [],
        });
      return reply({
        source: args.p_section,
        present: true,
        total: 21,
        rows: Array.from({ length: args.p_page ? 1 : 20 }, (_, index) => ({
          reference: `sample-monitor-${args.p_page * 20 + index}`,
          label: `Sample gate pass ${args.p_page * 20 + index}`,
          status: "Approved",
          unit: "Sample A",
          recorded_at: "2026-11-05T00:00:00Z",
          fields: {
            id: `sample-monitor-${index}`,
            status: "Approved",
            unit: "Sample A",
            note: "Synthetic monitored data",
          },
        })),
      });
    }
    if (
      [
        "bfe_create_request",
        "bfe_create_business_request",
        "bfe_reply_request",
        "bfe_set_request_status",
      ].some((name) => url.pathname === `/rest/v1/rpc/${name}`)
    ) {
      expect(options.liveRequests).toBe(true);
      expect(request.method()).toBe("POST");
      const args = request.postDataJSON();
      const now = new Date().toISOString();
      if (
        url.pathname.endsWith("bfe_create_request") ||
        url.pathname.endsWith("bfe_create_business_request")
      ) {
        expect(args.owner_id).toBeUndefined();
        const existing = requestRows.find(
          (row) => row.client_id === args.p_client_id,
        );
        if (existing) return reply(existing);
        const row = {
          id: "50000000-0000-4000-8000-000000000001",
          client_id: args.p_client_id,
          owner_id: uid,
          title: args.p_title,
          description: args.p_description,
          category: args.p_category,
          business_details: args.p_details ?? {},
          unit_snapshot: "Sample A",
          status: "Open",
          version: 1,
          created_at: now,
          updated_at: now,
        };
        requestRows.push(row);
        return reply(row);
      }
      if (url.pathname.endsWith("bfe_reply_request")) {
        const row = {
          id: "60000000-0000-4000-8000-000000000001",
          request_id: args.p_request_id,
          author_id: uid,
          author_kind: "Office",
          body: args.p_body,
          created_at: now,
        };
        requestMessages.push(row);
        return reply(row);
      }
      if (url.pathname.endsWith("bfe_set_request_status")) {
        const row = requestRows.find((row) => row.id === args.p_request_id)!;
        row.status = args.p_status;
        row.version = Number(row.version) + 1;
        row.updated_at = now;
        return reply(row);
      }
    }
    if (
      (url.pathname === "/rest/v1/members" &&
        !url.searchParams.has("user_id")) ||
      url.pathname === "/rest/v1/registrations"
    ) {
      expect(options.people).toBe(true);
      expect(request.method()).toBe("GET");
      expect(url.searchParams.get("select")).not.toContain("proof");
      expect(url.searchParams.get("select")).not.toBe("*");
      if (options.peopleDenied)
        return reply({ code: "42501", message: "Synthetic refusal" }, 403);
      const application = url.pathname.endsWith("registrations");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const search = url.searchParams.get("name");
      const total = search ? 1 : 21;
      const items = Array.from(
        { length: search ? 1 : offset ? 1 : 20 },
        (_, index) => ({
          id: `synthetic-directory-${offset + index}`,
          user_id: null,
          name: `Sample Person ${offset + index}`,
          email: `person${offset + index}@example.invalid`,
          phone: null,
          unit: null,
          title: null,
          role: "renter",
          extra_roles: ["homeowner"],
          status: application ? "Pending" : "Active",
          last_seen: null,
          created_at: "2026-11-05T00:00:00Z",
          review_note: null,
        }),
      );
      return reply(items, 200, {
        "content-range": `${offset}-${offset + items.length - 1}/${total}`,
        "access-control-expose-headers": "content-range",
      });
    }
    if (url.pathname === "/rest/v1/members") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${uid}`);
      expect(url.searchParams.get("select")).toBe(
        "id,user_id,name,unit,role,extra_roles,status,title,phone",
      );
      if (options.memberFails)
        return reply(
          { message: "Synthetic policy refusal", code: "42501" },
          403,
        );
      const member = options.member === undefined ? baseMember : options.member;
      return reply(
        member
          ? options.duplicate
            ? [member, { ...member, id: "synthetic-duplicate" }]
            : [member]
          : [],
      );
    }
    if (url.pathname.startsWith("/rest/v1/rpc/bfe_"))
      return reply(
        { code: "PGRST202", message: "Synthetic unavailable service" },
        404,
      );
    throw new Error(
      `Unexpected simulated endpoint: ${request.method()} ${url.pathname}`,
    );
  });
  return calls;
}
async function login(page: Page) {
  await page.goto("/sign-in");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("sample@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-only-input-for-testing");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.describe("private lot register", () => {
  test.skip(!configured);
  test("lot profile, corrections, receipt reporting and responsive dialogs", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await api(page, {
      accounts: true,
      developerControl: true,
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
    });
    const id = "65000000-0000-4000-8000-000000000001";
    let currentName = "Synthetic homeowner";
    let version = 1;
    const lot = () => ({
      id,
      physical_id: "1-01-001",
      phase: 1,
      block: 1,
      lot: 1,
      admin_unit: "SYNTHETIC-001",
      registry_status: "Synthetic registry",
      recorded_homeowner: currentName,
      review_priority: "MEDIUM",
      version,
    });
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_list_lots") return reply({ rows: [lot()], total: 1 });
        if (name === "bfe_lot_detail")
          return reply({
            ...lot(),
            original_homeowner: "Synthetic homeowner",
            evidence: {
              "Verified Monthly Rate": null,
              "Agency Receipt Transactions": currentName === "" ? 0 : 1,
              "HOA Eligibility (provisional)": "Synthetic unverified",
            },
            memberships: [],
            history: [],
            source: {
              batch_id: id,
              source_name: "synthetic.xlsx",
              imported_at: "2026-01-01T00:00:00Z",
            },
          });
        if (name === "bfe_correct_homeowner") {
          currentName = route.request().postDataJSON().p_name;
          version++;
          return reply(null);
        }
        if (name === "bfe_lot_receipts") {
          const args = route.request().postDataJSON();
          if (args.p_lot) expect(args.p_lot).toBe(id);
          if (currentName === "")
            return reply({
              rows: [],
              total: 0,
              total_centavos: 0,
              monthly: [],
              phases: [],
              lots: [],
            });
          return reply({
            rows: [
              {
                id,
                lot_id: id,
                physical_id: "1-01-001",
                or_number: "00001",
                receipt_date: "2026-01-02",
                amount_centavos: 90000,
                account_series: "SYNTHETIC",
                payer: "Synthetic payer",
                source_file: "synthetic.xlsx",
                batch_id: id,
              },
            ],
            total: 1,
            total_centavos: 90000,
            monthly: [{ month: "2026-01", count: 1, amount_centavos: 90000 }],
            phases: [{ phase: 1, count: 1, amount_centavos: 90000 }],
            lots: [
              { physical_id: "1-01-001", count: 1, amount_centavos: 90000 },
            ],
          });
        }
        return route.fallback();
      },
    );
    await login(page);
    await expect(page).toHaveURL(/\/developer$/);
    await page.goto("/office/lots");
    await expect(
      page.getByRole("heading", { name: "Lot register", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link")
      .filter({
        has: page.getByRole("heading", { name: "1-01-001", exact: true }),
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Property overview" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Correct recorded name" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Correct recorded homeowner",
    });
    await dialog
      .getByLabel("Corrected recorded name")
      .fill("Corrected synthetic owner");
    await dialog
      .getByLabel("Verification / approval reference")
      .fill("Synthetic evidence reference");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Save verified change" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByText("Corrected synthetic owner", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Receipts", exact: true }).click();
    await expect(page.getByText("OR 00001", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "1-01-001", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/more/lots/${id}\\?section=receipts$`),
    );
    await expect(
      page.getByRole("button", { name: "Receipts", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("OR 00001", { exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    expect((await download).suggestedFilename()).toContain(
      "recorded-collections",
    );
    for (const width of [390, 1440])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: test.info().outputPath(`registry-${width}-${theme}.png`),
        });
      }
    for (const path of [
      "/office/finance",
      "/office/finance/collections",
      "/office/finance/reports",
    ]) {
      await page.goto(path);
      await expect(page.getByText("OR 00001", { exact: true })).toBeVisible();
      await expect(page.getByText("Sample ledger snapshot")).toHaveCount(0);
      await expect(
        page.getByText("Account: SYNTHETIC", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/Total billed, outstanding balances/),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    for (const section of ["expenses", "reconciliation"]) {
      await page.goto(`/office/finance/${section}`);
      await expect(
        page.getByRole("heading", {
          name:
            section === "expenses"
              ? "Expense totals unavailable"
              : "Reconciled balance unavailable",
        }),
      ).toBeVisible();
      await expect(page.getByText("Six synthetic billed units")).toHaveCount(0);
    }
    currentName = "";
    await page.goto(`/more/lots/${id}?section=receipts`);
    await expect(
      page.getByRole("heading", { name: "No receipts supplied for this lot" }),
    ).toBeVisible();
    await page.goto("/more/lots?search=1-01-001");
    await expect(page.getByRole("textbox", { name: "Find a lot" })).toHaveValue(
      "1-01-001",
    );
    await page.goto("/office/lots");
    await expect(
      page.getByText("Homeowner name not supplied", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Verified property link", { exact: true }),
    ).toHaveCount(0);
  });
  test("missing migration fails closed without substituting samples", async ({
    page,
  }) => {
    await api(page, { accounts: true });
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_list_lots",
      (route) =>
        route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            code: "PGRST202",
            message: "Synthetic missing migration",
          }),
        }),
    );
    await login(page);
    await page.goto("/account");
    await expect(
      page.getByText(
        "Lot services need migration 005. No sample data has been substituted.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Sample homeowner", { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.get("/.private-imports/not-a-real-file.sql")
      ).status(),
    ).toBe(403);
  });
});

test.describe("customer workflow improvements", () => {
  test.skip(!configured);
  test("authorized shuttle driver follows pickup lifecycle and reviews served history", async ({
    page,
  }, testInfo) => {
    await api(page, {
      accounts: true,
      member: { ...baseMember, role: "driver" },
    });
    const id = "78000000-0000-4000-8000-000000000003";
    let status = "Waiting for Shuttle",
      version = 1;
    let ready = true;
    let arrived: string | null = null;
    const created = new Date().toISOString();
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        const args = route.request().postDataJSON();
        const reply = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (name === "bfe_update_shuttle_request") {
          expect(args.p_version).toBe(version);
          status = args.p_status;
          if (status === "Accepted") ready = false;
          version++;
          if (status === "Arrived") arrived = new Date().toISOString();
          return reply(null);
        }
        if (name === "bfe_shuttle_presence") return reply(null);
        if (name === "bfe_shuttle_ready") {
          ready = true;
          return reply(null);
        }
        if (name === "bfe_shuttle_dashboard") {
          const closed = status === "Picked up";
          return reply({
            server_now: new Date().toISOString(),
            driver: true,
            reviewer: false,
            manager: false,
            total: closed === args.p_history ? 1 : 0,
            waiting_count: status === "Waiting for Shuttle" ? 1 : 0,
            latest_outcome: null,
            eligible_drivers: [],
            shuttles: [
              {
                code: "Shuttle 1",
                driver_name: "Synthetic shuttle driver",
                capacity: 4,
                on_duty: true,
                available: true,
                ready,
                contact: "",
                active: true,
                busy: !ready,
                driver_id: uid,
              },
              {
                code: "Shuttle 2",
                driver_name: "Synthetic second driver",
                capacity: 6,
                on_duty: false,
                available: false,
                ready: false,
                contact: "",
                active: true,
                busy: false,
                driver_id: "78000000-0000-4000-8000-000000000004",
              },
            ],
            rows:
              closed === args.p_history
                ? [
                    {
                      id,
                      owner_id: "78000000-0000-4000-8000-000000000002",
                      driver_id: status === "Waiting for Shuttle" ? null : uid,
                      shuttle_code:
                        status === "Waiting for Shuttle" ? null : "Shuttle 1",
                      pickup: "Synthetic clubhouse",
                      destination: "Synthetic gate",
                      passengers: 2,
                      status,
                      created_at: created,
                      expires_at: new Date(
                        Date.parse(created) + 3_600_000,
                      ).toISOString(),
                      arrived_at: arrived,
                      version,
                      reason: null,
                      prior_day: false,
                    },
                  ]
                : [],
          });
        }
        return route.fallback();
      },
    );
    await login(page);
    await page.goto("/driver/dispatch");
    await expect(
      page.getByRole("heading", { name: "Shuttle service", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Accept request", exact: true })
      .click();
    await page.getByRole("button", { name: "On the way", exact: true }).click();
    const progress = page.getByRole("list", { name: "Pickup progress" });
    await expect(progress.locator('[aria-current="step"]')).toContainText(
      "Heading to pickup",
    );
    await page
      .getByRole("group", { name: "Browse shuttles" })
      .getByRole("button", { name: /^Shuttle 2/ })
      .click();
    await expect(
      page.getByText("Synthetic second driver", { exact: false }),
    ).toBeVisible();
    // Browsing another vehicle must not reassign the existing request.
    expect(status).toBe("On the way");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await progress.scrollIntoViewIfNeeded();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path:
            "test-results/ui-review/" +
            testInfo.project.name +
            "-shuttle-" +
            width +
            "-" +
            theme +
            ".png",
        });
      }
    }
    await page.getByRole("button", { name: "Arrived", exact: true }).click();
    await expect(
      page.getByText(
        "Shuttle at pickup. Confirm pickup once the passenger has boarded.",
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirm pickup", exact: true })
      .click();
    await expect(
      page.getByText("No active requests visible to your account today."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ready for next pickup", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Service history", exact: true })
      .click();
    await expect(
      page.locator("article").getByText("Picked up", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Outcome" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("Helpdesk ideas, consolidated report choices and Buyani handoff", async ({
    page,
  }) => {
    await api(page, {
      accounts: true,
      liveRequests: true,
      developerControl: true,
      member: {
        ...baseMember,
        role: "admin",
        extra_roles: ["developer", "homeowner"],
      },
    });
    await login(page);
    await page.goto("/services/requests");
    await page
      .getByRole("button", { name: "New request", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "New request",
      exact: true,
    });
    await expect(dialog.getByRole("combobox", { name: "Category" })).toHaveText(
      /Maintenance IssueViolation or ComplaintConcern and SuggestionDocument requestSupport/,
    );
    await dialog
      .getByRole("combobox", { name: "Category" })
      .selectOption("Concern");
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Synthetic system idea");
    await dialog
      .getByLabel("Details", { exact: true })
      .fill("A synthetic idea for an improved community service.");
    await dialog.getByRole("button", { name: "Submit request" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByText("Synthetic system idea", { exact: true }),
    ).toBeVisible();
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_lot_receipts",
      (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            rows: [],
            total: 0,
            total_centavos: 0,
            monthly: [],
            phases: [],
            lots: [],
          }),
        }),
    );
    await page.goto("/office/finance/reports");
    const navigation = page.getByRole("navigation", {
      name: "Finance workspace navigation",
    });
    await expect(navigation.getByRole("link")).toHaveCount(2);
    for (const report of [
      "balance-sheet",
      "income-expense",
      "budget-actual",
      "reserves",
      "aging",
      "delinquency",
      "bank",
    ]) {
      await page
        .getByRole("combobox", { name: "Report", exact: true })
        .selectOption(report);
      await expect(
        page.getByText(
          "Unavailable — required records have not been supplied.",
          { exact: true },
        ),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_list_lots",
      (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ rows: [], total: 0 }),
        }),
    );
    await page.goto("/account");
    await expect(page.getByText("BF1-019-026", { exact: true })).toBeVisible();
    const buyani = page.getByRole("link", { name: /Continue to Buyani/ });
    await expect(buyani).toHaveAttribute("href", "https://pay.buyani.com/");
    await expect(buyani).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
});

test.describe("real auth without connection settings", () => {
  test.skip(configured);
  test("shows a disabled sign-in and blocks every protected workspace", async ({
    page,
  }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
        external.push(request.url());
    });
    for (const path of ["/", "/office", "/board", "/security", "/driver"]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(
        page.getByRole("heading", { name: "Welcome back" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign in", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: /Resident preview/ }),
      ).toHaveCount(0);
    }
    expect(external).toEqual([]);
  });
});

test.describe("account profiles notifications developer control and installation", () => {
  test.skip(!configured);
  test("own profile saves safely and notification badges/read groups stay in sync", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await api(page, { accounts: true, slowProfile: true });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/more/profile");
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Edit your profile",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await editor
      .getByLabel("Display name", { exact: true })
      .fill("Sample Preferred Name");
    await editor
      .getByLabel("Profile contact number", { exact: true })
      .fill("+63 900 000 0000");
    await editor
      .getByLabel("About you", { exact: true })
      .fill("Synthetic profile preferences for testing.");
    await editor
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "Close dialog", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveCount(0, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Sample Preferred Name", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic Member", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await page
      .getByRole("button", { name: "Notifications, 2 unread", exact: true })
      .click();
    const pop = page.getByRole("dialog", {
      name: "Notifications",
      exact: true,
    });
    for (const group of ["New", "Today", "Earlier"])
      await expect(
        pop.getByRole("heading", { name: group, exact: true }),
      ).toBeVisible();
    await pop
      .getByRole("button", { name: "Mark all read", exact: true })
      .click();
    await pop.getByRole("button", { name: "Unread", exact: true }).click();
    await expect(
      pop.getByRole("heading", { name: "You’re all caught up", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Notifications", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "See all notifications", exact: true })
      .click();
    await expect(page).toHaveURL(/\/more\/notifications$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Notifications", level: 1 }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
  test("account services missing setup never substitutes sample records", async ({
    page,
  }) => {
    await api(page);
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/more/profile");
    await expect(
      page.getByRole("button", { name: "Edit profile", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "migration 004",
    );
    await expect(
      page.getByText("Synthetic request update", { exact: true }),
    ).toHaveCount(0);
  });
  test("developer controls operate real workspaces and retain isolated role previews", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const calls = await api(page, {
      accounts: true,
      developerControl: true,
      permissions: [],
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
      liveRequests: true,
      seedRequest: true,
      people: true,
      monitor: true,
    });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/office");
    await expect(
      page.getByRole("heading", {
        name: "Overview",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await page.goto("/developer/access");
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    await page
      .locator("summary")
      .filter({ hasText: /^Roles, account status & committee permissions$/ })
      .click();
    await page
      .getByLabel("Approval reference", { exact: true })
      .fill("Synthetic approved change");
    await page.getByRole("checkbox", { name: "security", exact: true }).check();
    await page
      .getByRole("button", { name: "Review account change", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Sample Staff");
    await page
      .getByRole("button", { name: "Confirm access change", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "confirmed by the server",
    );
    await page
      .getByRole("button", { name: "Review permission change", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm access change", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      calls.some((call) => call.endsWith("/rpc/bfe_update_member_access")),
    ).toBe(true);
    expect(
      calls.some((call) => call.endsWith("/rpc/bfe_provision_access")),
    ).toBe(true);
    await page.goto("/office/requests");
    await page
      .getByRole("button", { name: "Open Sample resident repair", exact: true })
      .click();
    await page
      .getByLabel("Your reply", { exact: true })
      .fill("Synthetic developer response.");
    await page.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Reply saved.");
    await page.getByRole("button", { name: "Start work", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("In progress");
    calls.length = 0;
    await page.goto("/developer/preview/admin/office");
    await expect(
      page.getByRole("region", { name: "Role preview session" }),
    ).toContainText("Synthetic data");
    await expect(
      page.getByRole("heading", {
        name: "Module access required",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Overview",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      calls.filter(
        (call) => call.startsWith("POST /rest/") && !identityRead(call),
      ),
    ).toEqual([]);
  });
  test("home-screen suggestion respects repeat visits dismissal and explicit install clicks", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await api(page, { accounts: true });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/more/profile");
    const offer = () =>
      page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        Object.assign(event, {
          prompt: async () => {
            const w = window as Window & { nativeInstallCalls?: number };
            w.nativeInstallCalls = (w.nativeInstallCalls ?? 0) + 1;
          },
          userChoice: Promise.resolve({ outcome: "accepted" }),
        });
        window.dispatchEvent(event);
      });
    await offer();
    await expect(
      page.getByRole("region", {
        name: "Add Bellefort to your home screen",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem("bellefort-install-visits", "1");
      sessionStorage.removeItem("bellefort-install-visit-counted");
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Edit profile", exact: true }),
    ).toBeVisible();
    await offer();
    const banner = page.getByRole("region", {
      name: "Add Bellefort to your home screen",
      exact: true,
    });
    await expect(banner).toBeVisible({ timeout: 20000 });
    expect(
      await page.evaluate(
        () =>
          (window as Window & { nativeInstallCalls?: number })
            .nativeInstallCalls ?? 0,
      ),
    ).toBe(0);
    await banner.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(banner).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          Number(localStorage.getItem("bellefort-install-dismissed-until")) >
          Date.now() + 6 * 86400000,
      ),
    ).toBe(true);
    await offer();
    await page.waitForTimeout(500);
    await expect(banner).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Add Bellefort to this device",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "App installed", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () =>
          (window as Window & { nativeInstallCalls?: number })
            .nativeInstallCalls ?? 0,
      ),
    ).toBe(1);
  });
  test("account pages and application popups fit desktop and thumb-friendly mobile layouts", async ({
    page,
  }) => {
    test.setTimeout(240000);
    await api(page, {
      accounts: true,
      developerControl: true,
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
      people: true,
      liveRequests: true,
      seedRequest: true,
    });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    for (const width of [320, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of [
          "/more/profile",
          "/more/notifications",
          "/developer/access",
          "/office",
        ]) {
          await page.goto(path);
          await page.evaluate(
            (value) => (document.documentElement.dataset.theme = value),
            theme,
          );
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 15000,
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${path} ${width}`,
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
            `${path} ${width} ${theme}`,
          ).toEqual([]);
          if (path === "/more/profile") {
            await page
              .getByRole("button", { name: "Edit profile", exact: true })
              .click();
            const modal = page.getByRole("dialog");
            await expect(
              modal.getByLabel("Display name", { exact: true }),
            ).toBeVisible();
            await modal
              .getByLabel("About you", { exact: true })
              .fill("Synthetic popup visual review.");
            const box = await modal.boundingBox();
            expect(
              box &&
                box.x >= -1 &&
                box.x + box.width <= width + 1 &&
                box.height <= 900,
            ).toBeTruthy();
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
            if (width === 320) {
              const save = await modal
                .getByRole("button", { name: "Save profile", exact: true })
                .boundingBox();
              expect(save && save.height >= 48).toBeTruthy();
            }
            if (theme === "light")
              await page.screenshot({
                path: test.info().outputPath(`profile-popup-${width}.png`),
              });
            await page.keyboard.press("Escape");
            await expect(modal).toHaveCount(0);
            await expect(
              page.getByRole("button", { name: "Edit profile", exact: true }),
            ).toBeFocused();
          }
        }
        await page
          .getByRole("button", { name: /Notifications, 1 unread/ })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        if (theme === "light")
          await page.screenshot({
            path: test.info().outputPath(`notification-popup-${width}.png`),
          });
        await page.keyboard.press("Escape");
        expect(await page.evaluate(() => document.body.style.overflow)).toBe(
          "",
        );
      }
  });
});

test.describe("explicit committee module permissions", () => {
  test.skip(!configured);
  test("missing access setup blocks office data without sample fallback", async ({
    page,
  }) => {
    const calls = await api(page, {
      member: { ...baseMember, role: "admin" },
      permissionsMissing: true,
      people: true,
    });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/office/residents");
    await expect(
      page.getByRole("heading", { name: "Module access required" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("Access permissions have not been installed.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      calls.filter(
        (call) => call.includes("/rest/v1/members") && !call.includes("rpc"),
      ).length,
    ).toBeGreaterThan(0);
    expect(calls.some((call) => call.includes("/rest/v1/registrations"))).toBe(
      false,
    );
    await expect(page.getByText("Synthetic household")).toHaveCount(0);
  });
  test("committee navigation hides ungranted modules and rejects direct links", async ({
    page,
  }) => {
    const calls = await api(page, {
      member: { ...baseMember, role: "admin" },
      permissions: [
        { module: "overview", action: "summary", scope: "association" },
        { module: "finance", action: "view", scope: "association" },
      ],
    });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/office");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("link", { name: "People", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Finance", exact: true }).first(),
    ).toBeVisible();
    await page.goto("/office/requests");
    await expect(
      page.getByRole("heading", { name: "Module access required" }),
    ).toBeVisible();
    expect(calls.some((call) => call.includes("/rest/v1/bfe_requests"))).toBe(
      false,
    );
    await page.goto("/office/unknown");
    await expect(
      page.getByRole("heading", { name: "Module access required" }),
    ).toBeVisible();
  });
  test("read-only request access separates reply and status grants and applies revocation", async ({
    page,
  }) => {
    const permissions = [
      { module: "requests", action: "view", scope: "association" },
    ];
    const calls = await api(page, {
      member: { ...baseMember, extra_roles: ["admin"] },
      permissions,
      liveRequests: true,
    });
    await login(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await page.goto("/services/requests?new=concern");
    await page
      .getByLabel("Concern and Suggestion type", { exact: true })
      .selectOption("Other");
    await page
      .getByLabel("Describe the other type", { exact: true })
      .fill("Synthetic read only case");
    await page
      .getByLabel("Details", { exact: true })
      .fill("Synthetic request for permission isolation.");
    await page
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Request saved.");
    await page.goto("/office/requests");
    await page
      .getByRole("button", {
        name: /Open .*Synthetic read only case/,
      })
      .click();
    await expect(page.locator("main")).toContainText("Read-only access.");
    await expect(
      page.getByRole("button", { name: "Start work", exact: true }),
    ).toHaveCount(0);
    permissions.push(
      { module: "requests", action: "reply", scope: "association" },
      { module: "requests", action: "status", scope: "association" },
    );
    await page.reload();
    await page
      .getByRole("button", {
        name: /Open .*Synthetic read only case/,
      })
      .click();
    await expect(page.getByLabel("Your reply")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start work", exact: true }),
    ).toBeVisible();
    permissions.length = 0;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Module access required" }),
    ).toBeVisible();
    expect(
      calls.some(
        (call) =>
          call.includes("rpc/bfe_reply_request") ||
          call.includes("rpc/bfe_set_request_status"),
      ),
    ).toBe(false);
  });
  test("developer access planning is accessible without provisioning controls", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
      permissions: [
        { module: "technical", action: "monitor", scope: "association" },
      ],
    });
    await login(page);
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto("/developer/access");
      await expect(
        page.getByRole("heading", { name: "Roles & committee access" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: "Finance", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("monitor · association", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await expect(
        page.getByRole("button", { name: /grant|approve/i }),
      ).toHaveCount(0);
    }
  });
});

test.describe("real auth against a simulated Supabase API", () => {
  test.skip(!configured);
  test("validates fields and masks passwords without sending invalid submissions", async ({
    page,
  }) => {
    const calls = await api(page);
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByLabel("Email address", { exact: true }),
    ).toBeFocused();
    await page.getByLabel("Password", { exact: true }).fill("synthetic-value");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    expect(calls.some((call) => call.endsWith("/token"))).toBe(false);
  });
  test("uses verified membership instead of user-editable metadata, and refuses office URLs", async ({
    page,
  }) => {
    await api(page);
    await login(page);
    await expect(
      page.getByRole("heading", { name: /Hello, Alex/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Home", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Office & administration" }),
    ).toHaveCount(0);
    await page.goto("/office/finance");
    await expect(
      page.getByRole("heading", { name: "This workspace is restricted" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Collections|Office overview/ }),
    ).toHaveCount(0);
  });
  test("restores a session, supports assigned extra roles and clears it on sign-out", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, extra_roles: ["admin", "security"] },
    });
    await login(page);
    await expect(page).toHaveURL(/\/workspaces$/);
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Office", exact: true }).click();
    await expect(page).toHaveURL(/\/office$/);
    await page.goto("/workspaces");
    await page.evaluate(() =>
      sessionStorage.setItem(
        "bellefort-workspace-v1",
        "synthetic-account-draft",
      ),
    );
    await page.goto("/sign-out");
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(
      await page.evaluate(() => localStorage.getItem("bellefort-auth-session")),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("bellefort-workspace-v1"),
      ),
    ).toBeNull();
    await page.goto("/office");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });
  for (const [label, options] of [
    ["unlinked", { member: null }],
    ["suspended", { member: { ...baseMember, status: "Suspended" } }],
    ["unknown role", { member: { ...baseMember, role: "unapproved-role" } }],
    ["duplicate link", { duplicate: true }],
    ["policy error", { memberFails: true }],
  ] as const)
    test(`denies ${label} membership`, async ({ page }) => {
      await api(page, options);
      await login(page);
      await expect(
        page.getByRole("heading", { name: "Your account needs a review" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Home", exact: true }),
      ).toHaveCount(0);
    });
  test("rejects invalid credentials without exposing provider error details", async ({
    page,
  }) => {
    await api(page, { loginFails: true });
    await login(page);
    await expect(page.getByRole("alert")).toContainText("Sign-in failed");
    await expect(page.getByRole("alert")).not.toContainText(
      "Synthetic rejection",
    );
    await expect(page).toHaveURL(/\/sign-in$/);
  });
  test("a stored token cannot bypass server identity verification", async ({
    page,
  }) => {
    const calls = await api(page, { identityFails: true });
    await login(page);
    await expect(page.getByRole("alert")).toContainText(
      "could not verify your saved session",
      { timeout: 15000 },
    );
    await page.goto("/office");
    await expect(
      page.getByRole("heading", { name: "Connection interrupted" }),
    ).toBeVisible({ timeout: 15000 });
    expect(calls.some((call) => identityRead(call))).toBe(false);
    await expect(
      page.getByRole("link", { name: "Review inbox", exact: true }),
    ).toHaveCount(0);
  });
  test("role revocation is applied on membership revalidation", async ({
    page,
  }) => {
    const options: Options = {
      member: { ...baseMember, extra_roles: ["admin"] },
    };
    await api(page, options);
    await login(page);
    await expect(
      page.getByRole("link", { name: "Office", exact: true }),
    ).toBeVisible();
    options.member = { ...baseMember, status: "Suspended" };
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Your account needs a review" }),
    ).toBeVisible();
  });
  test("an expired session with a rejected refresh returns to sign-in", async ({
    page,
  }) => {
    const options: Options = {};
    await api(page, options);
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Home", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      const value = JSON.parse(localStorage.getItem("bellefort-auth-session")!);
      value.expires_at = Math.floor(Date.now() / 1000) - 120;
      localStorage.setItem("bellefort-auth-session", JSON.stringify(value));
    });
    options.loginFails = true;
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });
  test("recovery uses a generic response, completes password update, and requires a valid session", async ({
    page,
  }) => {
    const calls = await api(page);
    await page.goto("/reset-password");
    await expect(
      page.getByText("A valid recovery link is needed"),
    ).toBeVisible();
    await page.goto("/recover");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("sample@example.invalid");
    await page.getByRole("button", { name: "Send recovery link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "If your account is eligible",
    );
    await page.goto("/reset-password?code=synthetic-recovery-code");
    await expect(
      page.getByLabel("New password", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("New password", { exact: true })
      .fill("Synthetic-new-password-only");
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill("Synthetic-new-password-only");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated");
    expect(calls).toContain("PUT /auth/v1/user");
    expect(calls).toContain("POST /auth/v1/logout");
  });
  test("auth screens are accessible and fit small and desktop viewports", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await api(page);
    for (const width of [320, 390, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(
          (value) => localStorage.setItem("bellefort-theme", value),
          theme,
        );
        for (const path of [
          "/sign-in",
          "/recover",
          "/register",
          "/reset-password",
        ]) {
          await page.goto(path);
          await expect(page.locator("h1")).toBeVisible();
          await expect(
            page.getByRole("img", { name: "Bellefort Estates", exact: true }),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${path} ${width} ${theme}`,
          ).toBe(true);
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(
            result.violations.map((item) => ({
              id: item.id,
              nodes: item.nodes.map((node) => node.target),
            })),
          ).toEqual([]);
        }
      }
  });
  test("board documents and elections retain the board navigation", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await api(page, { member: { ...baseMember, role: "developer" } });
    await login(page);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/developer/preview/board/board");
      for (const [path, title] of [
        ["documents", "Community documents"],
        ["elections", "Community elections"],
        ["reports", "Published reports"],
        ["updates", "Community updates"],
      ]) {
        if (width < 1024 && path === "reports") {
          await page
            .getByRole("navigation", { name: "Mobile navigation" })
            .getByRole("link", { name: "More", exact: true })
            .click();
          await page
            .locator("main summary")
            .filter({ hasText: /^Board$/ })
            .click();
        }
        await page.locator(`a[href$="/board/${path}"]:visible`).first().click();
        await expect(page).toHaveURL(
          new RegExp(`/developer/preview/board/board/${path}$`),
        );
        await expect(
          page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          page.locator('a[href$="/board/documents"]:visible'),
        ).toHaveCount(1);
        await expect(
          page.locator('a[href$="/board/elections"]:visible'),
        ).toHaveCount(1);
        await expect(
          page.getByRole("region", { name: "Role preview session" }),
        ).toContainText("BOD / Board");
        if (path === "updates") {
          await page.locator('main a[href*="/board/updates/"]').first().click();
          await expect(page).toHaveURL(/\/board\/updates\/[^/]+$/);
          await expect(
            page.locator('a[href$="/board/documents"]:visible'),
          ).toHaveCount(1);
          await page
            .getByRole("link", { name: "All community updates", exact: true })
            .click();
        }
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
      await page.goto("/developer/preview/board/more/documents");
      await expect(
        page.locator('a[href$="/board/elections"]:visible'),
      ).toHaveCount(1);
    }
  });
  test("developer module tabs read records under the real developer identity", async ({
    page,
  }) => {
    const calls = await api(page, {
      member: { ...baseMember, role: "developer" },
      monitor: true,
    });
    await login(page);
    await page.goto("/developer/modules/security");
    await expect(
      page.getByRole("heading", { name: "Security & access", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: "Role preview session" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "View details Sample gate pass 0",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Synthetic monitored data",
    );
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "View details Sample gate pass 20",
        exact: true,
      }),
    ).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) < 1024)
      await page.getByRole("button", { name: /More sections/ }).click();
    await page.getByRole("link", { name: "Incidents", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "This section has not been saved" }),
    ).toBeVisible({ timeout: 15000 });
    await page.goto("/developer/modules");
    await page.getByLabel("Find a module").fill("security");
    await expect(
      page.getByRole("main").getByRole("link", { name: /Security & access/ }),
    ).toBeVisible();
    expect(
      calls.filter(
        (call) =>
          call.startsWith("POST /rest/") &&
          !call.endsWith("bfe_monitor_module") &&
          !call.endsWith("bfe_my_access") &&
          !call.endsWith("bfe_get_member") &&
          !call.endsWith("bfe_get_profile") &&
          !call.endsWith("bfe_my_notifications"),
      ),
    ).toEqual([]);
  });
  test("developer monitoring shows setup and permission failures without sample fallback", async ({
    page,
  }) => {
    await api(page, { member: { ...baseMember, role: "developer" } });
    await login(page);
    await page.goto("/developer/modules/finance");
    await expect(page.getByRole("alert")).toContainText("database setup", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: /^View details / }),
    ).toHaveCount(0);
    await page.unrouteAll();
    await api(page, {
      member: { ...baseMember, role: "developer" },
      monitor: true,
      monitorDenied: true,
    });
    await page.reload();
    await expect(page.getByRole("alert")).toContainText(
      "did not confirm developer access",
    );
  });
  test("developer module layouts stay accessible on phones and desktop", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await api(page, {
      member: { ...baseMember, role: "developer" },
      monitor: true,
    });
    await login(page);
    for (const width of [320, 1024, 1440])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of [
          "/developer/modules",
          "/developer/modules/security",
        ]) {
          await page.goto(path);
          await page.evaluate(
            (value) => (document.documentElement.dataset.theme = value),
            theme,
          );
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 15_000,
          });
          if (path.endsWith("security"))
            await expect(
              page.getByRole("button", {
                name: "View details Sample gate pass 0",
                exact: true,
              }),
            ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          if (theme === "light")
            await page.screenshot({
              path: test
                .info()
                .outputPath(
                  `monitor-${path.endsWith("security") ? "security" : "catalogue"}-${width}.png`,
                ),
              fullPage: true,
            });
          if (path.endsWith("security")) {
            const desktop = width >= 1024;
            await expect(page.getByRole("table")).toHaveCount(desktop ? 1 : 0);
            if (desktop) {
              await expect(
                page
                  .getByRole("navigation", {
                    name: "Security & access sections",
                  })
                  .getByRole("link"),
              ).toHaveCount(6);
              const first = await page
                .getByRole("button", {
                  name: "View details Sample gate pass 0",
                  exact: true,
                })
                .boundingBox();
              expect(first && first.y + first.height < 850).toBeTruthy();
            }
            const inspect = page.getByRole("button", {
              name: "View details Sample gate pass 0",
              exact: true,
            });
            await inspect.click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toContainText("Synthetic monitored data");
            if (desktop) {
              const box = await dialog.boundingBox();
              expect(
                box && Math.abs(box.x + box.width - width) < 2 && box.y < 2,
              ).toBeTruthy();
            }
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
            if (theme === "light")
              await page.screenshot({
                path: test.info().outputPath(`monitor-inspector-${width}.png`),
              });
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(inspect).toBeFocused();
          }
        }
      }
  });
  test("desktop developer dashboard search and page filters work across all modules", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await api(page, {
      member: { ...baseMember, role: "developer" },
      monitor: true,
    });
    await login(page);
    await page.goto("/developer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /A clear view/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath("developer-overview-desktop.png"),
      fullPage: true,
    });
    await page
      .getByLabel("Find a system module", { exact: true })
      .fill("Finance");
    await page
      .getByRole("button", { name: "Search system modules", exact: true })
      .click();
    await expect(page).toHaveURL(/query=Finance/);
    await expect(
      page.getByRole("searchbox", { name: "Find a module", exact: true }),
    ).toHaveValue("Finance");
    await expect(
      page.getByRole("main").getByRole("link", { name: /sections?/ }),
    ).toHaveCount(1);
    for (const id of [
      "people",
      "property",
      "operations",
      "messages",
      "finance",
      "calendar",
      "security",
      "community",
      "hotlines",
      "livelihood",
      "transport",
      "documents",
      "elections",
      "access",
      "audit",
    ]) {
      await page.goto(`/developer/modules/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: "Refresh", exact: true }),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        id,
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
        id,
      ).toEqual([]);
      if (["people", "property"].includes(id))
        await page.screenshot({
          path: test.info().outputPath(`developer-${id}-desktop.png`),
        });
    }
    await page.goto("/developer/modules/security");
    await expect(page.getByRole("table")).toBeVisible();
    await page
      .getByLabel("Search records on this page", { exact: true })
      .fill("pass 19");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await page
      .getByLabel("Filter record status on this page", { exact: true })
      .selectOption("Approved");
    await page
      .getByLabel("Search records on this page", { exact: true })
      .fill("no matching example");
    await expect(
      page.getByText("No matching records on this page", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(21);
    await expect(
      page.getByRole("columnheader", { name: "Recorded", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Search records on this page", { exact: true })
      .fill("no matching example");
    await page
      .getByRole("navigation", { name: "Security & access sections" })
      .getByRole("link", { name: "Visitor passes", exact: true })
      .click();
    await expect(
      page.getByLabel("Search records on this page", { exact: true }),
    ).toHaveValue("");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(21);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/developer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Developer console",
    );
    await expect(
      page.getByLabel("Find a system module", { exact: true }),
    ).toBeHidden();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("request workflow saves through protected operations and shows office replies", async ({
    page,
  }) => {
    const calls = await api(page, {
      member: { ...baseMember, extra_roles: ["admin"] },
      liveRequests: true,
    });
    await login(page);
    await page.goto("/services/requests?new=concern");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByLabel("Category", { exact: true }),
    ).toHaveValue("Concern");
    await page
      .getByLabel("Concern and Suggestion type", { exact: true })
      .selectOption("Other");
    await page
      .getByLabel("Describe the other type", { exact: true })
      .fill("Synthetic repair request");
    await page
      .getByLabel("Details", { exact: true })
      .fill("This is a synthetic request for the browser integration test.");
    await page
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Request saved.");
    await expect(
      page.getByRole("button", {
        name: /Open .*Synthetic repair request/,
      }),
    ).toBeVisible();
    await page.goto("/office/requests");
    await page
      .getByRole("button", {
        name: /Open .*Synthetic repair request/,
      })
      .click();
    await page
      .getByLabel("Your reply")
      .fill("Synthetic office reply, received and under review.");
    await page.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(page.getByText("Reply saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start work", exact: true }).click();
    await expect(page.locator("main")).toContainText("In progress");
    await page.keyboard.press("Escape");
    await page.goto("/services/requests");
    await page
      .getByRole("button", {
        name: /Open .*Synthetic repair request/,
      })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Synthetic office reply, received and under review.",
    );
    await expect(
      page.getByRole("button", { name: "Resolve", exact: true }),
    ).toHaveCount(0);
    await page.goto("/office/calendar");
    await expect(
      page.getByRole("heading", {
        name: "Facilities & calendar",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/office\/calendar$/);
    expect(
      calls.filter((call) =>
        /^(POST|PATCH|DELETE) \/rest\/v1\/(?!rpc\/)/.test(call),
      ),
    ).toEqual([]);
  });
  test("missing request schema stays closed and does not invent a saved record", async ({
    page,
  }) => {
    await api(page);
    await login(page);
    await page.goto("/services/requests");
    await expect(page.getByRole("alert")).toContainText("not available yet");
    await expect(
      page.getByRole("button", { name: "New request", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Sample streetlight repair", { exact: true }),
    ).toHaveCount(0);
  });
  test("sample request desk fits phone and desktop and never calls live operations", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const calls = await api(page, {
      member: { ...baseMember, role: "developer" },
    });
    await login(page);
    for (const width of [320, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        for (const role of ["homeowner", "admin"]) {
          const path =
            role === "admin" ? "office/requests" : "services/requests";
          await page.goto(`/developer/preview/${role}/${path}`);
          await page.evaluate(
            (value) => (document.documentElement.dataset.theme = value),
            theme,
          );
          await expect(
            page.getByRole("button", {
              name: "Open Sample streetlight repair",
              exact: true,
            }),
          ).toBeVisible({ timeout: 15_000 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          if (theme === "light")
            await page.screenshot({
              path: test.info().outputPath(`requests-${role}-${width}.png`),
              fullPage: true,
            });
          await page
            .getByRole("button", {
              name: "Open Sample streetlight repair",
              exact: true,
            })
            .click();
          await expect(page.getByRole("dialog")).toContainText("Sample reply:");
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.keyboard.press("Escape");
          if (role === "homeowner") {
            await page
              .getByRole("button", { name: "New request", exact: true })
              .click();
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
            await page.keyboard.press("Escape");
          }
        }
      }
    expect(
      calls.filter(
        (call) =>
          !identityRead(call) &&
          (call.includes("/rest/v1/bfe_") || call.includes("/rpc/bfe_")),
      ),
    ).toEqual([]);
  });
  test("staff directory loads database rows, paginates and searches without writes", async ({
    page,
  }) => {
    const calls = await api(page, {
      member: { ...baseMember, role: "admin" },
      people: true,
    });
    await login(page);
    await page.goto("/office/residents");
    await expect(
      page.getByRole("heading", { name: "People & accounts" }),
    ).toBeVisible();
    await expect(page.getByText("21 matching", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Sample Person 0", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "View Sample Person 20", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Find a member").fill("Sample Person");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "View Sample Person 0", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("No Auth ID recorded");
    await expect(page.getByRole("dialog")).toContainText("Not assigned");
    await page.keyboard.press("Escape");
    await page.goto("/office/registrations");
    await expect(
      page.getByRole("heading", { name: "Registration inbox" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Sample Person 0", exact: true }),
    ).toBeVisible();
    expect(
      calls.filter(
        (call) =>
          call.includes("/rest/v1/") &&
          !call.startsWith("GET") &&
          !readRpc(call),
      ),
    ).toEqual([]);
  });
  test("staff database refusal never falls back to sample households", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "admin" },
      people: true,
      peopleDenied: true,
    });
    await login(page);
    await page.goto("/office/residents");
    await expect(page.getByRole("alert")).toContainText(
      "could not be verified",
    );
    await expect(page.getByText("No sample fallback is shown.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^View Sample/ }),
    ).toHaveCount(0);
  });
  test("staff records adapt to phone and desktop with accessible details", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await api(page, {
      member: { ...baseMember, role: "admin" },
      people: true,
    });
    await login(page);
    for (const width of [320, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
        for (const path of [
          "/office",
          "/office/residents",
          "/office/registrations",
        ]) {
          await page.goto(path);
          await page.evaluate(
            (theme) => (document.documentElement.dataset.theme = theme),
            theme,
          );
          if (path === "/office") {
            await expect(
              page.getByRole("heading", { name: "Your office, organized." }),
            ).toBeVisible();
            if (theme === "light")
              await page.screenshot({
                path: test.info().outputPath(`staff-home-${width}.png`),
                fullPage: true,
              });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
            continue;
          }
          await expect(
            page.getByRole("button", {
              name: "View Sample Person 0",
              exact: true,
            }),
          ).toBeVisible({ timeout: 15_000 });
          if (theme === "light" && path === "/office/residents")
            await page.screenshot({
              path: test.info().outputPath(`staff-members-${width}.png`),
              fullPage: true,
            });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page
            .getByRole("button", { name: "View Sample Person 0", exact: true })
            .click();
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.keyboard.press("Escape");
        }
      }
  });
  test("admin alone cannot open developer tools or role previews", async ({
    page,
  }) => {
    await api(page, { member: { ...baseMember, role: "admin" } });
    await login(page);
    await expect(
      page.getByRole("link", { name: "Developer console", exact: true }),
    ).toHaveCount(0);
    await page.goto("/developer");
    await expect(
      page.getByRole("heading", { name: "This workspace is restricted" }),
    ).toBeVisible();
    await page.goto("/developer/preview/security/security");
    await expect(
      page.getByRole("heading", { name: "This workspace is restricted" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Role preview session" }),
    ).toHaveCount(0);
  });
  test("developer previews stay isolated, obey role routes and retain the real session", async ({
    page,
  }) => {
    const calls = await api(page, {
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
    });
    await login(page);
    await page
      .getByRole("link", { name: "Developer console", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) >= 1024)
      await page
        .getByRole("link", { name: "Role previews", exact: true })
        .click();
    else await page.getByRole("link", { name: "Choose a role" }).click();
    await expect(
      page.getByRole("heading", { name: "Role previews", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: /BOD \/ Board/ }).click();
    await expect(
      page.getByRole("region", { name: "Role preview session" }),
    ).toContainText("Previewing: BOD / Board");
    await expect(page).toHaveURL(/\/developer\/preview\/board\/board$/);
    const tokenBefore = await page.evaluate(() =>
      sessionStorage.getItem("bellefort-auth-session"),
    );
    await page.goto("/developer/preview/board/office/access");
    await expect(
      page.getByRole("heading", { name: "Hidden from this role" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Exit preview", exact: true }).click();
    await expect(page).toHaveURL(/\/developer\/roles$/);
    await page.getByRole("link", { name: /Homeowner/ }).click();
    await page.evaluate(() =>
      sessionStorage.setItem(
        "bellefort-preview-v1",
        "original-synthetic-store",
      ),
    );
    await page.goto("/developer/preview/homeowner/services/requests");
    await page
      .getByRole("button", { name: "New request", exact: true })
      .click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Synthetic role preview request");
    await page
      .getByLabel("Details", { exact: true })
      .fill("An invented request for isolated role preview testing only.");
    await page
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "saved in this browser tab",
    );
    expect(
      await page.evaluate(() => sessionStorage.getItem("bellefort-preview-v1")),
    ).toBe("original-synthetic-store");
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem(
          "bellefort-role-preview:homeowner:bellefort-request-samples-v1",
        ),
      ),
    ).toContain("Synthetic role preview request");
    await page.goto("/developer/preview/homeowner/account/statement");
    await page.emulateMedia({ media: "print" });
    await expect(
      page.getByRole("heading", { name: "SAMPLE STATEMENT — NOT OFFICIAL" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Role preview session" }),
    ).toBeHidden();
    await expect(page.locator("[data-sample-statement] table")).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await page.goto("/developer/preview/renter/services/requests");
    await expect(
      page.getByRole("button", { name: /Synthetic role preview request/ }),
    ).toHaveCount(0);
    await page.goto("/developer/preview/renter/sign-out");
    await expect(
      page.getByRole("heading", {
        name: "Account actions stay outside preview",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("bellefort-auth-session"),
      ),
    ).toBe(tokenBefore);
    expect(
      calls.filter(
        (call) =>
          !call.startsWith("GET ") &&
          !call.startsWith("HEAD ") &&
          !call.endsWith("/token") &&
          !readRpc(call),
      ),
    ).toEqual([]);
  });
  test("member profile shows the current account without editable role controls", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "developer" },
    });
    await login(page);
    await page.goto("/more/profile");
    await expect(
      page.getByRole("heading", { name: "Synthetic Member", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("sample@example.invalid", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Alex Santos", { exact: true })).toHaveCount(0);
    await expect(page.locator("main input,main select")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Developer console", exact: true }),
    ).toBeVisible();
  });
  test("developer console and role previews fit mobile and desktop with accessible controls", async ({
    page,
  }) => {
    test.setTimeout(150000);
    await api(page, { member: { ...baseMember, role: "developer" } });
    await login(page);
    for (const width of [320, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(
          (value) => localStorage.setItem("bellefort-theme", value),
          theme,
        );
        for (const path of [
          "/developer",
          "/developer/connections",
          "/developer/roles",
          "/developer/activity",
          "/more/profile",
          "/developer/preview/security/security",
          "/developer/preview/driver/driver",
        ]) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${path} ${width} ${theme}`,
          ).toBe(true);
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(
            result.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
            path,
          ).toEqual([]);
        }
      }
  });
});

test.describe("direct account navigation and finance reports", () => {
  test.skip(!configured);
  test("homeowner and board access stay available without a workspace chooser or menu popup", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, extra_roles: ["board"] },
      accounts: true,
    });
    await login(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "Your workspaces" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(
      0,
    );
    if (page.viewportSize()!.width < 1024) {
      const nav = page.getByRole("navigation", { name: "Mobile navigation" });
      await expect(
        nav.getByRole("link", { name: "Home", exact: true }),
      ).toBeVisible();
      await nav.getByRole("link", { name: "More", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .locator("main summary")
        .filter({ hasText: /^Board$/ })
        .click();
      await page
        .getByRole("link", { name: "Board: Documents", exact: true })
        .click();
    } else {
      await page
        .getByRole("navigation", { name: "Board navigation" })
        .getByRole("link", { name: "Documents", exact: true })
        .click();
    }
    await expect(page).toHaveURL(/\/board\/documents$/);
    await expect(
      page.getByRole("heading", { name: "Community documents", exact: true }),
    ).toBeVisible();
    await page.goto("/workspaces");
    await expect(page).toHaveURL(/\/$/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.goto("/developer");
    await expect(
      page.getByRole("heading", { name: "This workspace is restricted" }),
    ).toBeVisible();
  });
  test("security uses one navigation surface and retains the previous More page", async ({
    page,
  }) => {
    await api(page, {
      member: { ...baseMember, role: "security" },
      accounts: true,
    });
    await login(page);
    await expect(page).toHaveURL(/\/security$/);
    await expect(
      page.getByRole("navigation", {
        name: "Security navigation",
        exact: true,
      }),
    ).toHaveCount(0);
    const nav =
      page.viewportSize()!.width < 1024
        ? page.getByRole("navigation", { name: "Mobile navigation" })
        : page.getByRole("complementary", { name: "Main navigation" });
    await expect(
      nav.getByRole("link", { name: "Vehicles", exact: true }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: /Gate/ })).toBeVisible();
    await nav.getByRole("link", { name: "Vehicles", exact: true }).click();
    await expect(page).toHaveURL(/\/security\/vehicles$/);
    await expect(
      page.getByRole("heading", { name: "Vehicle review", exact: true }),
    ).toBeVisible();
    await page.goto("/more");
    await expect(
      page.getByRole("heading", { name: "More", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Vehicles & stickers/ }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: test.info().outputPath("restored-more-page.png"),
    });
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "This workspace is restricted" }),
    ).toBeVisible();
  });
  test("finance periods update the chart and download a structured sample CSV", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await api(page, {
      member: { ...baseMember, role: "admin" },
      accounts: true,
      permissions: [
        { module: "finance", action: "view", scope: "association" },
        { module: "finance", action: "export", scope: "association" },
      ],
    });
    await login(page);
    await expect(page).toHaveURL(/\/office\/finance$/);
    await page.goto("/office/finance/reports");
    await expect(
      page.getByRole("heading", { name: "Financial reports", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("\u20b15,550.00", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Last 3 months", exact: true })
      .click();
    await expect(
      page.getByText("\u20b19,250.00", { exact: true }).first(),
    ).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download sample CSV", exact: true })
      .click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(
      "SAMPLE-Bellefort-finance-2026-09-01-to-2026-11-30.csv",
    );
    const { readFile } = await import("node:fs/promises");
    const csv = await readFile((await download.path())!, "utf-8");
    expect(csv).toContain("SUMMARY");
    expect(csv).toContain("MONTHLY BREAKDOWN");
    expect(csv).toContain("INVOICE DETAIL");
    expect(csv).toContain("9250.00");
    expect(csv).toContain("Receipt timestamps are unavailable");
    for (const width of [390, 1440])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          (value) => (document.documentElement.dataset.theme = value),
          theme,
        );
        await page
          .getByRole("button", { name: "Last 6 months", exact: true })
          .click();
        await expect(
          page.getByText("\u20b111,100.00", { exact: true }).first(),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "This year", exact: true })
          .click();
        await expect(
          page.getByText("No supplied invoices", { exact: true }).first(),
        ).toBeVisible();
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: test.info().outputPath(`finance-report-${width}-${theme}.png`),
        });
      }
  });
  test("finance viewing does not imply export permission", async ({ page }) => {
    await api(page, {
      member: { ...baseMember, role: "admin" },
      accounts: true,
      permissions: [
        { module: "finance", action: "view", scope: "association" },
      ],
    });
    await login(page);
    await expect(page).toHaveURL(/\/office\/finance$/);
    await page.goto("/office/finance/reports");
    await expect(
      page.getByRole("button", { name: "Download sample CSV", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        "A separate finance export permission is required to download this report.",
      ),
    ).toBeVisible();
  });
});

test.describe("Excel amenity form", () => {
  test.skip(!configured);
  test("manual date stays visible and court end times enforce a one-hour minimum", async ({
    page,
  }) => {
    await page.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      return ["127.0.0.1", "localhost", "bellefort-auth-test.invalid"].includes(
        host,
      )
        ? route.continue()
        : route.abort();
    });
    await api(page, { accounts: true });
    const fid = "85000000-0000-4000-8000-000000000002";
    await page.route(
      "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
      (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        if (name === "bfe_session_status")
          return route.fulfill({
            json: {
              valid: true,
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              idle_expires_at: new Date(Date.now() + 86400000).toISOString(),
              server_now: new Date().toISOString(),
            },
          });
        if (name === "bfe_booking_dashboard")
          return route.fulfill({
            json: {
              rows: [],
              total: 0,
              can_manage: false,
              can_approve: false,
              facilities: [
                {
                  id: fid,
                  name: "Basketball court",
                  opens: "07:00:00",
                  closes: "22:00:00",
                  slot_minutes: 30,
                  max_minutes: 240,
                  capacity: 30,
                  renters: true,
                  active: true,
                  policy_reference: "Synthetic test policy",
                },
              ],
            },
          });
        if (name === "bfe_booking_availability")
          return route.fulfill({ json: [] });
        if (name === "bfe_quote_booking")
          return route.fulfill({
            json: {
              policy_date: "2025-10-21",
              use_type: "court-sports",
              period: "day",
              minutes: 60,
              adults: 0,
              children: 0,
              rental_centavos: null,
              bond_centavos: 0,
              reservation_centavos: null,
              total_centavos: null,
              hourly_day_centavos: 25000,
              hourly_night_centavos: 30000,
              notes: [],
            },
          });
        if (
          [
            "bfe_get_member",
            "bfe_my_access",
            "bfe_get_profile",
            "bfe_my_notifications",
            "bfe_mark_notifications",
          ].includes(name ?? "")
        )
          return route.fallback();
        return route.fulfill({
          status: 404,
          json: {
            code: "PGRST202",
            message: "Synthetic unavailable unrelated service",
          },
        });
      },
    );
    await login(page);
    await page.goto("/services/bookings");
    await page
      .getByRole("button", { name: /Basketball court Booking limit/ })
      .click();
    const date = page.getByLabel("Date", { exact: true });
    await expect(date).toBeVisible();
    const future = new Date(Date.now() + 14 * 86400000);
    while (future.getUTCDay() !== 2) future.setUTCDate(future.getUTCDate() + 1);
    await date.fill(future.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^9:00 AM/ }).click();
    await expect(page.getByRole("button", { name: /^9:30 AM/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^10:00 AM/ })).toBeEnabled();
    await page.getByRole("button", { name: /^10:00 AM/ }).click();
    await expect(page.getByText(/Minimum 1 hour/)).toBeVisible();
    await expect(
      page.getByText("Rates & facility rules", { exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

async function workspaceAccessMock(
  page: Page,
  {
    missing = false,
    targetRoles = ["admin"],
    auditRole,
    calendarVisible = false,
    readOnly = false,
  }: {
    missing?: boolean;
    targetRoles?: string[];
    auditRole?: string;
    calendarVisible?: boolean;
    readOnly?: boolean;
  } = {},
) {
  await page.route("**/*", (route) =>
    ["127.0.0.1", "localhost", "bellefort-auth-test.invalid"].includes(
      new URL(route.request().url()).hostname,
    )
      ? route.continue()
      : route.abort(),
  );
  await api(page, {
    accounts: true,
    people: true,
    liveRequests: true,
    tabModes: readOnly
      ? accessModules.flatMap((module) =>
          accessScopes.map((scope) => ({ module, scope, mode: "view" })),
        )
      : [],
    developerControl: !auditRole || auditRole === "developer",
    permissions: auditRole
      ? accessModules.flatMap((module) =>
          accessScopes.flatMap((scope) =>
            accessActions.map((action) => ({ module, scope, action })),
          ),
        )
      : undefined,
    member: { ...baseMember, role: auditRole ?? "developer", extra_roles: [] },
  });
  const state = {
    saves: 0,
    delegations: 0,
    manager: false,
    lastKind: "",
    lastSubject: "",
    searches: [] as Array<{ p_search: string; p_role?: string }>,
  };
  let snapshot: {
    rules: Array<{ module: string; scope: string; mode: string }>;
    actions: Array<{
      module: string;
      scope: string;
      action: string;
      effect: string;
    }>;
  } = { rules: [], actions: [] };
  const response = (kind: string) => ({
    snapshot,
    effective:
      kind === "user"
        ? {
            "calendar:association": {
              create: false,
              view:
                calendarVisible ||
                snapshot.rules.some(
                  (r) => r.module === "calendar" && r.mode === "edit",
                ),
              approve: snapshot.actions.some(
                (r) => r.action === "approve" && r.effect === "allow",
              ),
            },
          }
        : null,
    roles: kind === "user" ? targetRoles : [],
    manager: state.manager,
    sources: [],
  });
  await page.route(
    "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
    (route) => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1),
        args = route.request().postDataJSON();
      if (name === "bfe_session_status")
        return route.fulfill({
          json: {
            valid: true,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            idle_expires_at: new Date(Date.now() + 86400000).toISOString(),
            server_now: new Date().toISOString(),
          },
        });
      if (
        name === "bfe_access_members" ||
        name === "bfe_filtered_access_members"
      ) {
        state.searches.push({ p_search: args.p_search, p_role: args.p_role });
        const matches =
          (!args.p_role || targetRoles.includes(args.p_role)) &&
          (!args.p_search ||
            "sample staff sample b".includes(
              String(args.p_search).toLowerCase(),
            ));
        return route.fulfill({
          json: {
            rows: matches
              ? [
                  {
                    user_id: "11111111-1111-4111-8111-111111111112",
                    name: "Sample Staff",
                    unit: "Sample B",
                    role: targetRoles[0],
                    extra_roles: targetRoles.slice(1),
                    status: "Active",
                  },
                ]
              : [],
            total: matches ? 1 : 0,
          },
        });
      }
      if (name === "bfe_set_access_manager") {
        state.delegations++;
        state.manager = args.p_active;
        return route.fulfill({ json: null });
      }
      if (name === "bfe_access_editor")
        return missing
          ? route.fulfill({
              status: 404,
              json: {
                code: "PGRST202",
                message: "Synthetic missing migration",
              },
            })
          : route.fulfill({ json: response(args.p_kind) });
      if (name === "bfe_save_access_editor") {
        expect(args.p_expected).toEqual(snapshot);
        snapshot = args.p_next;
        state.saves++;
        state.lastKind = args.p_kind;
        state.lastSubject = args.p_subject;
        return route.fulfill({ json: response(args.p_kind) });
      }
      if (name === "bfe_navigation_action_badges")
        return route.fulfill({ json: { as_of: new Date().toISOString() } });
      if (
        ![
          "bfe_my_access",
          "bfe_get_member",
          "bfe_access_members",
          "bfe_member_assignments",
          "bfe_get_profile",
          "bfe_my_notifications",
          "bfe_mark_notifications",
        ].includes(name ?? "")
      )
        return route.fulfill({
          status: 404,
          json: { code: "PGRST202", message: "Synthetic unavailable service" },
        });
      return route.fallback();
    },
  );
  return state;
}

test.describe("access layout regression", () => {
  test.skip(!configured);
  for (const width of [390, 1440]) {
    test(`access layout regression ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await workspaceAccessMock(page, {
        targetRoles: ["admin"],
        calendarVisible: true,
      });
      await login(page);
      await page.goto("/developer/access");
      await page.getByRole("button", { name: /Sample Staff/ }).click();
      const panel = page.getByRole("region", { name: "Workspace access" });
      await page
        .getByRole("searchbox", { name: "Find a module", exact: true })
        .fill("bookings");
      const row = panel.getByRole("region", {
        name: "Office: Facilities & calendar",
        exact: true,
      });
      const visibility = row.getByRole("switch");
      await visibility.check();
      const action = row.getByRole("checkbox", {
        name: "Office Facilities & calendar Approve or reject bookings",
        exact: true,
      });
      const actionGroup = row.getByRole("group", {
        name: "Office Facilities & calendar actions",
        exact: true,
      });
      const geometryBefore = await actionGroup.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        offset:
          element.getBoundingClientRect().top -
          element.parentElement!.getBoundingClientRect().top,
      }));
      await action.scrollIntoViewIfNeeded();
      const checkBefore = await action.boundingBox();
      await action.check();
      await expect(actionGroup.getByRole("button")).toHaveCount(0);
      for (const checked of [false, true, false, true]) {
        await action.setChecked(checked);
        const geometryAfter = await actionGroup.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          offset:
            element.getBoundingClientRect().top -
            element.parentElement!.getBoundingClientRect().top,
        }));
        expect(geometryAfter).toEqual(geometryBefore);
        const checkAfter = await action.boundingBox();
        expect(checkAfter!.x).toBeCloseTo(checkBefore!.x, 0);
        expect(checkAfter!.y).toBeCloseTo(checkBefore!.y, 0);
        expect(checkAfter!.width).toBe(checkBefore!.width);
      }
      expect(
        await action.evaluate((input) => getComputedStyle(input).outlineStyle),
      ).toBe("none");
      expect(
        await visibility.evaluate(
          (input) => getComputedStyle(input).outlineStyle,
        ),
      ).toBe("none");
      await action.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(action).toBeFocused();
      expect(
        await action.evaluate(
          (input) => getComputedStyle(input.parentElement!).outlineStyle,
        ),
      ).toBe("solid");
      await page
        .getByRole("button", { name: "Discard changes", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Role & status", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const body = dialog.locator("[data-dialog-body]");
      await body.evaluate((element) => {
        element.scrollTop = 300;
      });
      const toolbar = dialog.getByRole("tablist", { name: "Member settings" });
      await expect(toolbar).toBeVisible();
      const geometry = await toolbar.evaluate((element) => {
        const bar = element.parentElement!,
          body = bar.closest("[data-dialog-body]")!;
        return {
          top: bar.getBoundingClientRect().top,
          bodyTop: body.getBoundingClientRect().top,
          background: getComputedStyle(bar).backgroundColor,
        };
      });
      expect(geometry.top).toBeLessThanOrEqual(geometry.bodyTop + 2);
      expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)");
      await page.screenshot({ path: `.artifacts/access-layout-${width}.png` });
      expect(state.saves).toBe(0);
      expect(state.delegations).toBe(0);
    });
  }
});

test.describe("shell notice layout", () => {
  test.skip(!configured);
  for (const [role, path] of [
    ["admin", "/office/approvals"],
    ["admin", "/office/inbox"],
    ["board", "/board/shuttle"],
    ["security", "/security"],
    ["driver", "/driver"],
  ]) {
    test(`shell notice layout ${role} ${path}`, async ({ page }) => {
      test.setTimeout(90000);
      const state = await workspaceAccessMock(page, {
        auditRole: role,
        readOnly: true,
      });
      await login(page);
      await page.goto(path);
      const notice = page.locator("main [data-shell-notice]");
      await expect(notice).toContainText("View only");
      if (path === "/office/approvals")
        await expect(
          page.getByRole("heading", { name: "Review inbox", exact: true }),
        ).toBeVisible();
      for (const width of [390, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => window.scrollTo(0, 0));
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (value) =>
              document.documentElement.setAttribute("data-theme", value),
            theme,
          );
          const actions = page.locator("[data-header-actions]");
          const controls = actions.locator("button, a");
          const noticeBox = await notice.boundingBox();
          expect(noticeBox).not.toBeNull();
          for (const control of await controls.all()) {
            if (!(await control.isVisible())) continue;
            const box = (await control.boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(noticeBox!.y);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
            expect(box.height).toBeGreaterThanOrEqual(48);
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (width === 1440)
            await page.screenshot({
              path: `.artifacts/notice-${role}-${path.split("/").at(-1)}-${theme}.png`,
            });
        }
      }
      await page.context().setOffline(true);
      const offline = page
        .getByRole("status")
        .filter({ hasText: "You’re offline" });
      await expect(offline).toBeVisible();
      expect(
        (await page.locator("[data-header-actions]").boundingBox())!.y +
          (await page.locator("[data-header-actions]").boundingBox())!.height,
      ).toBeLessThanOrEqual((await offline.boundingBox())!.y);
      await page.context().setOffline(false);
      await expect(offline).toHaveCount(0);
      expect(state.saves).toBe(0);
      expect(state.delegations).toBe(0);
    });
  }
});

test.describe("plain-language feature help", () => {
  test.skip(!configured);
  for (const role of ["admin", "homeowner"] as const) {
    test(`plain-language feature help ${role}`, async ({ page }) => {
      test.setTimeout(90000);
      const state = await workspaceAccessMock(page, { auditRole: role });
      await login(page);
      await expect(page).not.toHaveURL(/sign-in/);
      const path = role === "admin" ? "/office/access" : "/account";
      const title = role === "admin" ? "Roles & permissions" : "My account";
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const trigger = page.getByRole("button", {
          name: `Help: ${title}`,
          exact: true,
        });
        await trigger.click();
        const dialog = page.getByRole("dialog", {
          name: `How this works: ${title}`,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(
          role === "admin"
            ? "A visible page does not automatically allow approvals"
            : "A monthly rate is the regular charge",
        );
        for (const colorScheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme });
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, colorScheme);
          expect(
            (
              await new AxeBuilder({ page })
                .include("dialog[open]")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
        }
        expect(
          await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.artifacts/feature-help-${role}-${width}.png`,
        });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(page).toHaveURL(new RegExp(path + "$"));
      }
      await page.goto("/more/help");
      await page
        .getByRole("searchbox", { name: "Find help", exact: true })
        .fill("Roles & permissions");
      await page
        .getByRole("region", { name: "Feature guides" })
        .getByText("Roles & permissions", { exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Feature guides" }),
      ).toContainText("Turn a page on to make it visible");
      await page
        .getByRole("searchbox", { name: "Find help", exact: true })
        .fill("no-such-synthetic-topic");
      await expect(
        page.getByText("No matching guide. Try a different word."),
      ).toBeVisible();
      expect(state.saves).toBe(0);
      expect(state.delegations).toBe(0);
    });
  }
});

// Cross-system rendering audit: synthetic identity, explicit test grants and
// isolated services. Empty/unavailable states are recorded, never real data.
const systemAuditRoutes: Record<string, string[]> = {
  homeowner: [
    "/",
    "/account",
    "/account/payments",
    "/community",
    "/services",
    "/services/bookings",
    "/services/visitors",
    "/services/requests",
    "/services/calendar",
    "/directory/market",
    "/directory/learning",
    "/directory/transport",
    "/more",
    "/more/profile",
    "/more/settings",
    "/more/notifications",
    "/more/hotlines",
    "/more/lots",
    "/more/vehicles",
    "/more/permits",
    "/more/documents",
    "/more/elections",
  ],
  admin: [
    "/office",
    "/office/approvals",
    "/office/residents",
    "/office/registrations",
    "/office/finance",
    "/office/finance/accounting",
    "/office/operations",
    "/office/bookings",
    "/office/visitors",
    "/office/calendar",
    "/office/announcements",
    "/office/documents",
    "/office/requests",
    "/office/lots",
    "/office/vehicles",
    "/office/permits",
    "/office/shuttle",
    "/office/settings",
    "/office/hotlines",
    "/office/access",
  ],
  board: [
    "/board",
    "/board/documents",
    "/board/elections",
    "/board/updates",
    "/board/reports",
    "/board/shuttle",
    "/board/requests",
  ],
  security: [
    "/security",
    "/security/visitors",
    "/security/vehicles",
    "/security/incidents",
    "/security/gate",
  ],
  driver: ["/driver", "/driver/profile", "/more/settings"],
  developer: [
    "/developer",
    "/developer/members",
    "/developer/connections",
    "/developer/access",
    "/developer/activity",
    "/developer/modules",
    "/more/profile",
  ],
};
test.describe("system UI audit", () => {
  test.skip(!configured);
  for (const [role, routes] of Object.entries(systemAuditRoutes)) {
    test(`system UI audit ${role}`, async ({ page }, testInfo) => {
      test.setTimeout(240_000);
      await workspaceAccessMock(page, { auditRole: role });
      const unavailable = new Set<string>();
      const writes: string[] = [];
      await page.route(
        "https://bellefort-auth-test.invalid/rest/v1/rpc/bfe_*",
        async (route) => {
          const name = new URL(route.request().url()).pathname
            .split("/")
            .at(-1)!;
          const reply = (json: unknown) => route.fulfill({ json });
          if (
            /^bfe_(save_|create_|approve_|reject_|submit_|publish_|update_|delete_|post_)/.test(
              name,
            )
          ) {
            writes.push(name);
            return route.abort();
          }
          if (
            name === "bfe_feature_dashboard" ||
            name === "bfe_announcement_dashboard"
          )
            return reply({
              rows: [],
              total: 0,
              can_create: true,
              can_review: true,
              can_publish: true,
              publishable: true,
              postable_modules: ["buy-sell", "businesses", "publishing"],
            });
          if (name === "bfe_booking_dashboard")
            return reply({
              rows: [],
              total: 0,
              facilities: [],
              can_manage: role === "admin",
              can_approve: role === "admin",
            });
          if (
            name === "bfe_visitor_dashboard" ||
            name === "bfe_community_pass_dashboard"
          )
            return reply({
              rows: [],
              total: 0,
              lots: [
                {
                  id: "11111111-1111-4111-8111-111111111113",
                  physical_id: "1-01-001",
                  homeowner: "Synthetic Member",
                },
              ],
              can_create: true,
              can_approve: role === "admin",
              can_gate: role === "security",
            });
          if (name === "bfe_private_health_note")
            return reply({ note: "", version: 0, can_edit: true });
          const handled = [
            "bfe_my_access",
            "bfe_get_member",
            "bfe_get_profile",
            "bfe_my_notifications",
            "bfe_navigation_action_badges",
            "bfe_session_status",
            "bfe_staff_directory",
            "bfe_access_members",
            "bfe_filtered_access_members",
            "bfe_access_editor",
            "bfe_member_assignments",
          ];
          if (handled.includes(name)) return route.fallback();
          unavailable.add(name);
          return route.fulfill({
            status: 404,
            json: {
              code: "PGRST202",
              message: "Synthetic unavailable service",
            },
          });
        },
      );
      await login(page);
      await expect(page).not.toHaveURL(/sign-in/);
      const output = `.artifacts/system-ui-audit/${testInfo.project.name === "chromium" ? "" : `${testInfo.project.name}/`}${role}`;
      mkdirSync(output, { recursive: true });
      const report: unknown[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
          await page.goto(route);
          await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
          await expect(
            page
              .locator("main")
              .getByRole("status", { name: "Loading content" }),
          ).toHaveCount(0, { timeout: 15000 });
          await page.evaluate(() => document.fonts.ready);
          const findings = await page.locator("main").evaluate((main) => {
            const visible = (e: Element) =>
              e.getBoundingClientRect().width > 0 &&
              e.getBoundingClientRect().height > 0;
            const paragraphs = Array.from(main.querySelectorAll("p"))
              .filter(visible)
              .map((p) => p.textContent?.trim() ?? "");
            return {
              title: Array.from(main.querySelectorAll("h1"))
                .filter(visible)
                .map((h) => h.textContent),
              overflow: document.documentElement.scrollWidth > innerWidth,
              alerts: Array.from(main.querySelectorAll('[role="alert"]')).map(
                (e) => e.textContent,
              ),
              repeatedCopy: [
                ...new Set(
                  paragraphs.filter(
                    (p, i) => p.length > 45 && paragraphs.indexOf(p) !== i,
                  ),
                ),
              ],
              brokenImages: Array.from(main.querySelectorAll("img"))
                .filter(visible)
                .filter((img) => img.complete && img.naturalWidth === 0)
                .map((img) => img.alt),
              smallText: Array.from(
                main.querySelectorAll("p,label,button,small"),
              )
                .filter(visible)
                .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 14)
                .map((e) => e.textContent?.slice(0, 80)),
            };
          });
          report.push({ route, width, ...findings });
          expect
            .soft(
              findings.overflow,
              `${role} ${route} ${width}: horizontal overflow`,
            )
            .toBe(false);
          expect
            .soft(findings.brokenImages, `${role} ${route}: broken images`)
            .toEqual([]);
          await page.screenshot({
            path: `${output}/${route.replace(/[^a-z0-9]/gi, "-") || "home"}-${width}.png`,
            fullPage: true,
          });
        }
        if (role === "homeowner") {
          await page.goto("/services/requests");
          await expect(
            page.getByRole("button", {
              name: "New request",
              exact: true,
              includeHidden: true,
            }),
          ).toHaveCount(1);
          await expect(
            page.getByRole("button", { name: "New request", exact: true }),
          ).toBeVisible();
          await page.goto("/more/documents");
          const documentHelp = page.locator("details").filter({
            has: page.locator("summary", {
              hasText: "About document access",
            }),
          });
          await expect(documentHelp).not.toHaveAttribute("open", "");
          await documentHelp.locator("summary").click();
          await expect(
            documentHelp.getByText(/Under Republic Act No. 9904/),
          ).toBeVisible();
          await documentHelp.locator("summary").click();
          await page.goto("/services");
          if (width < 768) {
            await expect(
              page
                .getByRole("navigation", { name: "Mobile navigation" })
                .locator("a"),
            ).toHaveCount(5);
          }
          await page.goto("/more");
          await expect(
            page
              .getByRole("link", {
                name: "Team Helpdesk",
                exact: true,
                includeHidden: true,
              })
              .first(),
          ).toHaveAttribute("href", "/services/team-requests");
        }
        if (role === "admin") {
          await page.goto("/office/finance/accounting");
          const billingHelp = page.locator("details").filter({
            has: page.locator("summary", {
              hasText: "Before creating bills",
            }),
          });
          await expect(billingHelp).not.toHaveAttribute("open", "");
          await billingHelp.locator("summary").click();
          await expect(
            billingHelp.getByText(/Before creating bills, check each property/),
          ).toBeVisible();
          await expect(
            page.getByText(
              /Confirming a record does not prove that money has cleared the bank/,
            ),
          ).toBeVisible();
        }
        const forms =
          role === "admin"
            ? [
                {
                  route: "/office/announcements",
                  button: "New announcement",
                  title: "New announcement",
                },
              ]
            : role === "homeowner"
              ? [
                  {
                    route: "/services/visitors?new=visitor",
                    title: "Request a pass",
                    button: "New pass",
                  },
                ]
              : [];
        for (const form of forms) {
          await page.goto(form.route);
          if (form.button)
            await page
              .getByRole("button", { name: form.button, exact: true })
              .click();
          const dialog = page.getByRole("dialog", {
            name: form.title,
            exact: true,
          });
          await expect(dialog).toBeVisible();
          const result = await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          report.push({
            form: form.title,
            width,
            axe: result.violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          });
          expect
            .soft(
              result.violations.map((v) => v.id),
              `${role} ${form.title} ${width}: axe`,
            )
            .toEqual([]);
          await page.screenshot({
            path: `${output}/form-${width}.png`,
            fullPage: true,
          });
          await dialog
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
          await expect(dialog).not.toBeVisible();
        }
        // Audit shared shell in both themes; route-specific results above remain explicit.
        for (const theme of ["light", "dark"]) {
          await page.goto(routes[0]);
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          await expect(page.locator("main")).toBeVisible();
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          report.push({
            width,
            theme,
            axe: axe.violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          });
          expect
            .soft(
              axe.violations.map((v) => v.id),
              `${role} ${width} ${theme}: axe`,
            )
            .toEqual([]);
        }
      }
      writeFileSync(
        `${output}/report.json`,
        JSON.stringify(
          { role, report, unavailable: [...unavailable], errors, writes },
          null,
          2,
        ),
      );
      expect(errors).toEqual([]);
      expect(writes).toEqual([]);
    });
  }
});

test.describe("shared UI cleanup", () => {
  test.skip(!configured);
  test("developer preview cards explain their purpose and open the existing tools", async ({
    page,
  }) => {
    const state = await workspaceAccessMock(page);
    await login(page);
    await page.goto("/developer");
    const tools = page.getByRole("region", { name: "Preview tools" });
    await expect(tools).toContainText("read-only mode");
    await expect(tools).toContainText("sample data");
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const link of await tools.getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(48);
        expect(box!.height).toBeLessThanOrEqual(100);
        expect(
          await link.evaluate((element) => getComputedStyle(element).boxShadow),
        ).toBe("none");
      }
    }
    await tools.getByRole("link", { name: /Account preview/ }).click();
    await expect(page).toHaveURL(/\/developer\/members$/);
    await page.goto("/developer");
    await tools.getByRole("link", { name: /Role previews/ }).click();
    await expect(page).toHaveURL(/\/developer\/previews$/);
    expect(state.saves).toBe(0);
    expect(state.delegations).toBe(0);
  });
  test("home activity opens the selected request and booking without a write", async ({
    page,
  }) => {
    await workspaceAccessMock(page, { auditRole: "homeowner" });
    const id = "50000000-0000-4000-8000-000000000009";
    const bookingId = "50000000-0000-4000-8000-000000000019";
    const now = new Date().toISOString();
    const request = {
      id,
      client_id: "50000000-0000-4000-8000-000000000008",
      owner_id: "11111111-1111-4111-8111-111111111112",
      title: "Synthetic repair for activity test",
      description: "Synthetic repair details.",
      category: "Maintenance",
      unit_snapshot: "Synthetic address",
      status: "Open",
      version: 1,
      created_at: now,
      updated_at: now,
    };
    const booking = {
      id: bookingId,
      facility_id: "50000000-0000-4000-8000-000000000029",
      facility_name: "Synthetic court",
      purpose: "Synthetic activity booking",
      attendees: 2,
      starts_at: now,
      ends_at: new Date(Date.now() + 3600000).toISOString(),
      status: "Pending",
      version: 1,
    };
    const writes: string[] = [];
    page.on("request", (r) => {
      if (
        r.method() === "POST" &&
        /\/rpc\/bfe_(save|create|approve|reject|submit|post)_/.test(r.url())
      )
        writes.push(r.url());
    });
    await page.route("**/rest/v1/bfe_requests?*", (route) =>
      route.fulfill({
        json: [request],
        headers: {
          "content-range": "0-0/1",
          "access-control-expose-headers": "content-range",
        },
      }),
    );
    await page.route("**/rest/v1/rpc/bfe_booking_dashboard", (route) =>
      route.fulfill({
        json: {
          rows: [booking],
          total: 1,
          facilities: [],
          can_manage: false,
          can_approve: false,
        },
      }),
    );
    await page.route("**/rest/v1/rpc/bfe_open_notification_record", (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        p_kind: "booking",
        p_id: bookingId,
      });
      return route.fulfill({ json: booking });
    });
    await login(page);
    await page.goto("/");
    await page
      .getByRole("region", { name: "Request updates" })
      .getByRole("link", { name: /Synthetic repair/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`record=${id}`));
    await expect(
      page.getByText("Synthetic repair details.", { exact: true }),
    ).toBeVisible();
    await page.goto("/");
    await page
      .getByRole("region", { name: "Recent bookings" })
      .getByRole("link", { name: /Synthetic court/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`record=${bookingId}`));
    const dialog = page.getByRole("dialog", {
      name: "Booking details",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Synthetic activity booking");
    expect(writes).toEqual([]);
  });
});
