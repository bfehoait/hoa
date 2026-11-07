import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".browsers");
const { chromium } = await import("@playwright/test");
const { default: AxeBuilder } = await import("@axe-core/playwright");
const browser = await chromium.launch();
mkdirSync("docs/previews", { recursive: true });
mkdirSync(".artifacts/palette", { recursive: true });
const report = {
  scans: 0,
  dialogScans: 0,
  contrast: [],
  errors: [],
  screenshots: [],
};
const routes = [
  "/",
  "/account",
  "/admin",
  "/community",
  "/services",
  "/more",
  "/office",
  "/office/access",
  "/security",
  "/driver",
  "/board",
  "/developer/components",
  "/sign-in",
  "/explore",
  "/explore/imports",
  "/more/notifications",
];

function contrast(a, b) {
  const luminance = (hex) => {
    const values = hex
      .trim()
      .replace("#", "")
      .match(/../g)
      .map((part) => {
        const value = parseInt(part, 16) / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
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
      page.on("pageerror", (error) => report.errors.push(error.message));
      for (const route of routes) {
        await page.goto(`http://127.0.0.1:5173${route}`);
        await page.locator("h1").waitFor();
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${route} ${width} ${theme}: overflow`,
        );
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          result.violations.map((item) => ({
            id: item.id,
            targets: item.nodes.map((node) => node.target),
          })),
          [],
          `${route} ${width} ${theme}`,
        );
        report.scans++;
        if (route === "/") {
          const tokens = await page.evaluate(() => {
            const css = getComputedStyle(document.documentElement);
            return Object.fromEntries(
              [
                "brand",
                "on-brand",
                "brand-strong",
                "on-brand-hover",
                "bg",
                "surface",
                "ink",
                "muted",
                "accent",
                "on-accent",
                "accent-soft",
                "wash",
                "green",
                "green-bg",
                "amber",
                "amber-bg",
                "red",
                "red-bg",
              ].map((name) => [name, css.getPropertyValue(`--${name}`).trim()]),
            );
          });
          for (const [foreground, background] of [
            ["on-brand", "brand"],
            ["brand-strong", "on-brand-hover"],
            ["ink", "bg"],
            ["muted", "surface"],
            ["muted", "wash"],
            ["accent", "accent-soft"],
            ["on-accent", "accent"],
            ["green", "green-bg"],
            ["amber", "amber-bg"],
            ["red", "red-bg"],
          ]) {
            const ratio = contrast(tokens[foreground], tokens[background]);
            assert(
              ratio >= 4.5,
              `${theme}: ${foreground}/${background} contrast ${ratio}`,
            );
            report.contrast.push({
              width,
              theme,
              foreground,
              background,
              ratio: Number(ratio.toFixed(2)),
            });
          }
          assert.equal(tokens.brand, "#8b002b");
        }
        if (["/", "/admin", "/account", "/sign-in"].includes(route)) {
          const name = route === "/" ? "home" : route.slice(1);
          const filename = `palette-${name}-${width}-${theme}.png`;
          await page.screenshot({
            path: `docs/previews/${filename}`,
            fullPage: true,
            animations: "disabled",
          });
          report.screenshots.push(filename);
        }
      }
      await page.goto("http://127.0.0.1:5173/services/requests");
      await page
        .getByRole("button", { name: "New request", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save preview request", exact: true })
        .click();
      const dialog = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      assert.deepEqual(
        dialog.violations.map((item) => item.id),
        [],
        `${width} ${theme}: validation dialog`,
      );
      report.dialogScans++;
      await context.close();
    }
  assert.deepEqual(report.errors, []);
  writeFileSync(
    ".artifacts/palette/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Palette checks passed: ${report.scans} route/theme/width scans, ${report.dialogScans} validation dialogs, ${report.contrast.length} token contrast checks, ${report.screenshots.length} synthetic screenshots, no page errors.`,
  );
} finally {
  await browser.close();
}
