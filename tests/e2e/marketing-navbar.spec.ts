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

test("desktop previews, pink selection, section links, and signup", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(nav).toBeVisible();
  await expect(page.locator(".sn-menu-toggle")).toBeEnabled();
  await expect(nav.locator("a:not(.sn-mobile-auth-link)")).toHaveCount(5);
  expect(
    await nav
      .locator("a:not(.sn-mobile-auth-link)")
      .evaluateAll((links) => links.every((link) => link.getAttribute("href")?.startsWith("/#"))),
  ).toBe(true);
  const plans = nav.getByRole("link", { name: "Plans", exact: true });
  await plans.hover();
  const preview = page.locator("#sn-navigation-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("15 shared calls for 2 people");
  await expect(plans).toHaveCSS("color", "rgb(181, 22, 94)");
  await page.screenshot({ path: resolve("../outputs/navbar-desktop-preview.png") });
  await plans.focus();
  await page.keyboard.press("Escape");
  await expect(preview).not.toBeVisible();
  await expect(plans).toBeFocused();
  await nav.getByRole("link", { name: "What’s included", exact: true }).focus();
  await expect(preview).toContainText("Six ways");
  await preview.getByRole("link", { name: "Explore the services" }).click();
  await expect(page).toHaveURL(/#service-demos$/);
  await expect(page.locator(".sn-marketing-header")).toHaveClass(/is-scrolled/);
  await expect(preview).not.toBeVisible();
  await nav.getByRole("link", { name: "Calm space", exact: true }).click();
  await expect(page.locator("#service-demo-panel")).toHaveAccessibleName(
    "A quiet moment demonstration",
  );
  await expect(page.locator("#calm-space")).toHaveCSS("border-top-color", "rgb(225, 29, 116)");
  expect(
    await page.locator("h1").evaluate((el) => getComputedStyle(el, "::selection").backgroundColor),
  ).toBe("rgb(225, 29, 116)");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: resolve("../outputs/navbar-desktop.png") });
  await page.getByRole("link", { name: "Try for free", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=signup/);
  await expect(page.getByRole("tab", { name: "Create account", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
});

for (const width of [320, 390, 768, 1150]) {
  test(`mobile menu closes correctly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
    const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
    await expect(nav).not.toBeVisible();
    await toggle.click();
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Plans", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(nav).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.screenshot({ path: resolve(`../outputs/navbar-mobile-${width}.png`) });
    await page.mouse.click(width - 8, 850);
    await expect(nav).not.toBeVisible();
    await toggle.click();
    await nav.getByRole("link", { name: "Calm space", exact: true }).click();
    await expect(nav).not.toBeVisible();
    await expect(page.locator("#service-demo-panel")).toHaveAccessibleName(
      "A quiet moment demonstration",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator(".sn-pink-brush path").first()).toHaveCSS("animation-name", "none");
    await toggle.click();
    await nav.getByRole("link", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
}
