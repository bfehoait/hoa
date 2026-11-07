import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { baselineModules } from "../../packages/shared/src/baseline";

test("every structured module can save a synthetic draft and reload it", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const definition of baselineModules) {
    await page.goto(`/explore/${definition.id}`);
    await page
      .getByRole("button", { name: "Prepare sample", exact: true })
      .click();
    await page.getByRole("button", { name: "Fill synthetic example" }).click();
    await page
      .getByRole("button", { name: "Save local draft", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(
      "Sample draft saved",
    );
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: new RegExp(
          `Sample ${definition.title.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        ),
      }),
    ).toBeVisible();
  }
  await page.goto("/explore");
  await expect(page.getByRole("status")).toContainText(
    `${baselineModules.length} locally saved records`,
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    `${baselineModules.length} locally saved records`,
  );
});

test("draft editing, review, local conversation and archive use current persisted state", async ({
  page,
}) => {
  await page.goto("/explore/messages");
  await page
    .getByRole("button", { name: "Prepare sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Fill synthetic example" }).click();
  await page
    .getByRole("button", { name: "Save local draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: /Sample resident–office inbox/ })
    .click();
  await page.getByRole("button", { name: "Edit sample details" }).click();
  await page
    .getByLabel("Sample title", { exact: true })
    .fill("Sample billing conversation");
  await page
    .getByRole("button", { name: "Save local draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByLabel("Local message (not sent)")
    .fill("Synthetic follow-up about a sample statement.");
  await page.getByRole("button", { name: "Add local note" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Local note (not sent): Synthetic follow-up",
  );
  await page
    .getByRole("button", { name: "Submit locally", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Add a short reason");
  await page
    .getByLabel("Reason for local review change")
    .fill("Review the synthetic conversation");
  await page
    .getByRole("button", { name: "Submit locally", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start local review", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start local review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archive locally", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add local note" }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText("Archived");
});

test("imports map, reject invalid data and stage drafts without changing finance", async ({
  page,
}) => {
  await page.goto("/explore/imports");
  await page.getByLabel("Sample import type").selectOption("payments");
  await page.getByRole("button", { name: "Use synthetic example CSV" }).click();
  await page
    .getByRole("button", { name: "Read sample CSV", exact: true })
    .click();
  await page.getByRole("button", { name: "Validate mapped rows" }).click();
  await expect(page.getByRole("table")).toContainText("Valid synthetic draft");
  await page.getByRole("button", { name: "Stage local draft batch" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No official records were created",
  );
  await expect(
    page.getByRole("button", { name: "Stage local draft batch" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Review staged drafts" }).click();
  await expect(
    page.getByRole("button", { name: /Sample payment evidence · row 1/ }),
  ).toContainText("Draft");
  await page.goto("/account");
  await expect(
    page.getByText("₱1,850.00", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/explore/imports");
  await page
    .getByLabel("Sample CSV text", { exact: false })
    .fill("unit,owner,area,occupancy\nReal unit,Real owner,120,Unknown");
  await page
    .getByRole("button", { name: "Read sample CSV", exact: true })
    .click();
  await page.getByRole("button", { name: "Validate mapped rows" }).click();
  await expect(page.getByRole("table")).toContainText("synthetic format");
  await expect(
    page.getByRole("button", { name: "Stage local draft batch" }),
  ).toBeDisabled();
});

test("assessment calculator requires supplied figures and does not create bills", async ({
  page,
}) => {
  await page.goto("/explore/calculator");
  await expect(page.getByText("Not calculated", { exact: true })).toBeVisible();
  await page
    .getByLabel("Sample assessment mode")
    .selectOption("Per square metre");
  await page.getByLabel("Sample rate in PHP").fill("12.35");
  await page.getByLabel("Sample area in square metres").fill("120.5");
  await expect(page.getByText("₱1,488.18", { exact: true })).toBeVisible();
});

for (const width of [360, 1280])
  for (const theme of ["light", "dark"]) {
    test(`feature baseline accessibility ${width} ${theme}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (value) => localStorage.setItem("bellefort-theme", value),
        theme,
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const route of [
        "/explore",
        ...baselineModules.map((item) => `/explore/${item.id}`),
        "/explore/imports",
        "/explore/calculator",
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
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => node.target),
          })),
          route,
        ).toEqual([]);
        const targets = await page
          .locator("a,button,input,select,textarea,summary")
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => {
                const rect = node.getBoundingClientRect();
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  (rect.width < 48 || rect.height < 48)
                );
              })
              .map(
                (node) =>
                  node.textContent?.slice(0, 60) ||
                  node.getAttribute("aria-label"),
              ),
          );
        expect(targets, route).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }

test("structured forms and populated record remain accessible on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of [
    "businesses",
    "garage-sales",
    "booth-events",
    "ride-requests",
    "election-setup",
  ]) {
    await page.goto(`/explore/${id}`);
    await page
      .getByRole("button", { name: "Prepare sample", exact: true })
      .click();
    await page.getByRole("button", { name: "Fill synthetic example" }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Save local draft", exact: true })
      .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", { name: /Sample / })
      .first()
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
  }
});
