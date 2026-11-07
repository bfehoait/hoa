import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function verifyQaFollowup(page: Page, info: TestInfo) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const configurations = [
    { width: 390, theme: "light" },
    { width: 1440, theme: "light" },
    { width: 1440, theme: "dark" },
  ];
  for (const { width, theme } of configurations) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(
      (value) => localStorage.setItem("bellefort-theme", value),
      theme,
    );
    for (const route of [
      "/",
      "/account",
      "/account/statement",
      "/services/requests",
      "/office",
      "/office/finance",
      "/office/finance/expenses",
      "/developer",
      "/developer/modules",
      "/developer/source",
      "/more/notifications",
      "/services/calendar",
      "/coverage",
      "/explore",
      "/recover",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1").filter({ visible: true })).toHaveCount(1);
      await expect(page.locator("main").first()).toBeVisible();
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(axe.violations, `${route} ${width} ${theme}`).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (route === "/office" || route === "/developer")
        await expect(
          page.locator('[aria-labelledby="request-workload-heading"]'),
        ).toBeVisible();
      if (route === "/office/finance")
        await expect(
          page.getByRole("progressbar", {
            name: "Collected from sample billing",
          }),
        ).toBeVisible();
      if (route === "/office/finance/expenses") {
        await expect(
          page.getByRole("region", { name: "Synthetic expense amounts" }),
        ).toContainText("₱1,250.00");
        await page.screenshot({
          path: info.outputPath(`expenses-${width}-${theme}.png`),
        });
      }
      if (route === "/explore") {
        await expect(
          page
            .locator('a[href^="/explore/"]')
            .filter({ has: page.locator("h2") }),
        ).toHaveCount(8);
        const before = await page
          .locator('a[href^="/explore/"]')
          .filter({ has: page.locator("h2") })
          .first()
          .getAttribute("href");
        await page
          .getByRole("button", { name: "Next modules", exact: true })
          .click();
        await expect(page).toHaveURL(/page=1/);
        await expect(
          page
            .locator('a[href^="/explore/"]')
            .filter({ has: page.locator("h2") })
            .first(),
        ).not.toHaveAttribute("href", before!);
      }
    }
  }
  expect(errors).toEqual([]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/office\/finance$/);
}
