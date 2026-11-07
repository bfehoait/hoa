import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const authMode = process.env.BELLEFORT_TEST_AUTH;
const testPort =
  authMode === "configured" ? 5192 : authMode === "missing" ? 5193 : 5191;
if (existsSync(".browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("./.browsers", import.meta.url),
  );
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: authMode
    ? `test-results/auth-${authMode}`
    : "test-results/preview",
  ...(authMode
    ? { testMatch: "auth.spec.ts" }
    : { testIgnore: "auth.spec.ts" }),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: authMode
          ? `playwright-report/auth-${authMode}`
          : "playwright-report/preview",
      },
    ],
  ],
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: authMode ? undefined : ["mobile.spec.ts", "auth.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-webkit",
      testMatch: authMode ? "auth.spec.ts" : "mobile.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: `http://127.0.0.1:${testPort}`,
    env: {
      VITE_APP_MODE: authMode ? "authenticated" : "preview",
      VITE_SUPABASE_URL:
        authMode === "configured" ? "https://bellefort-auth-test.invalid" : "",
      VITE_SUPABASE_PUBLISHABLE_KEY:
        authMode === "configured"
          ? "sb_publishable_synthetic_testing_only"
          : "",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
