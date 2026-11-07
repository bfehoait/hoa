import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".browsers");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const output = "docs/previews";
mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage();
  // Rasterize our code-owned SVG mark for installable web app manifests.
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.goto("http://127.0.0.1:5173/icon-maskable.svg");
    await page.screenshot({ path: `public/icon-${size}.png` });
  }
  for (const width of [360, 1280])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("bellefort-theme", theme),
        theme,
      );
      for (const [name, route] of [
        ["overview", "/"],
        ["account", "/account"],
        ["payment-history", "/account/payments"],
        ["community", "/community"],
        ["bookings", "/services/bookings"],
        ["reports", "/admin"],
        ["empty", "/more/documents"],
        ...["overdue", "paid", "unbilled", "loading", "error"].map((s) => [
          s,
          `/?state=${s}`,
        ]),
      ]) {
        await page.goto(`http://127.0.0.1:5173${route}`);
        await page
          .locator(
            name === "loading" ? '[aria-label="Loading your community"]' : "h1",
          )
          .first()
          .waitFor();
        await page.screenshot({
          path: `${output}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      await page.goto("http://127.0.0.1:5173/services/requests");
      await page.getByRole("button", { name: "New request" }).click();
      await page.getByRole("button", { name: "Save preview request" }).click();
      await page.getByText("Use at least 5 characters.").waitFor();
      await page.screenshot({
        path: `${output}/validation-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByLabel("A short title").fill("Demo streetlight report");
      await page
        .getByLabel("Tell us a little more")
        .fill("The sample streetlight by the corner needs attention.");
      await page.getByRole("button", { name: "Save preview request" }).click();
      await page.getByText("Saved in your preview.").waitFor();
      await page.screenshot({
        path: `${output}/confirmation-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.goto("http://127.0.0.1:5173/account");
      await page.getByRole("button", { name: "Payment options" }).click();
      await page.getByRole("dialog").waitFor();
      await page.screenshot({
        path: `${output}/payment-options-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Back to my account" }).click();
      await page.evaluate(() => sessionStorage.clear());
    }
  console.log("Captured 60 responsive preview screenshots and two app icons.");
} finally {
  await browser.close();
}
