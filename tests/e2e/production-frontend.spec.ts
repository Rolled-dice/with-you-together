import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "sn_privacy_choice_v1",
      JSON.stringify({
        preferences: false,
        statistics: false,
        marketing: false,
        savedAt: Date.now(),
      }),
    ),
  );
});

for (const width of [320, 390, 768, 1440]) {
  test(`prototype public journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Be there for your parents/ })).toBeVisible();
    await expect(page.locator(".sn-service-card")).toHaveCount(6);
    await expect(
      page.getByRole("region", { name: "Interactive sample family globe" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start globe rotation" })).toBeVisible();
    await page.getByRole("button", { name: "Mum", exact: true }).click();
    await expect(page.locator(".sn-globe-note")).toContainText("balcony");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.locator(".sn-service-card").filter({ hasText: "Gentle reminders" }).click();
    await expect(page.locator("#service-demo-panel")).toHaveAccessibleName(
      "Gentle reminders demonstration",
    );
    await page.getByRole("button", { name: "Try a reminder", exact: true }).click();
    await expect(page.locator(".sn-demo-result")).toContainText("Morning reminder");
    await page.getByRole("button", { name: "Reset demo", exact: true }).click();
    await expect(page.locator(".sn-demo-result")).toContainText("Tap the demo button");
    await page.getByLabel("Select pricing market").selectOption("us");
    await expect(page.locator(".sn-plan-price").first()).toContainText("$49");
    await page.getByLabel("Select pricing market").selectOption("in");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 1440)
      await page.screenshot({
        path: resolve(process.env.SN_SCREENSHOTS ?? "../outputs", "integrated-home-preview.png"),
      });
    await page.screenshot({
      path: resolve(
        process.env.SN_SCREENSHOTS ?? "../outputs",
        `integrated-prototype-${width}.png`,
      ),
      fullPage: true,
    });
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(navigation.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
    await expect(navigation.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
    await page
      .locator("footer")
      .getByRole("link", { name: "SomeoneNear guides", exact: true })
      .click();
    await expect(page).toHaveURL(/\/docs$/);
    await expect(
      page.getByRole("heading", { name: "SomeoneNear guides", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("protected deep links still recover to sign-in", async ({ page }) => {
  for (const route of [
    "/dashboard",
    "/family",
    "/reminders",
    "/send-later",
    "/companion",
    "/insights",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("heading", { name: "Welcome", exact: true })).toBeVisible();
  }
});
