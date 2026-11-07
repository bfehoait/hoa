import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function scenario(page: Page) {
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
}
async function draft(page: Page, id: string, title: string) {
  await page.goto(`/explore/${id}`);
  await page
    .getByRole("button", { name: "Prepare sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Fill synthetic example" }).click();
  await page.getByLabel("Sample title", { exact: true }).fill(title);
}
async function save(page: Page) {
  await page
    .getByRole("button", { name: "Save local draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sample draft saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
}
test("garage publication requires per-item local review without official approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await draft(page, "garage-sales", "Sample garage item review");
  await save(page);
  await page.goto("/office/review?module=garage-sales");
  await page.getByRole("button", { name: /Sample garage item review/ }).click();
  await page
    .getByLabel("Reason for local review change")
    .fill("Inspect each synthetic garage-sale item");
  await page
    .getByRole("button", { name: "Submit locally", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start local review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish to local sample views", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "every current sample garage item",
  );
  await page
    .getByRole("button", {
      name: "Mark Sample table reviewed locally",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Request changes for Sample chair",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Changes requested");
  await page
    .getByRole("button", {
      name: "Mark Sample chair reviewed locally",
      exact: true,
    })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Publish to local sample views", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Preview published");
});
async function publish(page: Page, module: string, title: string) {
  await page.goto(`/office/review?module=${module}`);
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page
    .getByLabel("Reason for local review change")
    .fill("Inspect synthetic demonstration content");
  await page
    .getByRole("button", { name: "Submit locally", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start local review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish to local sample views", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Preview published");
  await page.getByRole("button", { name: "Close record", exact: true }).click();
}

test("business content reaches the directory through local review and disappears after archive", async ({
  page,
}) => {
  await draft(page, "businesses", "Sample garden services");
  await save(page);
  await page.getByRole("button", { name: /Sample garden services/ }).click();
  await page
    .getByRole("button", { name: "Add sample image reference", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Synthetic media references",
  );
  await page.getByRole("button", { name: "Close record", exact: true }).click();
  await publish(page, "businesses", "Sample garden services");
  await page.goto("/directory");
  await page
    .getByLabel("Search published samples")
    .fill("Sample garden services");
  await expect(
    page.getByRole("heading", { name: "Sample garden services", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View sample details" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Metadata only; no hosted file",
  );
  await page.keyboard.press("Escape");
  await page.goto("/office/review?module=businesses");
  await page.getByRole("button", { name: /Sample garden services/ }).click();
  await page
    .getByLabel("Reason for local review change")
    .fill("Withdraw sample directory listing");
  await page
    .getByRole("button", { name: "Archive locally", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.goto("/directory");
  await page
    .getByLabel("Search published samples")
    .fill("Sample garden services");
  await expect(
    page.getByRole("heading", { name: "No matching entries" }),
  ).toBeVisible();
});

test("structured notices use pinning, simulated audiences and synthetic reference metadata", async ({
  page,
}) => {
  await draft(page, "publishing", "Sample pinned garden notice");
  await page
    .getByLabel("Proposed audience", { exact: true })
    .selectOption("Homeowners");
  await page.getByLabel("Pin preference").selectOption("Pinned");
  await save(page);
  await page
    .getByRole("button", { name: /Sample pinned garden notice/ })
    .click();
  await page
    .getByRole("button", {
      name: "Add sample qr content reference",
      exact: true,
    })
    .click();
  await page.keyboard.press("Escape");
  await publish(page, "publishing", "Sample pinned garden notice");
  await page.goto("/community");
  await expect(
    page.getByRole("heading", {
      name: "Sample pinned garden notice",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .locator("summary", { hasText: "Preview audience options" })
    .click();
  await page.getByLabel("Simulated notice audience").selectOption("Homeowners");
  await expect(
    page.getByRole("heading", {
      name: "Sample pinned garden notice",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Sample pinned garden notice/ }).click();
  await expect(page.locator("main")).toContainText("Pinned local notice");
  await expect(page.locator("main")).toContainText(
    "no hosted file or working QR",
  );
});

test("structured board metadata reaches the local document library without hosting a file", async ({
  page,
}) => {
  await draft(page, "board-records", "Sample board minutes version one");
  await save(page);
  await publish(page, "board-records", "Sample board minutes version one");
  await page.goto("/more/documents");
  await expect(
    page.getByRole("button", { name: /Sample board minutes version one/ }),
  ).toHaveCount(0);
  await page
    .locator("summary", { hasText: "Preview audience options" })
    .click();
  await page.getByLabel("Simulated document audience").selectOption("Board");
  await page
    .getByRole("button", { name: /Sample board minutes version one/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Demo version");
  await expect(page.getByRole("dialog")).toContainText("No real approval");
});

test("resident and office replies share a local thread with separate unread markers", async ({
  page,
}) => {
  await draft(page, "messages", "Sample resident follow up");
  await save(page);
  await page.goto("/services/inbox");
  await page
    .getByLabel("Synthetic local reply")
    .fill("Synthetic resident enquiry about a sample bill.");
  await page
    .getByRole("button", { name: "Save local reply", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No real message was delivered",
  );
  await page.goto("/office/inbox");
  await expect(page.getByText("1 local unread", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark local thread read" }).click();
  await expect(page.getByText("1 local unread", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Synthetic local reply")
    .fill("Synthetic office response with a sample explanation.");
  await page
    .getByRole("button", { name: "Save local reply", exact: true })
    .click();
  await page.goto("/services/inbox");
  await expect(page.getByText("1 local unread", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark local thread read" }).click();
  await page.reload();
  await expect(page.getByText("1 local unread", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator("main")).toContainText("Synthetic office response");
});

test("published sessions open a linked local participation draft without reserving a place", async ({
  page,
}) => {
  await scenario(page);
  await page.goto("/directory/learning");
  await page.getByRole("button", { name: "View sample details" }).click();
  await page
    .getByRole("link", { name: /Prepare local learning interest/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByLabel("Local training session reference", { exact: true }),
  ).toHaveValue("DEMO-INTEGRATION-workshops");
  await page.getByRole("button", { name: "Fill synthetic example" }).click();
  await save(page);
  await expect(page.locator("main")).toContainText("No official approval");
});

test("dispatch and gate simulations retain ordered histories without real authorization", async ({
  page,
}) => {
  await scenario(page);
  await page.goto("/driver/dispatch");
  await page
    .getByRole("button", { name: /Sample community ride requests/ })
    .click();
  await page
    .getByLabel("Synthetic driver", { exact: true })
    .selectOption("Demo driver B");
  await page
    .getByRole("button", { name: "Record sample dispatch pairing" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Demo driver B");
  for (let index = 0; index < 4; index++)
    await page.getByRole("button", { name: "Simulate next trip step" }).click();
  await expect(
    page.getByRole("button", { name: "Simulate next trip step" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.goto("/security/gate");
  await page
    .getByRole("button", { name: /Sample visitor lookup & walk-ins/ })
    .click();
  await page.getByRole("button", { name: "Simulate next gate event" }).click();
  await page.getByRole("button", { name: "Simulate next gate event" }).click();
  await expect(
    page.getByRole("button", { name: "Simulate next gate event" }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("no gate authorization");
});

test("source coverage maps all sixteen inventory families to local entry points", async ({
  page,
}) => {
  await page.goto("/coverage");
  await expect(page.locator("details[data-source-family]")).toHaveCount(16);
  await page.getByLabel("Search source coverage").fill("Elections");
  await expect(page.locator("details[data-source-family]")).toHaveCount(1);
  await page.getByText("Elections", { exact: true }).click();
  await expect(page.locator("main")).toContainText("secret ballots");
  await expect(
    page.getByRole("link", { name: /Candidate proposals/ }),
  ).toBeVisible();
});

test("the printable statement is visibly synthetic and keeps shell navigation out of print", async ({
  page,
}) => {
  await page.goto("/account/statement");
  await expect(
    page.getByRole("heading", { name: "SAMPLE STATEMENT — NOT OFFICIAL" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print sample / save as PDF" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "SAMPLE STATEMENT — NOT OFFICIAL" }),
  ).toBeVisible();
  const pdf = await page.pdf({ format: "A4" });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
});

for (const width of [360, 1280])
  for (const theme of ["light", "dark"]) {
    test(`connected routes ${width} ${theme}: populated accessibility and layout`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (value) => localStorage.setItem("bellefort-theme", value),
        theme,
      );
      await scenario(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const route of [
        "/directory",
        "/directory/market",
        "/directory/learning",
        "/directory/transport",
        "/directory/governance",
        "/office/review",
        "/services/inbox",
        "/office/inbox",
        "/office/registry",
        "/security/gate",
        "/driver/dispatch",
        "/account/statement",
        "/coverage",
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
          result.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => node.target),
          })),
          route,
        ).toEqual([]);
        const small = await page
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
        expect(small, route).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }

for (const width of [320, 390, 1280]) {
  test(`account and updates visual hierarchy at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/account");
    const statement = page.getByRole("link", {
      name: /Account statement View, print or save as PDF/,
    });
    await expect(statement).toBeVisible();
    const summary = page
      .locator("main")
      .getByText("OUTSTANDING BALANCE", { exact: true });
    const cardBox = await statement.boundingBox();
    const summaryBox = await summary.boundingBox();
    expect(cardBox!.y).toBeGreaterThan(summaryBox!.y);
    await statement.click();
    await expect(page).toHaveURL(/\/account\/statement$/);
    await expect(
      page.getByRole("heading", { name: "Account statement", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("[data-sample-statement] table")).toBeVisible();
    await expect(page.locator("[data-sample-statement] thead")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Print sample / save as PDF" }),
    ).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await page.goto("/community");
    await expect(
      page.getByRole("navigation", { name: "Community connections" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Community updates", exact: true }),
    ).toBeVisible();
    const firstArticle = page.locator("main article").first();
    await expect(firstArticle).toBeVisible();
    const articleBox = await firstArticle.boundingBox();
    expect(articleBox!.y).toBeLessThan(650);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });
}

test("directory categories filter entries and reset when opening another directory", async ({
  page,
}) => {
  await scenario(page);
  await page
    .getByRole("group", { name: "Directory section" })
    .getByRole("button", { name: "Transport", exact: true })
    .click();
  const cards = page.locator("main article");
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.first()).toContainText("View sample details");
  await page
    .getByLabel("Search published samples")
    .fill("no such listing anywhere");
  await expect(
    page.getByRole("heading", { name: "No matching entries" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page
      .getByRole("group", { name: "Directory section" })
      .getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Search published samples")).toHaveValue("");
  await page.getByRole("link", { name: "All features", exact: true }).click();
  await page.getByRole("link", { name: /^Marketplace/ }).click();
  await expect(page).toHaveURL(/\/directory\/market$/);
  await expect(
    page.getByRole("heading", { name: "Neighbourhood market", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Directory section" })
      .getByRole("button", { name: "Market", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
