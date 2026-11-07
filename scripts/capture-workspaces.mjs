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
        (theme) => localStorage.setItem("bellefort-theme", theme),
        theme,
      );
      const page = await context.newPage();
      for (const [name, route] of [
        ["access", "/sign-in"],
        ["registration", "/register"],
        ["office", "/office"],
        ["review", "/office/registrations"],
        ["developer", "/developer"],
        ["source", "/developer/source"],
        ["security", "/security"],
        ["driver", "/driver"],
        ["board", "/board"],
        ["calendar", "/services/calendar"],
        ["market", "/more/marketplace"],
        ["elections", "/more/elections"],
        ["documents", "/more/documents"],
      ]) {
        await page.goto("http://127.0.0.1:5173" + route);
        await page.locator("h1").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `docs/previews/work-${name}-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.goto("http://127.0.0.1:5173/office/registrations");
      await page.getByRole("button", { name: /Jamie/ }).click();
      await page.getByRole("dialog").waitFor();
      await page.screenshot({
        path: `docs/previews/work-review-detail-${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.goto("http://127.0.0.1:5173/developer/components");
      await page.locator("h1").waitFor();
      await page.screenshot({
        path: `docs/previews/work-components-${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await context.close();
    }
  console.log(
    "Captured 60 extended-workspace screenshots across two widths and both themes.",
  );
} finally {
  await browser.close();
}
