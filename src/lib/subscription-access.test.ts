import { describe, expect, it } from "vitest";
import { currentSubscription, hasSubscriptionAccess } from "./subscription-access";

describe("live subscription access", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");

  it("retains access until the end of a canceled paid period", () => {
    expect(hasSubscriptionAccess({ status: "canceled", current_period_end: "2026-11-14T00:00:00Z" }, now)).toBe(true);
    expect(hasSubscriptionAccess({ status: "canceled", current_period_end: "2026-11-10T00:00:00Z" }, now)).toBe(false);
  });

  it("does not grant access to on-hold or expired subscriptions", () => {
    expect(hasSubscriptionAccess({ status: "on_hold", current_period_end: "2026-11-14T00:00:00Z" }, now)).toBe(false);
    expect(hasSubscriptionAccess({ status: "active", current_period_end: "2026-11-10T00:00:00Z" }, now)).toBe(false);
  });

  it("prefers an active subscription over a newer failed attempt", () => {
    const active = { status: "active", current_period_end: "2026-11-14T00:00:00Z", price_id: "care_plus_launch_2026_11_in", created_at: "2026-11-07T00:00:00Z" };
    const failed = { status: "incomplete_expired", current_period_end: null, price_id: "care_launch_2026_11_in", created_at: "2026-11-10T00:00:00Z" };
    expect(currentSubscription([active, failed], now)).toBe(active);
  });
});
