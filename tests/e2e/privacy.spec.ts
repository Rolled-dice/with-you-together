import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

for (const width of [320, 1440]) {
  test(`privacy choices and legal pages at ${width}px`, async ({ page }) => {
    await page.route("**/consent.cookiebot.com/**", (route) => route.abort());
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Privacy and cookie choices" });
    await expect(banner).toBeVisible();
    await page.screenshot({ path: resolve("../outputs", `privacy-banner-${width}.png`) });
    await banner.getByRole("button", { name: "Essential only", exact: true }).click();
    await expect(banner).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Manage Privacy Choices" })).toBeEnabled();
    await expect(banner).not.toBeVisible();
    await page.getByRole("button", { name: "Manage Privacy Choices" }).click();
    const dialog = page.getByRole("dialog", { name: "Privacy & cookie preferences" });
    await expect(dialog.getByLabel("Allow preferences")).not.toBeChecked();
    await dialog.getByLabel("Allow preferences").check();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Manage Privacy Choices" }).click();
    await expect(dialog.getByLabel("Allow preferences")).not.toBeChecked();
    await dialog.getByLabel("Allow preferences").check();
    await page.screenshot({ path: resolve("../outputs", `privacy-preferences-${width}.png`) });
    await dialog.getByRole("button", { name: "Save preferences", exact: true }).click();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sn_privacy_choice_v1")!),
    );
    expect(stored).toMatchObject({ preferences: true, statistics: false, marketing: false });
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Privacy and legal" })
      .getByRole("link", { name: "Cookie policy", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Cookie Policy", exact: true })).toBeVisible();
    await expect(page.getByText("What this browser remembers", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("branded controls submit the selected categories to Cookiebot", async ({ page }) => {
  await page.route("**/consent.cookiebot.com/**", (route) => route.abort());
  await page.addInitScript(() => {
    const calls: boolean[][] = [];
    Object.assign(window, {
      consentTestCalls: calls,
      Cookiebot: {
        hasResponse: false,
        consent: { preferences: false, statistics: false, marketing: false },
        hide() {},
        renew() {},
        submitCustomConsent(preferences: boolean, statistics: boolean, marketing: boolean) {
          calls.push([preferences, statistics, marketing]);
          this.hasResponse = true;
          this.consent = { preferences, statistics, marketing };
          window.dispatchEvent(new Event("CookiebotOnAccept"));
        },
      },
    });
  });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Privacy and cookie choices" });
  await banner.getByRole("button", { name: "Accept all", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { consentTestCalls: boolean[][] }).consentTestCalls,
    ),
  ).toEqual([[true, true, true]]);
  await page.getByRole("button", { name: "Manage Privacy Choices" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Essential only", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { consentTestCalls: boolean[][] }).consentTestCalls,
    ),
  ).toEqual([
    [true, true, true],
    [false, false, false],
  ]);
});
