import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  baselineModule,
  baselineModules,
  sampleBaselineFields,
} from "../../packages/shared/src/baseline";
import { liveFieldLabel } from "../../packages/shared/src/feature-records";

const configured = process.env.BELLEFORT_TEST_AUTH === "configured";
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
        dialog.getByRole("button", { name: "Submit for review", exact: true }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
  });
  test("older access endpoint labels unknown permissions without pretending defaults allow access", async ({
    page,
  }) => {
    await api(page, {
      accounts: true,
      developerControl: true,
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
    });
    await page.route("**/rest/v1/rpc/bfe_tab_access", (route) =>
      route.fulfill({ json: { rules: { requests: "edit" }, manager: false } }),
    );
    await login(page);
    await page.goto("/developer/access");
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    const panel = page.getByRole("region", { name: "Tab access settings" });
    const row = panel.getByRole("group", {
      name: "Helpdesk permissions",
      exact: true,
    });
    await expect(panel).toContainText(
      "Current permissions are not reported by this server yet",
    );
    await expect(
      row.getByRole("switch", { name: "Helpdesk: Read & edit", exact: true }),
    ).toBeChecked();
    await expect(row.getByText("Not reported", { exact: true })).toBeVisible();
    await expect(row.getByText("Can read", { exact: true })).toHaveCount(0);
    await expect(row.getByText("Can edit", { exact: true })).toHaveCount(0);
    await panel
      .getByLabel("Find a tab", { exact: true })
      .fill("No synthetic match");
    await expect(panel).toContainText("No tabs match");
  });
  test("member name opens permission matrix with explicit saving and denial recovery", async ({
    page,
  }, testInfo) => {
    await api(page, {
      accounts: true,
      developerControl: true,
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
    });
    let rules: Record<string, string> = {};
    let denied = true;
    let saves = 0;
    await page.route("**/rest/v1/rpc/bfe_*", async (route) => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1);
      const args = route.request().postDataJSON();
      if (name === "bfe_tab_access")
        return route.fulfill({
          json: {
            rules,
            manager: false,
            effective: {
              requests: {
                read: rules.requests === "view",
                create: false,
                reply: false,
                status: false,
              },
              finance: {
                read: true,
                create: false,
                reply: true,
                status: false,
              },
            },
          },
        });
      if (name === "bfe_save_tab_access") {
        saves++;
        expect(args.p_kind).toBe("user");
        expect(args.p_expected).toEqual({});
        expect(args.p_rules).toEqual({ requests: "view" });
        if (denied)
          return route.fulfill({
            status: 403,
            json: { code: "42501", message: "Synthetic refusal" },
          });
        rules = args.p_rules;
        return route.fulfill({ json: null });
      }
      return route.fallback();
    });
    await login(page);
    await page.goto("/developer/access");
    await expect(
      page.getByRole("region", { name: "Tab access settings" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /Sample Staff/ }).click();
    const panel = page.getByRole("region", { name: "Tab access settings" });
    const read = panel.getByRole("switch", {
      name: "Helpdesk: Read only",
      exact: true,
    });
    const edit = panel.getByRole("switch", {
      name: "Helpdesk: Read & edit",
      exact: true,
    });
    const inherit = panel.getByRole("button", {
      name: "Helpdesk: Use defaults",
      exact: true,
    });
    const row = panel.getByRole("group", {
      name: "Helpdesk permissions",
      exact: true,
    });
    await expect(inherit).toHaveAttribute("aria-pressed", "true");
    await expect(row.getByText("Cannot read", { exact: true })).toBeVisible();
    await expect(
      panel.getByRole("group", {
        name: "Finance & payments permissions",
        exact: true,
      }),
    ).toContainText("Some changes allowed");
    await expect(
      panel.getByRole("button", { name: "Save tab permissions", exact: true }),
    ).toHaveCount(0);
    await edit.check();
    await expect(edit).toBeChecked();
    await expect(row.getByText("Cannot read", { exact: true })).toBeVisible();
    await expect(row).toContainText("Unsaved change");
    await expect(
      page.getByRole("button", { name: "Account list", exact: true }),
    ).toBeDisabled();
    await expect(
      panel.getByLabel("Data scope", { exact: true }),
    ).toBeDisabled();
    expect(saves).toBe(0);
    await read.check();
    await expect(read).toBeChecked();
    await read.focus();
    await page.keyboard.press("Space");
    await expect(inherit).toHaveAttribute("aria-pressed", "true");
    await panel
      .getByRole("switch", { name: "Helpdesk: No access", exact: true })
      .check();
    await expect(
      panel.getByRole("switch", { name: "Helpdesk: No access", exact: true }),
    ).toBeChecked();
    await expect(edit).not.toBeChecked();
    await inherit.click();
    await expect(inherit).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Account list", exact: true }),
    ).toBeEnabled();
    await read.check();
    await panel
      .getByLabel("Reason for this change")
      .fill("Synthetic permission review");
    await panel
      .getByRole("button", { name: "Save tab permissions", exact: true })
      .click();
    await expect(panel.getByRole("alert")).toContainText("do not allow");
    await expect(read).toBeChecked();
    denied = false;
    await panel
      .getByRole("button", { name: "Save tab permissions", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText(
      "confirmed by the server",
    );
    await expect(row.getByText("Can read", { exact: true })).toBeVisible();
    await expect(row.getByText("Cannot edit", { exact: true })).toBeVisible();
    expect(saves).toBe(2);
    await expect(
      page.getByRole("button", { name: "Account list", exact: true }),
    ).toBeEnabled();
    await panel.getByLabel("Find a tab", { exact: true }).fill("Helpdesk");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
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
            "-member-access-" +
            width +
            "-" +
            theme +
            ".png",
        });
      }
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
      page.getByRole("button", { name: "Review submission", exact: true }),
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
  test("keeps developer navigation stable across Office and saves role defaults with responsive controls", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await api(page, {
      accounts: true,
      developerControl: true,
      permissions: [],
      liveRequests: true,
      people: true,
      member: { ...baseMember, role: "admin", extra_roles: ["developer"] },
    });
    let rules: Record<string, string> = {};
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
        if (name === "bfe_tab_access") return reply({ rules, manager: false });
        if (name === "bfe_save_tab_access") {
          expect(args.p_expected).toEqual(rules);
          rules = args.p_rules;
          return reply(null);
        }
        return route.fallback();
      },
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page);
    await page.goto("/developer");
    const officeNav = page.getByRole("navigation", {
      name: "Office navigation",
    });
    const link = officeNav.getByRole("link", { name: "Overview", exact: true });
    await link.scrollIntoViewIfNeeded();
    const container = officeNav.locator("..").locator("..");
    const scroll = await container.evaluate((el) => el.scrollTop);
    await link.click();
    await expect(
      page.getByRole("heading", {
        name: "Your office, organized.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Find a system module", { exact: true }),
    ).toBeVisible();
    expect(
      Math.abs((await container.evaluate((el) => el.scrollTop)) - scroll),
    ).toBeLessThan(4);
    await expect(
      page.getByText("DEVELOPER CONSOLE", { exact: true }),
    ).toBeVisible();
    await page.goto("/developer/access");
    await page
      .locator("summary")
      .filter({ hasText: /^Role & committee defaults$/ })
      .click();
    const panel = page.getByRole("region", { name: "Tab access settings" });
    await panel.getByLabel("Configure", { exact: true }).selectOption("role");
    await panel.getByLabel("Role", { exact: true }).selectOption("homeowner");
    await panel.getByLabel("Data scope", { exact: true }).selectOption("own");
    await panel
      .getByRole("switch", { name: "Helpdesk: Read only", exact: true })
      .check();
    await panel.getByLabel("Reason for this change").fill("Synthetic UI test");
    await panel
      .getByRole("button", { name: "Save tab permissions", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText(
      "confirmed by the server",
    );
    expect(rules).toEqual({ requests: "view" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path:
        "test-results/ui-review/" +
        testInfo.project.name +
        "-permissions-desktop.png",
      fullPage: false,
    });
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
    await page.screenshot({
      path:
        "test-results/ui-review/" +
        testInfo.project.name +
        "-permissions-mobile.png",
      fullPage: false,
    });
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
        name: "Your office, organized.",
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
        if (name === "bfe_participation_dashboard")
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
        if (name === "bfe_request_participation") {
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
    await page.goto("/explore/participation");
    await page.getByRole("button", { name: "Apply to an activity" }).click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Activity", exact: true })
      .selectOption(activity);
    await dialog.getByLabel("Places", { exact: true }).fill("2");
    await dialog
      .getByLabel("Application details")
      .fill("Synthetic workshop application");
    await dialog.getByRole("button", { name: "Submit application" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Application saved. Confirmation is pending."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Application actions" }).click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("option", { name: "Confirmed", exact: true }),
    ).toHaveCount(0);
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic resident withdrawal");
    await dialog.getByRole("button", { name: "Confirm decision" }).click();
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
            name: liveFieldLabel(field.label),
            exact: true,
          })
        : dialog.getByLabel(liveFieldLabel(field.label), { exact: true });
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
      if (url.searchParams.get("status"))
        rows = rows.filter(
          (row) => `eq.${row.status}` === url.searchParams.get("status"),
        );
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
    if (url.pathname.startsWith("/rest/v1/rpc/bfe_")) {
      expect(options.liveRequests).toBe(true);
      expect(request.method()).toBe("POST");
      const args = request.postDataJSON();
      const now = new Date().toISOString();
      if (url.pathname.endsWith("bfe_create_request")) {
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
      /IssueComplaintConcernIdea/,
    );
    await dialog
      .getByRole("combobox", { name: "Category" })
      .selectOption("Idea");
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
        name: "Your office, organized.",
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
        name: "Your office, organized.",
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
    await expect(
      page.getByRole("heading", { name: "Your office, organized." }),
    ).toBeVisible({ timeout: 15000 });
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
    await expect(page).toHaveURL(
      /\/(?:developer|office|board|security|driver|more\/profile)?$/,
    );
    await page.goto("/services/requests?new=concern");
    await page
      .getByLabel("Title", { exact: true })
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
        name: "Open Synthetic read only case",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Read-only access.");
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
        name: "Open Synthetic read only case",
        exact: true,
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
    await expect(page).toHaveURL(/\/$/);
    await page.reload();
    if (page.viewportSize()!.width < 1024) {
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "More", exact: true })
        .click();
      await page
        .locator("main summary")
        .filter({ hasText: /^Office$/ })
        .click();
      await page
        .getByRole("link", { name: "Office: Overview", exact: true })
        .click();
    } else {
      await page
        .getByRole("navigation", { name: "Office navigation" })
        .getByRole("link", { name: "Overview", exact: true })
        .click();
    }
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
      await page.evaluate(() =>
        sessionStorage.getItem("bellefort-auth-session"),
      ),
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
    await api(page, { identityFails: true });
    await login(page);
    await expect(page.getByRole("alert")).toContainText(
      "session could not be verified",
    );
    await page.goto("/office");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
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
      page.getByRole("link", { name: "Office & administration" }),
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
      page.getByRole("heading", { name: /Hello, Alex/ }),
    ).toBeVisible();
    await page.evaluate(() => {
      const value = JSON.parse(
        sessionStorage.getItem("bellefort-auth-session")!,
      );
      value.expires_at = Math.floor(Date.now() / 1000) - 120;
      sessionStorage.setItem("bellefort-auth-session", JSON.stringify(value));
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
    await expect(page.getByLabel("Find a module", { exact: true })).toHaveValue(
      "Finance",
    );
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
      .getByLabel("Title", { exact: true })
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
        name: "Open Synthetic repair request",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/office/requests");
    await page
      .getByRole("button", {
        name: "Open Synthetic repair request",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Your reply")
      .fill("Synthetic office reply, received and under review.");
    await page.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Reply saved.");
    await page.getByRole("button", { name: "Start work", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("In progress");
    await page.keyboard.press("Escape");
    await page.goto("/services/requests");
    await page
      .getByRole("button", {
        name: "Open Synthetic repair request",
        exact: true,
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
        name: "Community calendar",
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
    await api(page, { member: { ...baseMember, role: "admin" }, people: true });
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
    await api(page, { member: { ...baseMember, role: "developer" } });
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
