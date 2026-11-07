import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".browsers");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "/",
    "/account",
    "/community",
    "/services/bookings",
    "/admin",
    "/office",
    "/developer",
    "/services/calendar",
    "/sign-in",
    "/explore",
    "/explore/jobs",
    "/explore/imports",
    "/explore/calculator",
    "/directory",
    "/office/review",
    "/services/inbox",
    "/office/registry",
    "/driver/dispatch",
    "/security/gate",
    "/account/statement",
    "/coverage",
  ]) {
    const response = await page.goto(`http://127.0.0.1:4173${route}`);
    assert.equal(response.status(), 200, route);
    await page.locator("h1").waitFor();
  }
  const manifest = await (
    await page.request.get("http://127.0.0.1:4173/manifest.webmanifest")
  ).json();
  assert.equal(manifest.display, "standalone");
  for (const size of [192, 512]) {
    assert(manifest.icons.some((i) => i.sizes === `${size}x${size}`));
    const icon = await page.request.get(
      `http://127.0.0.1:4173/icon-${size}.png`,
    );
    assert.equal(icon.status(), 200);
    assert.match(icon.headers()["content-type"], /image\/png/);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const keys = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => r.url),
        ),
      )
    ).flat(),
  );
  assert(keys.length > 0);
  assert(
    keys.every((url) => !/(\/api\/|\/rest\/|supabase\.co|\/auth\/)/.test(url)),
  );
  await context.setOffline(true);
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("heading", { name: /Hello, Alex/ }).waitFor();
  await page.goto("http://127.0.0.1:4173/community");
  await page
    .getByRole("heading", { name: "A neighbourhood, in the know." })
    .waitFor();
  await page.goto("http://127.0.0.1:4173/explore");
  await page
    .getByRole("heading", { name: "Everything has its place." })
    .waitFor();
  await page.goto("http://127.0.0.1:4173/services");
  await page.getByRole("heading", { name: "Services", exact: true }).waitFor();
  await page.goto("http://127.0.0.1:4173/more");
  await page.getByRole("heading", { name: "More", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    `Production smoke passed: 21 deep links, manifest/PNG icons, active service worker, ${keys.length} public cache entries, offline overview/community/feature directory/services/more, no page errors.`,
  );
  await context.close();
} finally {
  await browser.close();
}
