import { describe, expect, it } from "vitest";
import {
  LAUNCH_MARKETS,
  LAUNCH_PLANS,
  launchPrice,
  launchPriceKey,
  marketForCountry,
  refundDeadline,
  type MarketId,
} from "./launch-catalog";
import { PLAN_DISPLAY } from "./currency";

const expected = [
  ["in", "₹3,000", "₹5,000"],
  ["us", "$49", "$79"],
  ["gb", "£39", "£62"],
  ["eu", "€45", "€72"],
  ["ca", "C$65", "C$105"],
  ["au", "A$75", "A$119"],
  ["pl", "zł179", "zł289"],
  ["mx", "MX$499", "MX$799"],
  ["sg", "S$65", "S$105"],
  ["jp", "¥5,900", "¥9,500"],
  ["kr", "₩59,000", "₩95,000"],
  ["th", "฿1,290", "฿2,090"],
  ["kh", "US$25", "US$39"],
  ["ae", "AED 179", "AED 289"],
  ["sa", "SAR 179", "SAR 299"],
  ["qa", "QAR 179", "QAR 299"],
  ["kw", "KWD 14.9", "KWD 23.9"],
  ["bh", "BHD 17", "BHD 27"],
  ["om", "OMR 18", "OMR 29"],
] as const;

describe("approved November launch catalog", () => {
  it.each(expected)("matches the approved %s prices", (market, care, plus) => {
    expect(launchPrice("care", market)).toBe(care);
    expect(launchPrice("care_plus", market)).toBe(plus);
  });
  it("uses supported currency precision and integer amounts", () => {
    expect(LAUNCH_MARKETS).toHaveLength(19);
    for (const market of LAUNCH_MARKETS) {
      expect(market.digits).toBe(
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: market.currency,
        }).resolvedOptions().maximumFractionDigits,
      );
      expect(Number.isSafeInteger(market.care)).toBe(true);
      expect(Number.isSafeInteger(market.care_plus)).toBe(true);
    }
  });
  it("distinguishes USD markets and safely rejects unknown markets", () => {
    expect(launchPriceKey("care", "kh")).not.toBe(launchPriceKey("care", "us"));
    expect(() => launchPrice("care", "invalid" as MarketId)).toThrow();
    expect(marketForCountry(" kh ")).toBe("kh");
    expect(marketForCountry("DE")).toBe("eu");
    expect(marketForCountry("BG")).toBe("eu");
    expect(marketForCountry(undefined)).toBe("us");
    expect(marketForCountry("XX")).toBe("us");
  });
  it("defines the shared plan and trial allowances without changing legacy subscriptions", () => {
    expect(LAUNCH_PLANS.care).toMatchObject({ calls: 15, people: 2, trialCalls: 4 });
    expect(LAUNCH_PLANS.care_plus).toMatchObject({ calls: 30, people: 5, trialCalls: 7 });
    expect(PLAN_DISPLAY.care.sessions).toBe(18);
    expect(PLAN_DISPLAY.care.inrLabel).toBe("₹3,999");
  });
  it("rounds first-month offers in the currency's minor units", () => {
    expect(launchPrice("care", "in", true)).toBe("₹2,100");
    expect(launchPrice("care_plus", "in", true)).toBe("₹3,500");
    expect(launchPrice("care", "us", true)).toBe("$34.3");
    expect(launchPrice("care", "kw", true)).toBe("KWD 10.43");
  });
  it("bases refunds on the actual first successful charge, including delayed settlement", () => {
    expect(refundDeadline("2026-11-15T09:30:00.000Z")).toBe("2026-11-22T09:30:00.000Z");
    expect(() => refundDeadline("invalid")).toThrow();
  });
});
