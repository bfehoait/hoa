import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".browsers");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [size, source] of [
    [192, "icon.svg"],
    [512, "icon-maskable.svg"],
  ]) {
    const svg = readFileSync(`public/${source}`, "utf8");
    const png = await page.evaluate(
      async ({ svg, size }) => {
        const icon = new Image();
        icon.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        await icon.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(icon, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    writeFileSync(`public/icon-${size}.png`, Buffer.from(png, "base64"));
  }
  console.log("Regenerated 192px and 512px app icons from project-owned SVGs.");
} finally {
  await browser.close();
}
