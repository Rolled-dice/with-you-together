import { afterEach, describe, expect, it, vi } from "vitest";
import { LAUNCH_MARKETS, LAUNCH_PLANS } from "./launch-catalog";
import { launchDodoTestCatalog, launchTestProductId } from "./launch-dodo-products";
import { launchCheckoutPayload, createLaunchTestCheckout } from "./launch-checkout.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://someonenear.example/_serverFn"),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("launch test checkout", () => {
  it.each(["PRIVATE100", "WRONGCODE"])("validates the private live voucher %s before checkout", async (voucher) => {
    vi.stubEnv("DODO_PAYMENTS_ENV", "live");
    vi.stubEnv("DODO_LIVE_API_KEY", "fake-live-key");
    vi.stubEnv("DODO_LIVE_PRODUCT_CARE_INR", "pdt_live_india");
    vi.stubEnv("DODO_LIVE_INTERNAL_TEST_DISCOUNT_ID", "dsc_private");
    const query = {
      select: () => query,
      eq: () => query,
      in: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: { phone_country: "IN" }, error: null }),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ price: {
        type: "recurring_price", currency: "INR", price: 300000,
        trial_period_days: 7, trial_payment_method_optional: false,
        payment_frequency_count: 1, payment_frequency_interval: "Month",
      } }))
      .mockResolvedValueOnce(Response.json({
        code: "PRIVATE100", type: "percentage", amount: 10000,
        subscription_cycles: 1, usage_limit: 1, per_customer_usage_limit: 1,
        customer_eligibility: "specific", restricted_to: ["pdt_live_india"],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }))
      .mockResolvedValueOnce(Response.json({
        session_id: "cks_private", checkout_url: "https://checkout.dodopayments.com/session/cks_private",
      }));
    vi.stubGlobal("fetch", fetchMock);
    const result = createLaunchTestCheckout({ market: "in", plan: "care", voucher }, "user", {
      from: () => query,
      auth: { getUser: async () => ({ data: { user: { id: "user", email: "tester@example.com" } }, error: null }) },
    });
    if (voucher === "WRONGCODE") {
      await expect(result).rejects.toThrow("voucher is unavailable");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } else {
      await expect(result).resolves.toMatchObject({ sessionId: "cks_private" });
      const payload = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(payload.discount_codes).toEqual(["PRIVATE100"]);
      expect(payload.customer).toEqual({ email: "tester@example.com" });
    }
  });
  it("isolates live eligibility and overrides the trial for returning subscribers", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENV", "live");
    vi.stubEnv("DODO_LIVE_API_KEY", "fake-live-key");
    vi.stubEnv("DODO_LIVE_PRODUCT_CARE_INR", "pdt_live_india");
    const eq = vi.fn();
    const query = {
      select: () => query,
      eq,
      in: async () => ({ data: [{ status: "cancelled" }], error: null }),
      maybeSingle: async () => ({ data: { phone_country: "IN" }, error: null }),
    };
    eq.mockReturnValue(query);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ price: {
        type: "recurring_price", currency: "INR", price: 300000,
        trial_period_days: 7, trial_payment_method_optional: false,
        payment_frequency_count: 1, payment_frequency_interval: "Month",
      } }))
      .mockResolvedValueOnce(Response.json({
        session_id: "cks_live", checkout_url: "https://checkout.dodopayments.com/session/cks_live",
      }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createLaunchTestCheckout({ market: "us", plan: "care" }, "user", {
      from: () => query,
    })).resolves.toMatchObject({ sessionId: "cks_live" });
    expect(eq).toHaveBeenCalledWith("environment", "live");
    expect(eq).toHaveBeenCalledWith("provider", "dodo");
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload.billing_currency).toBe("INR");
    expect(payload.subscription_data.trial_period_days).toBe(0);
    expect(payload.discount_codes).toBeUndefined();
    expect(payload.feature_flags.allow_discount_code).toBe(true);
  });
  it("maps 32 supported offers and preserves the six rejected-currency offers", () => {
    expect(Object.keys(launchDodoTestCatalog.products)).toHaveLength(32);
    for (const market of LAUNCH_MARKETS)
      for (const plan of Object.keys(LAUNCH_PLANS) as (keyof typeof LAUNCH_PLANS)[]) {
        if (["kw", "bh", "om"].includes(market.id))
          expect(() =>
            launchCheckoutPayload({ market: market.id, plan }, "user", "https://example.com"),
          ).toThrow("unavailable");
        else {
          const payload = launchCheckoutPayload(
            { market: market.id, plan },
            "verified-user",
            "https://example.com",
          );
          expect(payload.product_cart).toEqual([
            { product_id: launchTestProductId(market.id, plan), quantity: 1 },
          ]);
          expect(payload.subscription_data.trial_period_days).toBe(7);
          expect(payload.metadata.userId).toBe("verified-user");
          expect(payload.feature_flags.allow_currency_selection).toBe(false);
        }
      }
    expect(launchTestProductId("kh", "care")).not.toBe(launchTestProductId("us", "care"));
    expect(launchDodoTestCatalog.discount.subscriptionCycles).toBe(1);
  });
  it("requires a signed-in user before creating live checkout", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENV", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createLaunchTestCheckout({ market: "in", plan: "care" }, "user")).rejects.toThrow(
      "signed-in user",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refuses product price drift before creating checkout", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENV", "test");
    vi.stubEnv("DODO_TEST_API_KEY", "fake-test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ price: { type: "recurring_price", currency: "INR", price: 399900 } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(createLaunchTestCheckout({ market: "in", plan: "care" }, "user")).rejects.toThrow(
      "no longer matches",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("validates the one-cycle offer and creates only a test checkout", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENV", "test");
    vi.stubEnv("DODO_TEST_API_KEY", "fake-test-key");
    const product = launchTestProductId("in", "care");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          price: {
            type: "recurring_price",
            currency: "INR",
            price: 300000,
            trial_period_days: 7,
            trial_payment_method_optional: false,
            payment_frequency_count: 1,
            payment_frequency_interval: "Month",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          type: "percentage",
          code: "SNLAUNCH30FIRST2026",
          amount: 3000,
          subscription_cycles: 1,
          restricted_to: [product],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          session_id: "cks_test",
          checkout_url: "https://test.checkout.dodopayments.com/session",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await createLaunchTestCheckout({ market: "in", plan: "care" }, "user")).toMatchObject({
      sessionId: "cks_test",
    });
    expect(
      fetchMock.mock.calls.every(([url]) => url.startsWith("https://test.dodopayments.com/")),
    ).toBe(true);
    const payload = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(payload.metadata.userId).toBe("user");
    expect(payload.return_url).toBe(
      "https://someonenear.example/checkout?plan=care&market=in&completed=1",
    );
  });
});
