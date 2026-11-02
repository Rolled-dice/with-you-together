import { describe, expect, it } from "vitest";
import { localInput, localToUtc, timeZoneSchema } from "./time";
import { capabilities, requireCapability } from "./capabilities";
import { safeAuthRedirect } from "@/lib/auth-routing";

describe("timezone-safe scheduling", () => {
  it("converts Kolkata midnight to the preceding UTC date", () => {
    expect(localToUtc("2026-11-02T00:15", "Asia/Kolkata")).toBe("2026-11-01T18:45:00.000Z");
    expect(localInput(new Date("2026-11-01T18:45:00Z"), "Asia/Kolkata")).toBe("2026-11-02T00:15");
  });
  it("rejects nonexistent and repeated DST times", () => {
    expect(() => localToUtc("2026-03-08T02:30", "America/New_York")).toThrow(/daylight/);
    expect(() => localToUtc("2026-11-01T01:30", "America/New_York")).toThrow(/daylight/);
    expect(localToUtc("2026-11-01T03:30", "America/New_York")).toBe("2026-11-01T08:30:00.000Z");
  });
  it("rejects invalid dates and timezone strings", () => {
    expect(() => localToUtc("2026-02-31T12:00", "UTC")).toThrow();
    expect(timeZoneSchema.safeParse("not/a-zone").success).toBe(false);
  });
});
describe("contract exclusions", () => {
  it("blocks every unverified capability at the action boundary", () => {
    for (const key of Object.keys(capabilities) as Array<keyof typeof capabilities>)
      expect(() => requireCapability(key)).toThrow(/not available/);
  });
  it("keeps auth redirects local", () => {
    expect(safeAuthRedirect("/family?invite=1")).toBe("/family?invite=1");
    for (const input of [
      "//evil.test",
      "/\\evil.test",
      "https://evil.test",
      "/auth",
      "/\nevil.test",
    ])
      expect(safeAuthRedirect(input)).toBe("/dashboard");
  });
});
