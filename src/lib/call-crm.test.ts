import { describe, expect, it } from "vitest";

import { slaLevel } from "./call-crm";

/**
 * Characterization tests for the SLA warning ladder. `slaLevel` decides how a
 * scheduled listener call is surfaced (on track → T-90m warn → T-60m urgent →
 * breached) based on how far its start time is from now. All boundary math,
 * no I/O — the exact kind of logic a regression would silently break.
 *
 * `now` is injected so tests are deterministic (no wall-clock flakiness).
 */
describe("slaLevel", () => {
  const NOW = Date.parse("2026-01-01T12:00:00.000Z");
  const at = (msFromNow: number) => new Date(NOW + msFromNow).toISOString();
  const MIN = 60_000;

  it("is 'ok' for calls comfortably in the future (> 90 min out)", () => {
    expect(slaLevel(at(120 * MIN), "requested", NOW)).toBe("ok");
  });

  it("is 'warn' at the T-90m band (60 < minutes-out <= 90)", () => {
    expect(slaLevel(at(90 * MIN), "requested", NOW)).toBe("warn");
    expect(slaLevel(at(75 * MIN), "requested", NOW)).toBe("warn");
  });

  it("is 'urgent' at the T-60m band (0 < minutes-out <= 60)", () => {
    expect(slaLevel(at(60 * MIN), "requested", NOW)).toBe("urgent");
    expect(slaLevel(at(30 * MIN), "requested", NOW)).toBe("urgent");
  });

  it("is 'breached' once the start time is in the past", () => {
    expect(slaLevel(at(-1 * MIN), "requested", NOW)).toBe("breached");
  });

  it("treats the exact 90-minute boundary as 'warn', not 'urgent'", () => {
    // ms === 90min is <= 90min but > 60min, so warn (not urgent).
    expect(slaLevel(at(90 * MIN), "assigned", NOW)).toBe("warn");
    // one ms past 90min tips to ok.
    expect(slaLevel(at(90 * MIN + 1), "assigned", NOW)).toBe("ok");
  });

  it("treats the exact 60-minute boundary as 'urgent', not 'warn'", () => {
    expect(slaLevel(at(60 * MIN), "assigned", NOW)).toBe("urgent");
    expect(slaLevel(at(60 * MIN + 1), "assigned", NOW)).toBe("warn");
  });

  it("treats exactly now (0 ms) as 'urgent', not yet 'breached'", () => {
    // ms === 0 is not < 0, and is <= 60min, so urgent.
    expect(slaLevel(at(0), "requested", NOW)).toBe("urgent");
  });

  it("short-circuits to 'ok' for completed or in-call bookings regardless of time", () => {
    // Even a long-past start is 'ok' once the call is done or live.
    expect(slaLevel(at(-500 * MIN), "completed", NOW)).toBe("ok");
    expect(slaLevel(at(-500 * MIN), "in_call", NOW)).toBe("ok");
  });
});
