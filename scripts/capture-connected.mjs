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
          path: `docs/previews/connected-${name}-${width}-${theme}.png`,
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
        ["directory", "/directory"],
        ["review", "/office/review"],
        ["inbox", "/services/inbox"],
        ["registry", "/office/registry"],
        ["gate", "/security/gate"],
        ["dispatch", "/driver/dispatch"],
        ["statement", "/account/statement"],
        ["coverage", "/coverage"],
        ["governance", "/directory/governance"],
      ]) {
        await visit(route);
        if (name === "inbox")
          await page
            .getByLabel("Search local conversations")
            .fill("resident–office");
        await capture(name);
      }
      await visit("/driver/dispatch");
      await page
        .getByRole("button", { name: /Sample community ride requests/ })
        .click();
      await page
        .getByRole("button", { name: "Record sample dispatch pairing" })
        .click();
      await page
        .getByRole("button", { name: "Simulate next trip step" })
        .click();
      await capture("dispatch-detail");
      await page.keyboard.press("Escape");
      await visit("/security/gate");
      await page
        .getByRole("button", { name: /Sample visitor lookup & walk-ins/ })
        .click();
      await page
        .getByRole("button", { name: "Simulate next gate event" })
        .click();
      await capture("gate-detail");
      await page.keyboard.press("Escape");
      await visit("/explore/garage-sales?new=1");
      await page
        .getByRole("button", { name: "Fill synthetic example" })
        .click();
      await page
        .getByLabel("Sample title", { exact: true })
        .fill("Sample garage item review walkthrough");
      await page
        .getByRole("button", { name: "Save local draft", exact: true })
        .click();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await visit("/office/review?module=garage-sales");
      await page
        .getByRole("button", { name: /Sample garage item review walkthrough/ })
        .click();
      await page
        .getByLabel("Reason for local review change")
        .fill("Inspect the synthetic garage item list");
      await page
        .getByRole("button", { name: "Submit locally", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Start local review", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Mark Sample table reviewed locally",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Request changes for Sample chair",
          exact: true,
        })
        .click();
      await capture("garage-review");
      await context.close();
    }
  console.log(
    "Captured 48 connected-workflow screenshots using synthetic scenario records.",
  );
} finally {
  await browser.close();
}
