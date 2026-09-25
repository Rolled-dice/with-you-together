import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dodoBaseUrl,
  dodoProductIdForPrice,
  getDodoApiKey,
  getDodoEnvironment,
  getDodoWebhookSecret,
} from "./dodo.config.server";

const DODO_ENVIRONMENT_NAMES = [
  "DODO_PAYMENTS_ENV",
  "DODO_TEST_API_KEY",
  "DODO_TEST_WEBHOOK_SECRET",
  "DODO_TEST_PRODUCT_CARE_USD",
  "DODO_TEST_PRODUCT_CARE_PLUS_USD",
  "DODO_TEST_PRODUCT_CARE_INR",
  "DODO_TEST_PRODUCT_CARE_PLUS_INR",
  "DODO_LIVE_API_KEY",
  "DODO_LIVE_WEBHOOK_SECRET",
  "DODO_LIVE_PRODUCT_CARE_USD",
  "DODO_LIVE_PRODUCT_CARE_PLUS_USD",
  "DODO_LIVE_PRODUCT_CARE_INR",
  "DODO_LIVE_PRODUCT_CARE_PLUS_INR",
] as const;

function setEnvironment(values: Record<string, string | undefined>) {
  vi.unstubAllEnvs();
  for (const name of DODO_ENVIRONMENT_NAMES) vi.stubEnv(name, "");
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) vi.stubEnv(name, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Dodo payment configuration", () => {
  it("defaults to test mode when no mode is configured", () => {
    setEnvironment({});
    expect(getDodoEnvironment()).toBe("test");
    expect(dodoBaseUrl(getDodoEnvironment())).toBe("https://test.dodopayments.com");
  });

  it("uses test-mode credentials and products when test mode is active", () => {
    setEnvironment({
      DODO_PAYMENTS_ENV: "test",
      DODO_TEST_API_KEY: "dodo_test_example",
      DODO_TEST_WEBHOOK_SECRET: "whsec_test_example",
      DODO_TEST_PRODUCT_CARE_USD: "pdt_test_care_usd",
    });

    expect(getDodoApiKey()).toBe("dodo_test_example");
    expect(getDodoWebhookSecret()).toBe("whsec_test_example");
    expect(dodoProductIdForPrice("care_monthly_usd")).toBe("pdt_test_care_usd");
  });

  it("uses only live-mode credentials and products when live mode is active", () => {
    setEnvironment({
      DODO_PAYMENTS_ENV: "live",
      DODO_LIVE_API_KEY: "dodo_live_example",
      DODO_LIVE_WEBHOOK_SECRET: "whsec_live_example",
      DODO_LIVE_PRODUCT_CARE_PLUS_INR: "pdt_live_care_plus_inr",
      DODO_TEST_API_KEY: "must_not_be_used",
    });

    expect(getDodoEnvironment()).toBe("live");
    expect(dodoBaseUrl(getDodoEnvironment())).toBe("https://live.dodopayments.com");
    expect(getDodoApiKey()).toBe("dodo_live_example");
    expect(getDodoWebhookSecret()).toBe("whsec_live_example");
    expect(dodoProductIdForPrice("care_plus_monthly_inr")).toBe("pdt_live_care_plus_inr");
  });

  it("rejects an invalid active payment mode", () => {
    setEnvironment({ DODO_PAYMENTS_ENV: "production" });
    expect(() => getDodoEnvironment()).toThrow("DODO_PAYMENTS_ENV must be either 'test' or 'live'");
  });

  it("fails closed when the selected mode has no API key", () => {
    setEnvironment({ DODO_PAYMENTS_ENV: "live", DODO_TEST_API_KEY: "dodo_test_example" });
    expect(() => getDodoApiKey()).toThrow("DODO_LIVE_API_KEY is not configured");
  });
});
