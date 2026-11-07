import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".browsers");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const baselineMode = process.argv.includes("--baseline");
const layoutOnly = process.argv.includes("--layout-only");
const directory = ".artifacts/desktop-refresh";
mkdirSync(directory, { recursive: true });
const hashes = {};
try {
  for (const [width, height] of [
    [360, 900],
    [390, 844],
  ])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(
        (theme) => localStorage.setItem("bellefort-theme", theme),
        theme,
      );
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:5173/");
      await page.getByRole("heading", { name: "Hello, Alex." }).waitFor();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      const png = await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: `${directory}/mobile-${width}-${theme}-${baselineMode ? "before" : "after"}.png`,
      });
      hashes[`${width}-${theme}`] = createHash("sha256")
        .update(png)
        .digest("hex");
      await context.close();
    }
  if (baselineMode) {
    writeFileSync(
      `${directory}/mobile-baseline.json`,
      JSON.stringify(hashes, null, 2),
    );
    console.log("Saved four mobile screenshot baselines.");
  } else {
    if (!layoutOnly)
      assert.deepEqual(
        hashes,
        JSON.parse(readFileSync(`${directory}/mobile-baseline.json`, "utf8")),
        "Mobile visuals changed",
      );
    const measurements = [];
    for (const [width, height, scale] of [
      [1280, 720, 1],
      [1536, 740, 1.25],
      [1920, 1080, 1],
      [1024, 768, 1],
    ])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: scale,
        });
        await context.addInitScript(
          (theme) => localStorage.setItem("bellefort-theme", theme),
          theme,
        );
        const page = await context.newPage();
        await page.goto("http://127.0.0.1:5173/");
        await page.getByRole("heading", { name: "Hello, Alex." }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const sidebar = document.querySelector(
            'aside[aria-label="Main navigation"]',
          );
          const balance = document.querySelector(
            'section[aria-label="Sample household account"] article',
          );
          const community = [...document.querySelectorAll("h2")].find(
            (el) => el.textContent === "Community updates",
          );
          return {
            sidebarScroll: sidebar.scrollHeight - sidebar.clientHeight,
            horizontalOverflow:
              document.documentElement.scrollWidth > innerWidth,
            balanceHeight: balance.getBoundingClientRect().height,
            communityHeadingTop: Math.round(
              community.getBoundingClientRect().top,
            ),
          };
        });
        assert.equal(
          layout.sidebarScroll,
          0,
          `${width} ${theme}: unnecessary sidebar scroll`,
        );
        assert.equal(
          layout.horizontalOverflow,
          false,
          `${width} ${theme}: horizontal overflow`,
        );
        if (width >= 1200) {
          assert(layout.balanceHeight < 230, `${width}: balance is too tall`);
          assert(
            layout.communityHeadingTop < height - 100,
            `${width}: updates are buried`,
          );
        }
        await page.screenshot({
          path: `docs/previews/desktop-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
        measurements.push({ width, height, theme, ...layout });
        await context.close();
      }
    writeFileSync(
      `${directory}/measurements.json`,
      JSON.stringify(measurements, null, 2),
    );
    console.log(
      JSON.stringify({
        mobileUnchanged: layoutOnly ? null : 4,
        pixelComparison: layoutOnly
          ? "Skipped: intentional palette change; original baseline retained"
          : "Passed",
        desktopLayouts: measurements,
      }),
    );
  }
} finally {
  await browser.close();
}
