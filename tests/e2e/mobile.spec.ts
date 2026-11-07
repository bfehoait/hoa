import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Safari engine: visual service search opens the visitor form", async ({
  page,
}) => {
  await page.goto("/services");
  await page.getByLabel("Find a service").fill("gate");
  await page.getByRole("link", { name: /^Invite a visitor/ }).click();
  await expect(page.getByLabel("Visitor’s full name")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "All services", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "More", exact: true })
    .click();
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await page.getByRole("link", { name: /^Marketplace/ }).click();
  await expect(page).toHaveURL(/\/directory\/market$/);
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "More", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("Safari engine: mobile navigation, deep links and dark theme", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Main navigation" }),
  ).not.toBeVisible();
  await nav.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await nav.getByRole("link", { name: "Services", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Services", exact: true }),
  ).toBeVisible({ timeout: 15000 });
});

test("Safari engine: form validation and a local request", async ({ page }) => {
  await page.goto("/services/requests");
  await page.getByRole("button", { name: "New request" }).click();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeFocused();
  await page
    .getByLabel("Title", { exact: true })
    .fill("A sample repair request");
  await page
    .getByLabel("Details", { exact: true })
    .fill("The sample streetlight at the corner needs attention.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status")).toContainText(
    "saved in this browser tab",
  );
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /A sample repair request/ }),
  ).toBeVisible();
});

test("Safari engine: small screen layouts and accessibility", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "/",
    "/account",
    "/community",
    "/services/bookings",
    "/more",
    "/admin",
    "/explore",
    "/explore/jobs",
    "/explore/imports",
    "/explore/calculator",
    "/directory",
    "/office/review",
    "/services/inbox",
    "/account/statement",
    "/more/vehicles",
    "/more/permits",
    "/more/documents",
    "/more/profile",
    "/services/calendar",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1"), route).toBeVisible({ timeout: 15000 });
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
      result.violations.map((v) => v.id),
      route,
    ).toEqual([]);
  }
});

test("Safari engine: connected directory and local conversation", async ({
  page,
}) => {
  await page.goto("/directory");
  await page
    .getByRole("button", { name: "Load synthetic walkthrough", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Synthetic walkthrough loaded",
      exact: true,
    }),
  ).toBeDisabled();
  await page.goto("/directory/learning");
  await page.getByRole("button", { name: "View sample details" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Sample participant capacity",
  );
  await page.keyboard.press("Escape");
  await page.goto("/services/inbox");
  await page.getByLabel("Search local conversations").fill("resident–office");
  await page
    .getByLabel("Synthetic local reply")
    .fill("Synthetic mobile resident follow-up for a local preview.");
  await page
    .getByRole("button", { name: "Save local reply", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No real message was delivered",
  );
  await page.goto("/office/inbox");
  await page.getByLabel("Search local conversations").fill("resident–office");
  await expect(page.getByText("1 local unread", { exact: true })).toBeVisible();
});

test("Safari engine: structured drafts and synthetic CSV staging", async ({
  page,
}) => {
  await page.goto("/explore/jobs");
  await page
    .getByRole("button", { name: "Prepare sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Fill synthetic example" }).click();
  await page
    .getByRole("button", { name: "Save local draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sample draft saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto("/explore/imports");
  await page.getByRole("button", { name: "Use synthetic example CSV" }).click();
  await page
    .getByRole("button", { name: "Read sample CSV", exact: true })
    .click();
  await page.getByRole("button", { name: "Validate mapped rows" }).click();
  await page.getByRole("button", { name: "Stage local draft batch" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No official records were created",
  );
});

test("QA follow-up: financial visuals, module pages and accessible headings", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const { verifyQaFollowup } = await import("./qa-review");
  await verifyQaFollowup(page, info);
});
