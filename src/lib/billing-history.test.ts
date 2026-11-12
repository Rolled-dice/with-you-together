import { describe, expect, it } from "vitest";
import { customerBillingEvents } from "./billing-history";

describe("customer billing history", () => {
  it("shows one membership entry for a trial activation", () => {
    expect(customerBillingEvents([
      { event_type: "subscription.reconciled", amount_cents: 0 },
      { event_type: "payment.succeeded", amount_cents: 0 },
      { event_type: "tier.started", amount_cents: null },
    ])).toEqual([{ event_type: "tier.started", amount_cents: null }]);
  });

  it("keeps a real successful charge", () => {
    expect(customerBillingEvents([
      { event_type: "payment.succeeded", amount_cents: 350000 },
    ])).toHaveLength(1);
  });
});
