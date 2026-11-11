import { describe, expect, it } from "vitest";
import { assertRescheduleAllowed } from "./listener-booking-rules";

const now = Date.parse("2026-11-11T12:00:00Z");

describe("listener rescheduling", () => {
  it("rejects a late reschedule without marking the original booking used", () => {
    expect(() => assertRescheduleAllowed(
      "confirmed", "2026-11-11T13:00:00Z", "2026-11-12T12:00:00Z", now,
    )).toThrow("existing booking is unchanged");
  });

  it("rejects an invalid replacement time", () => {
    expect(() => assertRescheduleAllowed(
      "confirmed", "2026-11-12T12:00:00Z", "2026-11-11T13:00:00Z", now,
    )).toThrow("existing booking is unchanged");
  });

  it("allows a valid upcoming booking to move to a later slot", () => {
    expect(() => assertRescheduleAllowed(
      "confirmed", "2026-11-12T12:00:00Z", "2026-11-13T12:00:00Z", now,
    )).not.toThrow();
  });
});
