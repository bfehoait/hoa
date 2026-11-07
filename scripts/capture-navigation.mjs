import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".browsers");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
mkdirSync("docs/previews", { recursive: true });
try {
  for (const width of [360, 1280])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await context.addInitScript(
        (value) => localStorage.setItem("bellefort-theme", value),
        theme,
      );
      const page = await context.newPage();
      const visit = async (route) => {
        await page.goto(`http://127.0.0.1:5173${route}`);
        await page.locator("h1").waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const capture = async (name) =>
        page.screenshot({
          path: `docs/previews/navigation-${name}-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      await visit("/directory");
      await page
        .getByRole("button", {
          name: "Load synthetic walkthrough",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Synthetic walkthrough loaded",
          exact: true,
        })
        .waitFor();
      for (const [name, route] of [
        ["services", "/services"],
        ["more", "/more"],
        ["requests", "/services/requests"],
        ["amenities", "/services/bookings"],
        ["visitors", "/services/visitors"],
        ["account", "/account"],
        ["finance", "/office/finance"],
        ["market", "/directory/market"],
        ["developer", "/developer/source"],
      ]) {
        await visit(route);
        await capture(name);
      }
      await visit("/more");
      await page
        .getByRole("button", { name: "Community", exact: true })
        .click();
      await capture("more-community");
      await page.getByRole("button", { name: "All", exact: true }).click();
      await page
        .locator("summary", { hasText: "Preview & maintenance tools" })
        .click();
      await capture("more-tools");
      await visit("/office/finance");
      await page
        .getByRole("navigation", { name: "Finance workspace navigation" })
        .locator("button[aria-controls]")
        .click();
      await capture("finance-expanded");
      await visit("/services");
      await page.getByRole("link", { name: /^Report a concern/ }).click();
      await page
        .getByRole("button", { name: "Save preview request", exact: true })
        .click();
      await capture("request-validation");
      await context.close();
    }
  console.log(
    "Captured 52 visual-navigation screenshots across two widths and both themes, using synthetic data.",
  );
} finally {
  await browser.close();
}
