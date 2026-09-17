import { describe, it, expect, beforeEach } from "vitest";
import { verifyRazorpayWebhook, mapRazorpayStatus } from "./razorpay.server";

// Compute an expected Razorpay-style signature (HMAC-SHA256 hex over raw body)
// the same way Razorpay does, so we can assert our verifier accepts it.
async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("verifyRazorpayWebhook", () => {
  const secret = "whsec_test_razorpay_123";
  const body = JSON.stringify({ event: "subscription.charged", payload: { foo: "bar" } });

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    delete process.env.RAZORPAY_TEST_WEBHOOK_SECRET;
  });

  it("accepts a correctly signed raw body", async () => {
    const sig = await sign(body, secret);
    await expect(verifyRazorpayWebhook(body, sig, "sandbox")).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const sig = await sign(body, secret);
    const tampered = body.replace("bar", "evil");
    await expect(verifyRazorpayWebhook(tampered, sig, "sandbox")).resolves.toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const sig = await sign(body, "wrong_secret");
    await expect(verifyRazorpayWebhook(body, sig, "sandbox")).resolves.toBe(false);
  });

  it("rejects a missing signature", async () => {
    await expect(verifyRazorpayWebhook(body, null, "sandbox")).resolves.toBe(false);
  });

  it("prefers the test-specific secret when set", async () => {
    process.env.RAZORPAY_TEST_WEBHOOK_SECRET = "test_specific_secret";
    const sig = await sign(body, "test_specific_secret");
    await expect(verifyRazorpayWebhook(body, sig, "sandbox")).resolves.toBe(true);
  });
});

describe("mapRazorpayStatus", () => {
  it("maps active/authenticated to active", () => {
    expect(mapRazorpayStatus("active")).toBe("active");
    expect(mapRazorpayStatus("authenticated")).toBe("active");
  });

  it("maps pending/halted to past_due", () => {
    expect(mapRazorpayStatus("pending")).toBe("past_due");
    expect(mapRazorpayStatus("halted")).toBe("past_due");
  });

  it("maps cancelled/completed/expired to canceled", () => {
    expect(mapRazorpayStatus("cancelled")).toBe("canceled");
    expect(mapRazorpayStatus("completed")).toBe("canceled");
    expect(mapRazorpayStatus("expired")).toBe("canceled");
  });

  it("maps created to incomplete and passes through unknown", () => {
    expect(mapRazorpayStatus("created")).toBe("incomplete");
    expect(mapRazorpayStatus("paused")).toBe("paused");
    expect(mapRazorpayStatus("weird")).toBe("weird");
  });
});
