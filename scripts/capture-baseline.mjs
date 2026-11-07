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
          path: `docs/previews/baseline-${name}-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      const prepare = async (id) => {
        await visit(`/explore/${id}`);
        await page
          .getByRole("button", { name: "Prepare sample", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Fill synthetic example" })
          .click();
      };
      const save = async () => {
        await page
          .getByRole("button", { name: "Save local draft", exact: true })
          .click();
        await page.getByRole("button", { name: "Done", exact: true }).click();
      };
      await visit("/explore");
      await capture("directory");
      await prepare("jobs");
      await capture("job-form");
      await page.keyboard.press("Escape");
      await prepare("booth-events");
      await save();
      await capture("booth-events");
      await prepare("ride-requests");
      await save();
      await page
        .getByRole("button", { name: /Sample community ride requests/ })
        .click();
      await page
        .getByRole("button", { name: "Simulate next trip step" })
        .click();
      await page
        .getByRole("button", { name: "Simulate next trip step" })
        .click();
      await capture("ride-simulation");
      await page.keyboard.press("Escape");
      await visit("/explore/imports");
      await page
        .getByRole("button", { name: "Use synthetic example CSV" })
        .click();
      await page
        .getByRole("button", { name: "Read sample CSV", exact: true })
        .click();
      await page.getByRole("button", { name: "Validate mapped rows" }).click();
      await capture("import-review");
      await visit("/explore/calculator");
      await page
        .getByLabel("Sample assessment mode")
        .selectOption("Per square metre");
      await page.getByLabel("Sample rate in PHP").fill("12.35");
      await page.getByLabel("Sample area in square metres").fill("120.5");
      await capture("calculator");
      await context.close();
    }
  console.log(
    "Captured 24 synthetic feature-baseline screenshots at two widths in both themes.",
  );
} finally {
  await browser.close();
}
