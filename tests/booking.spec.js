import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("keyboard users can select a time and complete the details form", async ({
  page,
}) => {
  await page.goto("/");
  const slot = page.locator(".slots button:not([disabled])").first();
  await slot.focus();
  await page.keyboard.press("Enter");
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Let’s make it official." }),
  ).toBeFocused();
  await page.keyboard.press("Tab"); // Change time.
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Parent’s name")).toBeFocused();
  await page.keyboard.type("Keyboard Parent");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.keyboard.type("keyboard@example.com");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Confirm my free trial" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "You’re all booked!" }),
  ).toBeFocused();
});

test("an explicit new booking uses a fresh request key", async ({ page }) => {
  const keys = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/bookings"))
      keys.push(request.headers()["idempotency-key"]);
  });
  await page.goto("/");
  for (let i = 0; i < 2; i++) {
    await page.locator(".slots button:not([disabled])").first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Parent’s name").fill("Repeat Parent");
    await page.getByLabel("Email address").fill("repeat@example.com");
    await page.getByRole("button", { name: "Confirm my free trial" }).click();
    await expect(
      page.getByRole("heading", { name: "You’re all booked!" }),
    ).toBeVisible();
    if (i === 0)
      await page.getByRole("button", { name: "Book another trial" }).click();
  }
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
});

test("parent completes a booking and opens the demo class", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#timezone").selectOption("America/New_York");
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await page.locator(".slots button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Parent’s name").fill("Alex Taylor");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page.getByRole("button", { name: "Confirm my free trial" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all booked!" }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-times")).toContainText(
    "America/New_York",
  );
  await expect(page.locator(".confirmation-times")).toContainText(
    "Asia/Kolkata",
  );
  await page.getByText("View parent & mentor email previews").click();
  await expect(page.locator(".email-preview")).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You’re all booked!" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open demo classroom" }).click();
  await expect(
    page.getByText("This is a demo classroom link.", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("booking flow has no automated WCAG AA accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".slots button").first()).toBeVisible();
  async function audit() {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
  await audit();
  await page.locator(".slots button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await audit();
  await page.getByLabel("Parent’s name").fill("Accessible Parent");
  await page.getByLabel("Email address").fill("accessible@example.com");
  await page.getByRole("button", { name: "Confirm my free trial" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all booked!" }),
  ).toBeVisible();
  await audit();
});
test("stale availability conflicts let the parent choose another slot without losing details", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".slots button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Parent’s name").fill("Sam Parent");
  await page.getByLabel("Email address").fill("sam@example.com");
  await page.route(
    "**/api/bookings",
    (route) =>
      route.fulfill({
        status: 409,
        json: {
          error: "NO_MENTORS_AVAILABLE",
          message:
            "This time has just filled up. Please choose another time or date.",
        },
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Confirm my free trial" }).click();
  await expect(page.getByRole("alert")).toContainText("filled up");
  await page.getByRole("button", { name: "Choose another time" }).click();
  await page.locator(".slots button:not([disabled])").nth(1).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Parent’s name")).toHaveValue("Sam Parent");
  await page.getByRole("button", { name: "Confirm my free trial" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all booked!" }),
  ).toBeVisible();
});
test("lost booking responses can be retried without creating a second booking", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".slots button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Parent’s name").fill("Retry Parent");
  await page.getByLabel("Email address").fill("retry@example.com");
  let firstId, firstKey;
  await page.route(
    "**/api/bookings",
    async (route) => {
      firstKey = route.request().headers()["idempotency-key"];
      const response = await route.fetch();
      firstId = (await response.json()).id;
      await route.abort();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Confirm my free trial" }).click();
  await expect(page.getByRole("alert")).toContainText("Connection lost");
  const request = page.waitForRequest("**/api/bookings");
  await page.getByRole("button", { name: "Confirm my free trial" }).click();
  expect((await request).headers()["idempotency-key"]).toBe(firstKey);
  await expect(page.locator(".booking-reference")).toContainText(firstId);
});
test("mobile layout has no overflow and unavailable slots show a helpful state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/slots?**", (route) =>
    route.fulfill({ json: { slots: [] } }),
  );
  await page.goto("/");
  await expect(
    page.getByText("No times available on this day.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("desktop view and failed availability request can recover", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.route(
    "**/api/slots?**",
    (route) => route.fulfill({ status: 500, json: { message: "offline" } }),
    { times: 1 },
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".slots button").first()).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});
