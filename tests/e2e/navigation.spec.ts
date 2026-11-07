import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("mobile service tiles open the right forms and keep tracking separate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services");
  await expect(
    page.getByRole("heading", { name: "Services", exact: true }),
  ).toBeVisible();
  for (const title of [
    "Report a concern",
    "Book an amenity",
    "Invite a visitor",
    "Vehicles & stickers",
    "Request a permit",
    "Message the office",
  ])
    await expect(
      page.getByRole("link", { name: new RegExp(`^${title}`) }),
    ).toBeVisible();
  await page.getByRole("link", { name: /^Report a concern/ }).click();
  await expect(page).toHaveURL(/services\/requests\?new=concern/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("A short title")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "All services", exact: true }).click();
  await page.getByLabel("Find a service").fill("gate");
  await expect(
    page.getByRole("link", { name: /^Report a concern/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /^Invite a visitor/ }).click();
  await expect(page.getByLabel("Visitor’s full name")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "All services", exact: true }).click();
  await page.getByRole("link", { name: /^My requests/ }).click();
  await expect(
    page.getByRole("heading", { name: "My requests", exact: true }),
  ).toBeVisible();
});

test("More groups everyday features and keeps preview tools discoverable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/more");
  await expect(
    page.getByRole("heading", { name: "Your home", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Feature workbench/ }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /^Vehicles & stickers/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^Marketplace/ }),
  ).toHaveAttribute("href", "/directory/market");
  await page.getByLabel("Find a feature").fill("vehicles");
  await expect(
    page.getByRole("link", { name: /^Vehicles & stickers/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Find a feature").fill("");
  const tools = page.locator("summary", {
    hasText: "Preview & maintenance tools",
  });
  await tools.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: /^Feature workbench/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Feature workbench/ }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "More", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("long navigation groups expand with a keyboard and retain deep-link destinations", async ({
  page,
}) => {
  await page.goto("/office/finance");
  const nav = page.getByRole("navigation", {
    name: "Finance workspace navigation",
  });
  await expect(
    nav.getByRole("link", { name: "Import staging", exact: true }),
  ).toHaveCount(0);
  const more = nav.locator("button[aria-controls]");
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Import staging", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await nav.getByRole("link", { name: "Import staging", exact: true }).click();
  await expect(page).toHaveURL(/\/explore\/imports$/);
});

test("active destinations stay visible when an advanced page is opened directly", async ({
  page,
}) => {
  await page.goto("/developer/source");
  const nav = page.getByRole("navigation", { name: "Developer navigation" });
  const selected = nav.locator('a[aria-current="page"]');
  await expect(selected).toBeVisible();
  await expect(selected).toHaveAttribute("href", "/developer/source");
  await expect(
    nav.getByRole("button", { name: /More sections/ }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("preview explanations expand without changing sample records", async ({
  page,
}) => {
  await page.goto("/services");
  const summary = page.locator("summary", {
    hasText: "How this preview works",
  });
  await expect(
    page.getByText("All requests in this preview are synthetic", {
      exact: false,
    }),
  ).not.toBeVisible();
  await summary.click();
  await expect(
    page.getByText("All requests in this preview are synthetic", {
      exact: false,
    }),
  ).toBeVisible();
  await summary.click();
  await expect(
    page.getByText("All requests in this preview are synthetic", {
      exact: false,
    }),
  ).not.toBeVisible();
});

for (const width of [360, 1280])
  for (const theme of ["light", "dark"]) {
    test(`visual navigation ${width} ${theme}: accessibility and layout`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (value) => localStorage.setItem("bellefort-theme", value),
        theme,
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const route of [
        "/services",
        "/services/requests",
        "/services/bookings",
        "/services/visitors",
        "/more",
        "/more/marketplace",
        "/more/documents",
        "/more/elections",
        "/account",
        "/office/finance",
        "/office/review",
        "/developer/source",
        "/directory",
        "/services/inbox",
      ]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (route === "/more") {
          const category = page.getByRole("button", {
            name: "Community",
            exact: true,
          });
          await category.click();
          await category.hover();
        }
        if (route === "/office/finance")
          await page
            .locator('main button.filter[aria-pressed="true"]')
            .first()
            .hover();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route,
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          result.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => node.target),
          })),
          route,
        ).toEqual([]);
        const small = await page
          .locator("a,button,input,select,textarea,summary")
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => {
                const r = node.getBoundingClientRect();
                return (
                  r.width > 0 && r.height > 0 && (r.width < 48 || r.height < 48)
                );
              })
              .map(
                (node) =>
                  node.textContent?.slice(0, 70) ||
                  node.getAttribute("aria-label"),
              ),
          );
        expect(small, route).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }
