import { test, expect, type Page } from "@playwright/test";

/**
 * SomeoneNear smoke tests.
 *
 * Requires two env vars for authenticated flows:
 *   TEST_EMAIL     — email of an existing test account
 *   TEST_PASSWORD  — password for that account
 *
 * Skips auth-gated tests gracefully if credentials are missing so the
 * public smoke checks still run.
 */

const EMAIL = process.env.TEST_EMAIL ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";
const hasCreds = Boolean(EMAIL && PASSWORD);

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: /sign in/i }).click().catch(() => {});
  await page.locator("#signin-email").fill(EMAIL);
  await page.locator("#signin-password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe("public smoke", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SomeoneNear/i);
  });

  test("auth page renders sign-in form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("#signin-email")).toBeVisible();
    await expect(page.locator("#signin-password")).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("protected route redirects to /auth when signed out", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth/, { timeout: 15_000 });
  });
});

test.describe("authenticated smoke", () => {
  test.skip(!hasCreds, "Set TEST_EMAIL and TEST_PASSWORD to run authenticated smoke tests");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("dashboard loads after sign-in", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("companion messaging: can open a thread and send a message", async ({ page }) => {
    await page.goto("/companion");
    // Enter or create a thread — many companion landings auto-redirect
    // to /companion/<threadId>. Wait for the composer input to appear.
    const composer = page.getByPlaceholder(/what's on your mind|limit reached/i);
    await composer.waitFor({ timeout: 20_000 });

    // If we're still on the index, click the primary CTA to start a thread.
    if (!/\/companion\/[^/]+/.test(page.url())) {
      const startBtn = page.getByRole("button", { name: /start|new|chat/i }).first();
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click();
        await composer.waitFor({ timeout: 20_000 });
      }
    }

    await composer.fill("Smoke test message — please ignore.");
    // Submit via Enter (composer is a textarea in this app).
    await composer.press("Enter");

    // The user's own message should appear in the transcript.
    await expect(
      page.getByText("Smoke test message — please ignore.").first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("checkout screen loads", async ({ page }) => {
    await page.goto("/checkout?plan=care&currency=usd");
    // Either the embedded Stripe iframe mounts, or a friendly error surfaces —
    // both prove the route rendered without crashing.
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/checkout|secure|cancel anytime/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15_000 });
  });

  test("reminders page shows the Google Calendar connect card", async ({ page }) => {
    await page.goto("/reminders");
    await expect(page.getByText("Google Calendar").first()).toBeVisible({ timeout: 15_000 });
  });

  test("admin feedback screen renders (either inbox or admins-only gate)", async ({ page }) => {
    await page.goto("/admin/feedback");
    await expect(
      page.getByText(/product review inbox|admins only/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
