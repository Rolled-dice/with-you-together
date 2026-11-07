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
  it("refuses live mode before contacting a provider", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENV", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createLaunchTestCheckout({ market: "in", plan: "care" }, "user")).rejects.toThrow(
      "test mode only",
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
