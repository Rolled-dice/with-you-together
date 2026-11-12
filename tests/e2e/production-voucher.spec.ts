import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const email = process.env.SN_QA_ACCOUNT_EMAIL;
const voucher = process.env.SN_QA_VOUCHER;
const env = loadEnv("development", process.cwd(), "");
const url = env.SUPABASE_URL;
const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const storageKey = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";

test.skip(!email || !voucher || !url || !publishableKey || !serviceKey, "Configure a free QA account and voucher");

test("live voucher opens Dodo checkout without submitting payment", async ({ page }) => {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: email! });
  if (link.error) throw new Error(link.error.message);
  const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  if (verified.error || !verified.data.session) throw new Error("QA account sign-in failed");

  await page.goto("/robots.txt");
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem("sn_privacy_choice_v1", JSON.stringify({ preferences: false, statistics: false, marketing: false, savedAt: Date.now() }));
  }, {
    key: storageKey,
    session: verified.data.session,
  });
  await page.goto("/checkout?plan=care&market=in");
  const acceptCookies = page.getByRole("button", { name: "Accept all" });
  if (await acceptCookies.isVisible()) await acceptCookies.click();
  await page.getByLabel("Voucher code (optional)").fill(voucher!);
  await page.getByRole("button", { name: "Continue to Dodo live checkout" }).click();
  await expect(page).toHaveURL(/checkout\.dodopayments\.com\//, { timeout: 30_000 });
});
