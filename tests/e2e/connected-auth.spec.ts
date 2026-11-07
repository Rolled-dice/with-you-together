import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const url = env.SUPABASE_URL;
const publicKey = env.SUPABASE_PUBLISHABLE_KEY;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;
const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (secret.startsWith("sb_secret_") && headers.get("authorization") === `Bearer ${secret}`)
        headers.delete("authorization");
      headers.set("apikey", secret);
      return fetch(input, { ...init, headers });
    },
  },
});
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
for (const [email, destination, heading] of [
  ["member@someonenear.test", "/dashboard", /A little closer|Good |Your|Meera|care/i],
  ["admin@someonenear.test", "/admin/calls", /Call operations/i],
  [
    "listener@someonenear.test",
    "/agent/console",
    /Agent console|Listener console|My calls|console/i,
  ],
] as const) {
  test(`confirmed ${email.split("@")[0]} account reaches its authorized area`, async ({ page }) => {
    test.setTimeout(120_000);
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (generated.error)
      throw new Error(`Test account link generation failed: ${generated.error.message}`);
    const client = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await client.auth.verifyOtp({
      type: "magiclink",
      token_hash: generated.data.properties.hashed_token,
    });
    if (verified.error || !verified.data.session)
      throw new Error("Unable to authenticate the designated test account");
    await page.goto("/robots.txt");
    await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: storageKey,
      session: verified.data.session,
    });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(new RegExp(`${destination}$`), { timeout: 45_000 });
    await expect(page.getByRole("button", { name: "Sign out", exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading").filter({ hasText: heading }).first()).toBeVisible();
    if (email.startsWith("member")) {
      for (let refresh = 0; refresh < 3; refresh++) {
        await page.reload();
        await expect(
          page.getByRole("button", { name: "Sign out", exact: true }).first(),
        ).toBeVisible({ timeout: 30_000 });
      }
      for (const path of [
        "/family",
        "/reminders",
        "/send-later",
        "/companion",
        "/insights",
        "/safety",
        "/settings",
      ]) {
        await page.goto(path);
        await expect(
          page.getByRole("button", { name: "Sign out", exact: true }).first(),
        ).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.getByText("This page didn't load", { exact: true })).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
      }
      await page.goto("/admin/calls");
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
      await page.goto("/checkout?plan=care&market=kw");
      await expect(
        page.getByRole("button", { name: "Continue to Dodo test checkout" }),
      ).toBeDisabled();
      await page.goto("/checkout?plan=care&market=in");
      await expect(page.getByRole("heading", { name: /Care.*3,000/ })).toBeVisible();
      await page.getByRole("button", { name: "Continue to Dodo test checkout" }).click();
      await expect(page).toHaveURL(/^https:\/\/test\.checkout\.dodopayments\.com\//, {
        timeout: 45_000,
      });
      await expect(
        page.getByRole("heading", { name: /SomeoneNear Care.*India/ }).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page
          .locator("p:visible")
          .filter({ hasText: /2,100|2100/ })
          .first(),
      ).toBeVisible();
      await page.screenshot({ path: "../outputs/dodo-care-india-test-checkout.png" });
      await page.goto("/dashboard");
    }
    await page.getByRole("button", { name: "Sign out", exact: true }).first().click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 30_000 });
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  });
}
test("password recovery and configured OAuth options render", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reset your password", exact: true }),
  ).toBeVisible();
  await page.route("**/auth/v1/recover**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.getByLabel("Email", { exact: true }).fill("member@someonenear.test");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "If an account exists" })).toBeVisible();
  await page.getByRole("button", { name: "Back to sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/auth?mode=recovery");
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
});
