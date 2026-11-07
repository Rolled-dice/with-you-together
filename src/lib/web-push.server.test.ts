import { describe, expect, it, vi } from "vitest";
import { isFamilyPushEnabled, sendGenericReminderPush } from "./web-push.server";

const device = {
  endpoint: "https://push.example.test/subscription/secret",
  p256dh: "p".repeat(65),
  authKey: "a".repeat(22),
};
const message = { destination: "/reminders" };

const enabledEnvironment = {
  FAMILY_PUSH_ENABLED: "true",
  WEB_PUSH_SUBJECT: "mailto:care@someonenear.com",
  WEB_PUSH_PUBLIC_KEY: "public-key",
  WEB_PUSH_PRIVATE_KEY: "private-key",
} as NodeJS.ProcessEnv;

describe("Web Push configuration", () => {
  it("only enables delivery for the explicit true flag", () => {
    expect(isFamilyPushEnabled({ FAMILY_PUSH_ENABLED: "true" })).toBe(true);
    expect(isFamilyPushEnabled({ FAMILY_PUSH_ENABLED: "TRUE" })).toBe(false);
    expect(isFamilyPushEnabled({})).toBe(false);
  });

  it("does not contact a device while delivery is disabled", async () => {
    const request = vi.fn();
    await expect(sendGenericReminderPush(device, message, {}, request)).resolves.toBe("retry");
    expect(request).not.toHaveBeenCalled();
  });

  it("requires server-only VAPID settings before sending", async () => {
    await expect(
      sendGenericReminderPush(device, message, { FAMILY_PUSH_ENABLED: "true" }),
    ).rejects.toThrow("Web Push is not configured.");
  });

  it("rejects a non-HTTPS device endpoint", async () => {
    await expect(
      sendGenericReminderPush(
        { ...device, endpoint: "http://push.example.test/unsafe" },
        message,
        enabledEnvironment,
      ),
    ).rejects.toThrow();
  });
});
