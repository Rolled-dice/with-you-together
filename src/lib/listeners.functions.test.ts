import { describe, expect, it } from "vitest";

import { combineToUtc } from "./listeners.functions";

/**
 * Characterization tests for `combineToUtc`. It interprets a day (YYYY-MM-DD)
 * plus a time (HH:MM or HH:MM:SS) as a wall-clock time in the given IANA time
 * zone and returns the corresponding real UTC instant as an ISO string.
 *
 * Pure function, explicit inputs, no wall clock — fully deterministic. Offsets
 * below were verified against Node's Intl tz data before asserting. Summer
 * dates are used for US zones so the DST offset (EDT, UTC-4) is unambiguous.
 */
describe("combineToUtc", () => {
  it("maps a UTC wall-clock time to the same instant", () => {
    // In UTC there is no offset, so 09:00 stays 09:00Z.
    expect(combineToUtc("2026-06-15", "09:00", "UTC")).toBe(
      "2026-06-15T09:00:00.000Z",
    );
  });

  it("subtracts a positive offset (Asia/Kolkata, UTC+5:30)", () => {
    // 12:00 local in India (UTC+5:30) is 06:30 UTC.
    expect(combineToUtc("2026-06-15", "12:00", "Asia/Kolkata")).toBe(
      "2026-06-15T06:30:00.000Z",
    );
  });

  it("adds a negative offset (America/New_York in summer, EDT UTC-4)", () => {
    // 2026-06-15 is in EDT (UTC-4): 09:00 local is 13:00 UTC.
    expect(combineToUtc("2026-06-15", "09:00", "America/New_York")).toBe(
      "2026-06-15T13:00:00.000Z",
    );
  });

  it("crosses the date boundary when the local evening is next-day UTC", () => {
    // Kolkata 23:00 (UTC+5:30) → 17:30 UTC same day.
    expect(combineToUtc("2026-06-15", "23:00", "Asia/Kolkata")).toBe(
      "2026-06-15T17:30:00.000Z",
    );
    // New York 22:00 EDT (UTC-4) → 02:00 UTC the next day.
    expect(combineToUtc("2026-06-15", "22:00", "America/New_York")).toBe(
      "2026-06-16T02:00:00.000Z",
    );
  });

  it("accepts HH:MM and appends :00 seconds", () => {
    // time.length === 5 → ":00" is appended before conversion.
    expect(combineToUtc("2026-06-15", "09:00", "UTC")).toBe(
      "2026-06-15T09:00:00.000Z",
    );
  });

  it("accepts HH:MM:SS and preserves the seconds", () => {
    expect(combineToUtc("2026-06-15", "09:15:30", "UTC")).toBe(
      "2026-06-15T09:15:30.000Z",
    );
    // Seconds survive the offset math in a non-UTC zone too.
    expect(combineToUtc("2026-06-15", "12:15:30", "Asia/Kolkata")).toBe(
      "2026-06-15T06:45:30.000Z",
    );
  });

  it("throws on an invalid timezone (no fail-soft — Intl rejects the zone)", () => {
    // combineToUtc constructs Intl.DateTimeFormat directly with no try/catch,
    // so an unknown IANA zone throws a RangeError rather than falling back.
    // (The fail-soft-to-0 behavior lives in tzOffsetMinutes in call-crm.server.ts,
    // a separate function — not here.) Pinning the real contract: it throws.
    expect(() => combineToUtc("2026-06-15", "09:00", "Not/AZone")).toThrow();
  });
});
