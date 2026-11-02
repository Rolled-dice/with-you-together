import { test, expect } from "@playwright/test";
for (const width of [320, 390, 768, 1440]) {
  test(`public journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Distance changes/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole("link", { name: /Explore$/ })).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: /theme|dark mode|check.in|call me/i }),
    ).toHaveCount(0);
    await page.screenshot({ path: `/tmp/sn-production-${width}.png`, fullPage: true });
    if (width < 1024) await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Docs", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "SomeoneNear guides", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("protected deep link recovers to auth without exposing private content", async ({ page }) => {
  await page.goto("/send-later");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("button", { name: "Schedule message" })).toHaveCount(0);
});
