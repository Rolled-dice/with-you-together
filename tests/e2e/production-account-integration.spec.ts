import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const email = process.env.SN_QA_ACCOUNT_EMAIL;
const env = loadEnv("development", process.cwd(), "");
const url = env.SUPABASE_URL;
const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const storageKey = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";

test.skip(!email || !url || !publishableKey || !serviceKey, "Configure a disposable QA account and Supabase credentials");

async function testSession() {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (serviceKey.startsWith("sb_secret_") && headers.get("authorization") === `Bearer ${serviceKey}`) {
          headers.delete("authorization");
        }
        headers.set("apikey", serviceKey);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: email! });
  if (link.error) throw new Error(link.error.message);
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (verified.error || !verified.data.session) throw new Error("QA account sign-in failed");
  return verified.data.session;
}

for (const width of [390, 1440]) {
  test(`paid account and member pages persist at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const session = await testSession();
    await page.goto("/robots.txt");
    await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: storageKey,
      session,
    });

    await page.goto("/settings");
    await expect(page.getByText(/Active subscription, Care Plus/)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText(/Active subscription, Care Plus/)).toBeVisible({ timeout: 30_000 });

    for (const path of ["/listeners", "/family", "/reminders", "/send-later", "/companion", "/insights", "/safety"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Sign out", exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("This page didn't load", { exact: true })).toHaveCount(0);
    }
  });
}
