// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: vi.fn() } }));
import { PushSubscriptionInput, pushConfig, validPushEndpoint } from "./family-delivery.server";

afterEach(() => vi.unstubAllEnvs());
describe("private web-push configuration", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/token",
    "https://wns2.notify.windows.com/token",
  ])("accepts a supported HTTPS push endpoint: %s", (url) => {
    expect(validPushEndpoint(url)).toBe(true);
  });
  it.each([
    "http://fcm.googleapis.com/token",
    "https://fcm.googleapis.com.attacker.test/token",
    "https://127.0.0.1/token",
    "https://localhost/token",
    "https://example.test/token",
    "https://user:secret@fcm.googleapis.com/token",
    "https://fcm.googleapis.com:8080/token",
    "file:///private",
  ])("rejects a forged or private-network endpoint: %s", (url) => {
    expect(validPushEndpoint(url)).toBe(false);
  });
  it("validates the subscription key lengths", () => {
    expect(
      PushSubscriptionInput.safeParse({
        endpoint: "https://fcm.googleapis.com/token",
        p256dh: "A".repeat(87),
        auth: "A".repeat(22),
      }).success,
    ).toBe(true);
    expect(
      PushSubscriptionInput.safeParse({
        endpoint: "https://fcm.googleapis.com/token",
        p256dh: "short",
        auth: "short",
      }).success,
    ).toBe(false);
  });
  it("keeps push off unless all signing settings are present", () => {
    vi.stubEnv("FAMILY_PUSH_ENABLED", "false");
    expect(pushConfig().enabled).toBe(false);
    vi.stubEnv("FAMILY_PUSH_ENABLED", "true");
    vi.stubEnv("WEB_PUSH_PUBLIC_KEY", "public");
    vi.stubEnv("WEB_PUSH_PRIVATE_KEY", "");
    vi.stubEnv("WEB_PUSH_SUBJECT", "mailto:test@example.test");
    expect(pushConfig().enabled).toBe(false);
    vi.stubEnv("WEB_PUSH_PRIVATE_KEY", "private");
    expect(pushConfig().enabled).toBe(true);
  });
});
