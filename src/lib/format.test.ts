import { describe, expect, it } from "vitest";

import { formatCount } from "./format";

/**
 * Characterization tests for the landing-page stat formatter. Pins the exact
 * observable behavior: sub-1000 values pass through unchanged, and 1000+
 * collapse to a "k+" suffix with one decimal below 10k / rounded whole at or
 * above 10k. All expected values were computed against the real implementation.
 */
describe("formatCount", () => {
  it("returns numbers below 1000 as plain stringified integers", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
    expect(formatCount(999)).toBe("999");
  });

  it("formats exactly 1000 as '1k+' (drops the .0)", () => {
    expect(formatCount(1000)).toBe("1k+");
  });

  it("keeps a single decimal for values between 1k and 10k", () => {
    expect(formatCount(1500)).toBe("1.5k+");
    expect(formatCount(2500)).toBe("2.5k+");
  });

  it("drops a trailing .0 for whole-thousand values below 10k", () => {
    expect(formatCount(2000)).toBe("2k+");
    expect(formatCount(9000)).toBe("9k+");
  });

  it("rounds to a whole number at the 10k boundary and above", () => {
    expect(formatCount(10000)).toBe("10k+");
    expect(formatCount(12000)).toBe("12k+");
    // 12500 / 1000 = 12.5 -> Math.round -> 13
    expect(formatCount(12500)).toBe("13k+");
    // 12400 / 1000 = 12.4 -> Math.round -> 12
    expect(formatCount(12400)).toBe("12k+");
  });

  it("rounds the sub-10k decimal via toFixed(1) at the boundary", () => {
    // 9990 / 1000 = 9.99 -> toFixed(1) -> "10.0" -> "10" (k < 10 branch)
    expect(formatCount(9990)).toBe("10k+");
    // 9949 / 1000 = 9.949 -> toFixed(1) -> "9.9"
    expect(formatCount(9949)).toBe("9.9k+");
  });
});
