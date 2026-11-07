import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("resident request is confirmed locally, reviewed locally, and audited", async ({
  page,
}) => {
  await page.goto("/services/requests");
  await page.getByRole("button", { name: "New request" }).click();
  await page.getByLabel("A short title").fill("A streetlight needs attention");
  await page
    .getByLabel("Tell us a little more")
    .fill("The streetlight near the sample corner has stopped working.");
  await page.getByRole("button", { name: "Save preview request" }).click();
  await expect(page.getByRole("status")).toContainText(
    "saved in this browser tab",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /A streetlight needs attention/ }),
  ).toBeVisible();
  await page.goto("/admin/operations");
  await page
    .getByRole("button", { name: /A streetlight needs attention/ })
    .click();
  await page.getByRole("button", { name: "Resolve locally" }).click();
  await expect(page.getByRole("status")).toContainText("updated locally");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/admin/audit");
  await expect(page.getByText(/Resolved: local request/)).toBeVisible();
  await page.goto("/services/requests");
  await expect(
    page.getByRole("button", { name: /A streetlight needs attention/ }),
  ).toContainText("Resolved");
});
test("invalid requests explain the problem and focus the first field", async ({
  page,
}) => {
  await page.goto("/services/requests");
  await page.getByRole("button", { name: "New request" }).click();
  await page.getByRole("button", { name: "Save preview request" }).click();
  await expect(page.getByText("Use at least 5 characters.")).toBeVisible();
  await expect(page.getByLabel("A short title")).toBeFocused();
});
test("booking creates a local record and cancellation updates it", async ({
  page,
}) => {
  await page.goto("/services/bookings");
  await page.getByRole("button", { name: "Request a booking" }).click();
  await page.getByLabel("Preferred date").fill("2099-11-14");
  await page.getByLabel("Number of guests").fill("8");
  await page.getByRole("button", { name: "Save preview request" }).click();
  await expect(page.getByRole("status")).toContainText("Clubhouse");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: /Clubhouse 2099-11-14/ }).click();
  await page.getByRole("button", { name: "Cancel preview request" }).click();
  await expect(page.getByRole("status")).toContainText(
    "cancelled in this preview",
  );
});
test("visitor form never issues gate authority", async ({ page }) => {
  await page.goto("/services/visitors");
  await page.getByRole("button", { name: "Add a visitor" }).click();
  await page.getByLabel("Visitor’s full name").fill("Demo Visitor");
  await page.getByLabel("Date of visit").fill("2099-11-14");
  await page.getByRole("button", { name: "Save preview request" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "not an office confirmation",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Demo Visitor/ }),
  ).toBeVisible();
});
test("saved announcements and search work", async ({ page }) => {
  await page.goto("/community");
  await page
    .getByRole("button", { name: "Save Water line maintenance on Friday" })
    .click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Water line maintenance on Friday" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A little time for a cleaner neighbourhood",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All updates" }).click();
  await page
    .getByRole("textbox", { name: "Search community updates" })
    .fill("does not exist");
  await expect(
    page.getByRole("heading", { name: "No updates here yet." }),
  ).toBeVisible();
});
test("sample statements download and bills cannot be marked paid", async ({
  page,
}) => {
  await page.goto("/account");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download statement" }).click();
  expect((await download).suggestedFilename()).toBe(
    "SAMPLE-bellefort-statement.csv",
  );
  await expect(
    page.getByRole("button", { name: /mark.*paid|pay now/i }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Overdue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No overdue bills in this sample." }),
  ).toBeVisible();
});
test("not billed, loading, and failure remain distinct from zero", async ({
  page,
}) => {
  await page.goto("/?state=unbilled");
  await expect(page.getByText("Amount unavailable")).toBeVisible();
  await expect(page.getByText("1,850", { exact: true })).toHaveCount(0);
  await page.goto("/?state=loading");
  await expect(
    page.getByRole("status", { name: "Loading your community" }),
  ).toBeVisible();
  await page.goto("/?state=error");
  await expect(page.getByRole("alert")).toContainText("balance is unavailable");
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: /Hello, Alex/ }),
  ).toBeVisible();
});
test("malformed storage offers an actual reset route", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem("bellefort-preview-v1", "{bad"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await page.goto("/more/settings");
  await page.getByRole("button", { name: "Reset preview data" }).click();
  await page
    .getByRole("button", { name: "Reset sample data", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("restored");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hello, Alex/ }),
  ).toBeVisible();
});
test("profile editing persists and resets", async ({ page }) => {
  await page.goto("/more/profile");
  await page.getByLabel("Display name").fill("Demo Neighbour");
  await page.getByRole("button", { name: "Save sample profile" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hello, Demo/ }),
  ).toBeVisible();
});
test("reports reconcile and filter households", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("₱11,100.00", { exact: true })).toBeVisible();
  await expect(
    page.getByText("₱4,600.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("₱6,500.00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fully paid", exact: true }).click();
  await expect(page.getByRole("button", { name: /Demo A-/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Part paid", exact: true }).click();
  await expect(page.getByRole("button", { name: /Demo A-/ })).toHaveCount(1);
});
test("native dialog keeps focus contained and closes with Escape", async ({
  page,
}) => {
  await page.goto("/services/requests");
  await page.getByRole("button", { name: "New request" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  // Opening focuses the dialog itself, so the title is announced before any
  // control. It must never open on the dismiss control: that aimed the first
  // keypress at Close and made screen readers lead with "Close dialog".
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).not.toBeFocused();
  // Tabbing well past the control count stays inside the dialog.
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New request" })).toBeFocused();
});
for (const width of [360, 1280])
  for (const theme of ["light", "dark"]) {
    test(`${width}px ${theme}: routes, accessibility, readable text and no overflow`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("bellefort-theme", theme),
        theme,
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      for (const path of [
        "/",
        "/account",
        "/account/payments",
        "/community",
        "/services",
        "/services/requests",
        "/services/bookings",
        "/services/visitors",
        "/more",
        "/more/profile",
        "/more/settings",
        "/more/elections",
        "/more/documents",
        "/more/vehicles",
        "/more/permits",
        "/more/marketplace",
        "/more/transport",
        "/more/training",
        "/more/help",
        "/admin",
        "/admin/households",
        "/admin/access",
        "/admin/operations",
        "/admin/audit",
      ]) {
        await page.goto(path);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator(".skeleton-layout")).toHaveCount(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        expect(overflow, `${path}: horizontal overflow`).toBe(false);
        const smallText = await page
          .locator("main :is(p,span,small,label,a,button,h1,h2,h3)")
          .evaluateAll((elements) =>
            elements
              .filter(
                (e) =>
                  e.getBoundingClientRect().height > 0 &&
                  Number.parseFloat(getComputedStyle(e).fontSize) < 14,
              )
              .map((e) => e.textContent?.slice(0, 60)),
          );
        expect(smallText, `${path}: small text`).toEqual([]);
        const smallTargets = await page
          .locator("a,button,input,select,textarea,summary")
          .evaluateAll((elements) =>
            elements
              .filter((e) => {
                const rect = e.getBoundingClientRect();
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.top >= 0 &&
                  (rect.width < 48 || rect.height < 48)
                );
              })
              .map((e) => ({
                label:
                  e.textContent?.slice(0, 40) || e.getAttribute("aria-label"),
                width: e.getBoundingClientRect().width,
                height: e.getBoundingClientRect().height,
              })),
          );
        expect(smallTargets, `${path}: targets below 48px`).toEqual([]);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          `${path}: axe violations`,
        ).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }

test("failed local storage never produces a success confirmation", async ({
  page,
}) => {
  await page.goto("/services/requests");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "New request" }).click();
  await page.getByLabel("A short title").fill("A sample maintenance concern");
  await page
    .getByLabel("Tell us a little more")
    .fill("Please inspect the broken sample light near the corner.");
  await page.getByRole("button", { name: "Save preview request" }).click();
  await expect(page.getByRole("alert")).toContainText("could not save");
  await expect(page.getByText("Saved in your preview.")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save preview request" }),
  ).toBeEnabled();
});

test("request dialog has no automated accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/services/requests");
  await page.getByRole("button", { name: "New request" }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("app home hides balances and restores them on request", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("₱1,850.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide sample balance" }).click();
  await expect(page.getByText("₱1,850.00", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show sample balance" }).click();
  await expect(page.getByText("₱1,850.00", { exact: true })).toBeVisible();
});

test("service shortcuts open their own screens and payment history only shows recorded bills", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Payments", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/payments$/);
  await expect(
    page.getByRole("heading", { name: "Your payment history" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /September 2026|October 2026/ }),
  ).toHaveCount(2);
  await expect(page.getByRole("button", { name: /November 2026/ })).toHaveCount(
    0,
  );
  for (const [label, heading] of [
    ["Vehicles", "Vehicles & stickers"],
    ["Permits", "Permits & clearances"],
  ]) {
    await page.goto("/");
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});

test("payment options explain the missing provider without changing a bill", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Payment options" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No money will be collected here.",
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Back to my account" }).click();
  await expect(
    page.getByRole("button", { name: /November 2026/ }),
  ).toContainText("Due");
});

test("QA follow-up: financial visuals, module pages and accessible headings", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const { verifyQaFollowup } = await import("./qa-review");
  await verifyQaFollowup(page, info);
});

test("legacy sample request statuses normalize without changing other review workflows", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "bellefort-preview-v1",
      JSON.stringify({
        version: 1,
        profile: { name: "Synthetic Neighbour", phone: "" },
        saved: [],
        audit: [],
        records: [
          {
            id: "LEGACY-REVIEW",
            kind: "request",
            title: "Synthetic old review",
            detail: "Invented request",
            status: "In review",
            createdAt: "2026-11-01T00:00:00Z",
          },
          {
            id: "LEGACY-SAVED",
            kind: "request",
            title: "Synthetic old draft",
            detail: "Invented request",
            status: "Saved locally",
            createdAt: "2026-11-01T00:00:00Z",
          },
          {
            id: "BOOK-UNCHANGED",
            kind: "booking",
            title: "Synthetic booking",
            detail: "Invented booking",
            status: "Pending review",
            createdAt: "2026-11-01T00:00:00Z",
          },
        ],
      }),
    ),
  );
  await page.goto("/services/requests");
  await expect(
    page.getByRole("button", { name: /Synthetic old review/ }),
  ).toContainText("In progress");
  await expect(
    page.getByRole("button", { name: /Synthetic old draft/ }),
  ).toContainText("Open");
  await page.goto("/services/bookings");
  await expect(
    page.getByRole("button", { name: /Synthetic booking/ }),
  ).toContainText("Pending review");
});
