// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./family.server", () => ({ sendFamilySms: vi.fn() }));
import { sendFamilySms } from "./family.server";
import { handleSmsHook, verifySmsHook } from "./auth-sms-hook.server";

const secret = btoa("someone-near-test-key-32-characters");
const body = JSON.stringify({ user: { phone: "919876543210" }, sms: { otp: "123456" } });
async function signed(bodyText = body, at = Math.floor(Date.now() / 1000)) {
  const id = "test-hook-id";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(atob(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${at}.${bodyText}`)),
  );
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(at),
    "webhook-signature": `v1,${btoa(String.fromCharCode(...bytes))}`,
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Supabase SMS hook", () => {
  it("verifies the raw payload using the dashboard's prefixed signing secret", async () => {
    expect(await verifySmsHook(body, await signed(), `v1,whsec_${secret}`)).toBe(true);
  });
  it("rejects tampering, a different secret, missing headers, and stale deliveries", async () => {
    expect(await verifySmsHook(`${body} `, await signed(), secret)).toBe(false);
    expect(await verifySmsHook(body, await signed(), btoa("different-secret"))).toBe(false);
    expect(await verifySmsHook(body, new Headers(), secret)).toBe(false);
    expect(
      await verifySmsHook(body, await signed(body, Math.floor(Date.now() / 1000) - 301), secret),
    ).toBe(false);
  });
  it("accepts signature rotation when one supplied signature is valid", async () => {
    const headers = await signed();
    headers.set("webhook-signature", `v1,${btoa("invalid")} ${headers.get("webhook-signature")}`);
    expect(await verifySmsHook(body, headers, secret)).toBe(true);
  });
  it("does not send a code while phone sign-in is disabled", async () => {
    vi.stubEnv("FAMILY_PHONE_LOGIN_ENABLED", "false");
    vi.stubEnv("SUPABASE_SEND_SMS_HOOK_SECRET", secret);
    const response = await handleSmsHook(
      new Request("https://example.test/api/public/auth-sms", {
        method: "POST",
        body,
        headers: await signed(),
      }),
    );
    expect(response.status).toBe(503);
    expect(sendFamilySms).not.toHaveBeenCalled();
  });
  it("rejects unsigned requests before contacting the messaging provider", async () => {
    vi.stubEnv("FAMILY_PHONE_LOGIN_ENABLED", "true");
    vi.stubEnv("SUPABASE_SEND_SMS_HOOK_SECRET", secret);
    const response = await handleSmsHook(
      new Request("https://example.test/api/public/auth-sms", { method: "POST", body }),
    );
    expect(response.status).toBe(401);
    expect(sendFamilySms).not.toHaveBeenCalled();
  });
  it("delivers a verified code only to its validated international phone number", async () => {
    vi.stubEnv("FAMILY_PHONE_LOGIN_ENABLED", "true");
    vi.stubEnv("SUPABASE_SEND_SMS_HOOK_SECRET", secret);
    const response = await handleSmsHook(
      new Request("https://example.test/api/public/auth-sms", {
        method: "POST",
        body,
        headers: await signed(),
      }),
    );
    expect(response.status).toBe(200);
    expect(sendFamilySms).toHaveBeenCalledWith("+919876543210", expect.stringContaining("123456"));
  });
});
