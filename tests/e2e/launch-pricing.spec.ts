import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

for (const width of [320, 1440])
  test(`launch catalog at ${width}px`, async ({ page }) => {
    await page.route("**/consent.cookiebot.com/**", (route) => route.abort());
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
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const picker = page.getByLabel("Select pricing market");
    await expect(picker).toBeEnabled();
    await expect(picker.locator("option")).toHaveCount(19);
    for (const [market, care, plus] of [
      ["in", "₹3,000", "₹5,000"],
      ["us", "$49", "$79"],
      ["kh", "US$25", "US$39"],
      ["kw", "KWD 14.9", "KWD 23.9"],
      ["jp", "¥5,900", "¥9,500"],
    ]) {
      await picker.selectOption(market);
      await expect(page.locator(".sn-plan-price").nth(0)).toContainText(care);
      await expect(page.locator(".sn-plan-price").nth(1)).toContainText(plus);
    }
    await picker.selectOption("in");
    await expect(page.locator(".sn-plan").first()).toContainText(
      "15 calls shared by up to 2 people",
    );
    await expect(page.locator(".sn-plan").last()).toContainText(
      "30 calls shared by up to 5 people",
    );
    await expect(page.locator(".sn-plan").first()).toContainText("4 shared trial calls");
    await expect(page.locator(".sn-plan").last()).toContainText("7 shared trial calls");
    expect(await page.locator(".sn-plan").first().locator("li").allTextContents()).toEqual([
      "15 human listener calls per month",
      "Up to 2 people",
      "Companion conversations",
      "Family circle and shared updates",
      "Medication and personal reminders",
      "Private memories and scheduled messages",
      "ASSIST and calm audio",
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator("#plans")
      .screenshot({ path: resolve("../outputs", `launch-pricing-${width}.png`) });
    await page.getByRole("link", { name: "Try Care checkout", exact: true }).click();
    await expect(page).toHaveURL(/\/auth/);
    expect(new URL(page.url()).searchParams.get("redirect")).toContain("/checkout");
  });
