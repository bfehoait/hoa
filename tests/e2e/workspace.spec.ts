import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("sample application reaches office review without granting membership", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Sample full name").fill("Demo Applicant");
  await page.getByLabel("Sample email").fill("demo@example.invalid");
  await page.getByLabel("Sample unit").fill("Demo A-09");
  await page.getByRole("button", { name: "Save sample application" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No account was created",
  );
  await page.getByRole("link", { name: "Open the local review queue" }).click();
  await page.getByRole("button", { name: /Demo Applicant/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Not verified");
  await page
    .getByRole("button", { name: "In review · local", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Add a short reason");
  await page
    .getByLabel("Reason for local change")
    .fill("Checking synthetic evidence");
  await page
    .getByRole("button", { name: "In review · local", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Local state updated");
  await expect(
    page.getByRole("button", {
      name: /approve|grant membership|send invitation/i,
    }),
  ).toHaveCount(0);
});

test("local publication appears in the resident feed with sample labels", async ({
  page,
}) => {
  await page.goto("/office/announcements");
  await page.getByRole("button", { name: "New sample announcement" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Sample community garden update");
  await page
    .getByLabel("Details", { exact: true })
    .fill(
      "This is a synthetic announcement to test the local publishing workflow.",
    );
  await page.getByRole("button", { name: "Save sample record" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: /Sample community garden update/ })
    .click();
  await page
    .getByLabel("Reason for local change")
    .fill("Publish synthetic preview content");
  await page.getByRole("button", { name: "Publish in preview" }).click();
  await expect(page.getByRole("status")).toContainText("No external system");
  await page.goto("/community");
  await page
    .getByRole("link", { name: /Sample community garden update/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sample community garden update" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample announcement", { exact: true }),
  ).toBeVisible();
});

test("developer diagnostics exclude record content and probe real local storage", async ({
  page,
}) => {
  await page.goto("/developer");
  await page.getByRole("button", { name: "Run local storage check" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Write, read and removal confirmed",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download safe diagnostics" }).click();
  const file = await download;
  const contents = await readFile((await file.path())!, "utf8");
  const report = JSON.parse(contents);
  expect(report.backend).toBe("not connected");
  expect(report.databaseRefusalTests).toBe("not run");
  expect(contents).not.toContain("jamie@example.invalid");
  expect(contents).not.toContain("09170000000");
  expect(contents).not.toContain("VITE_SUPABASE");
});

test("office assignment is local, recorded, and visible on reopening", async ({
  page,
}) => {
  await page.goto("/office/requests");
  await page.getByRole("button", { name: /Streetlight near Block 08/ }).click();
  await page.getByLabel("Sample assignee").selectOption("Demo staff A");
  await page.getByRole("button", { name: "Assign locally" }).click();
  await expect(page.getByRole("status")).toContainText("No staff notification");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /Streetlight near Block 08/ }).click();
  await expect(page.getByLabel("Sample assignee")).toHaveValue("Demo staff A");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/office/history");
  await expect(
    page.getByText(/Assigned local request REQ-1042 to Demo staff A/),
  ).toBeVisible();
});

test("calendar navigation and unknown expense amounts are explicit", async ({
  page,
}) => {
  await page.goto("/services/calendar");
  await expect(
    page.getByRole("heading", { name: "November 2026", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next sample month" }).click();
  await expect(
    page.getByRole("heading", { name: "December 2026", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nothing scheduled this month" }),
  ).toBeVisible();
  await expect(
    page
      .locator('[aria-label="Monthly agenda"]')
      .getByRole("link", { name: /Clubhouse/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reset month", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "November 2026", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('[aria-label="Monthly agenda"]')
      .getByRole("link", { name: /Clubhouse/ }),
  ).toBeVisible();
  await page.goto("/office/finance/expenses");
  await page.getByRole("button", { name: "Add sample expense" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Unknown sample expense amount");
  await page
    .getByLabel("Details", { exact: true })
    .fill("No supporting amount has been supplied for this sample.");
  await page.getByRole("button", { name: "Save sample record" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: /Unknown sample expense amount/ })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Not supplied", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("₱0.00", { exact: true }),
  ).toHaveCount(0);
});

test("developer reset recovers malformed workspace data without deleting resident records", async ({
  page,
}) => {
  await page.goto("/office");
  await page.evaluate(() =>
    sessionStorage.setItem("bellefort-workspace-v1", "{damaged"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("damaged");
  await page.getByRole("link", { name: "Open local recovery tools" }).click();
  await page.getByRole("button", { name: "Review reset" }).click();
  await page
    .getByRole("button", { name: "Reset selected preview data" })
    .click();
  await expect(page.getByRole("status")).toContainText("reset locally");
  await page.goto("/office/registrations");
  await expect(page.getByRole("button", { name: /Jamie/ })).toBeVisible();
  await page.goto("/services/requests");
  await expect(
    page.getByRole("button", { name: /Streetlight near Block 08/ }),
  ).toBeVisible();
});

test("leaving the preview clears in-memory state and returns to an explicit entry screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/sign-out");
  await expect(page).toHaveURL(/\/sign-in\?closed=1$/);
  await expect(page.getByRole("status")).toContainText(
    "in-memory preview state cleared",
  );
  await expect(page.getByRole("textbox", { name: /password/i })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Office preview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What needs your attention" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Finance", exact: true }),
  ).toHaveCount(1);
});

test("vehicles, permits, learning and transport support local requests with no real confirmations", async ({
  page,
}) => {
  for (const [route, button, title] of [
    ["/more/vehicles", "Add vehicle", "Demo vehicle enquiry"],
    ["/more/permits", "Request a permit", "Demo permit enquiry"],
    ["/more/training", "Save sample interest", "Demo learning interest"],
    ["/more/transport", "Save sample ride interest", "Demo ride interest"],
  ]) {
    await page.goto(route);
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page
      .getByLabel("Details", { exact: true })
      .fill("Synthetic details only for local workflow testing.");
    await page.getByRole("button", { name: "Save sample record" }).click();
    await expect(page.getByRole("status")).toContainText(
      "No real approval, payment or delivery",
    );
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(title) }),
    ).toBeVisible();
  }
});

test("reference source is not served and the source catalogue exposes metadata only", async ({
  page,
  request,
}) => {
  for (const route of [
    "/reference/upstream-hoa/index.html",
    "/REFERENCE/upstream-hoa/HOA-1.html",
    "/reference/not-present.html",
  ]) {
    const response = await request.get(route);
    expect(response.status()).toBe(403);
  }
  await page.goto("/developer/source");
  await expect(
    page.getByRole("heading", {
      name: "Source coverage catalogue",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search source information" })
    .fill("carpool");
  await expect(
    page.getByRole("heading", { name: "Rides and carpools" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Functions", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search source information" })
    .fill("myLotPaymentsCard");
  await expect(
    page.getByRole("cell", { name: "myLotPaymentsCard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "7519", exact: true }),
  ).toBeVisible();
});

for (const width of [360, 1280])
  for (const theme of ["light", "dark"])
    test(`extended workspaces ${width}px ${theme}: accessibility and layout`, async ({
      page,
    }) => {
      test.setTimeout(150000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("bellefort-theme", theme),
        theme,
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const route of [
        "/sign-in",
        "/register",
        "/recover",
        "/office",
        "/office/registrations",
        "/office/residents",
        "/office/finance",
        "/office/finance/expenses",
        "/office/finance/reconciliation",
        "/office/operations",
        "/office/requests",
        "/office/announcements",
        "/office/documents",
        "/office/access",
        "/office/settings",
        "/developer",
        "/developer/scenarios",
        "/developer/components",
        "/developer/runbook",
        "/developer/source",
        "/security",
        "/security/incidents",
        "/security/vehicles",
        "/driver",
        "/board",
        "/more/notifications",
        "/services/calendar",
      ]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route,
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          route,
        ).toEqual([]);
        const targets = await page
          .locator("a,button,input,select,textarea,summary")
          .evaluateAll((elements) =>
            elements
              .filter((el) => {
                const rect = el.getBoundingClientRect();
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.top >= 0 &&
                  (rect.width < 48 || rect.height < 48)
                );
              })
              .map((el) => ({
                label:
                  el.textContent?.slice(0, 50) || el.getAttribute("aria-label"),
                w: el.getBoundingClientRect().width,
                h: el.getBoundingClientRect().height,
              })),
          );
        expect(targets, route).toEqual([]);
      }
      expect(errors).toEqual([]);
    });

for (const width of [320, 390, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`resident feature pages ${width}px ${theme}: visual cards and accessible controls`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (value) => localStorage.setItem("bellefort-theme", value),
        theme,
      );
      for (const route of [
        "/more/vehicles",
        "/more/permits",
        "/more/documents",
        "/services/calendar",
        "/directory",
        "/services/inbox",
        "/more/profile",
        "/more/training",
        "/more/transport",
        "/more/elections",
        "/more/marketplace",
      ]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route,
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          result.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
          route,
        ).toEqual([]);
        const small = await page
          .locator("a,button,input,select,textarea,summary")
          .evaluateAll((elements) =>
            elements
              .filter((el) => {
                const rect = el.getBoundingClientRect();
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  (rect.width < 48 || rect.height < 48)
                );
              })
              .map((el) => ({
                label:
                  el.textContent?.slice(0, 60) || el.getAttribute("aria-label"),
                width: el.getBoundingClientRect().width,
                height: el.getBoundingClientRect().height,
              })),
          );
        expect(small, route).toEqual([]);
      }
    });
  }
}
