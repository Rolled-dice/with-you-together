import { describe, expect, it } from "vitest";
import { mapDodoStatus, verifyDodoWebhook } from "./dodo.server";

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signStandardWebhook(
  secret: string,
  webhookId: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const keyBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${webhookId}.${timestamp}.${body}`)),
  );
  return `v1,${bytesToBase64(signature)}`;
}

function testSecret(): string {
  return `whsec_${bytesToBase64(Uint8Array.from({ length: 32 }, (_, index) => index + 1))}`;
}

describe("verifyDodoWebhook", () => {
  const body = JSON.stringify({
    type: "subscription.active",
    data: { payload_type: "Subscription" },
  });
  const webhookId = "msg_dodo_test_123";

  it("accepts a correctly signed raw body", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signStandardWebhook(testSecret(), webhookId, timestamp, body);
    const headers = new Headers({
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });

    await expect(verifyDodoWebhook(body, headers, testSecret())).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signStandardWebhook(testSecret(), webhookId, timestamp, body);
    const headers = new Headers({
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });

    await expect(
      verifyDodoWebhook(body.replace("active", "failed"), headers, testSecret()),
    ).resolves.toBe(false);
  });

  it("rejects a timestamp more than five minutes old", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 10 * 60);
    const signature = await signStandardWebhook(testSecret(), webhookId, timestamp, body);
    const headers = new Headers({
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });

    await expect(verifyDodoWebhook(body, headers, testSecret())).resolves.toBe(false);
  });
});

describe("mapDodoStatus", () => {
  it("maps Dodo lifecycle states to the existing entitlement vocabulary", () => {
    expect(mapDodoStatus("active")).toBe("active");
    expect(mapDodoStatus("on_hold")).toBe("on_hold");
    expect(mapDodoStatus("paused")).toBe("paused");
    expect(mapDodoStatus("failed")).toBe("incomplete_expired");
    expect(mapDodoStatus("cancelled")).toBe("canceled");
    expect(mapDodoStatus("expired")).toBe("expired");
    expect(mapDodoStatus("trialing")).toBe("trialing");
    expect(mapDodoStatus("pending")).toBe("incomplete");
    expect(mapDodoStatus("created")).toBe("incomplete");
  });
});
