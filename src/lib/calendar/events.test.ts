import { describe, it, expect } from "vitest";
import {
  buildDoseEvent,
  buildReminderEvent,
  stableHash,
  diffEvents,
  type DesiredEvent,
} from "./events";

describe("stableHash", () => {
  it("is order-sensitive and deterministic", () => {
    expect(stableHash(["a", "b"])).toBe(stableHash(["a", "b"]));
    expect(stableHash(["a", "b"])).not.toBe(stableHash(["b", "a"]));
  });
});

describe("buildDoseEvent", () => {
  it("builds a 15-minute event with a medication title", () => {
    const e = buildDoseEvent({
      id: "d1",
      scheduled_at: "2026-09-16T09:00:00.000Z",
      medication: { name: "Metformin", dosage: "500 mg", instructions: "after food" },
    });
    expect(e.source_type).toBe("dose");
    expect(e.source_id).toBe("d1");
    expect(e.summary).toContain("Metformin");
    expect(e.summary).toContain("500 mg");
    expect(e.start).toBe("2026-09-16T09:00:00.000Z");
    expect(e.end).toBe("2026-09-16T09:15:00.000Z");
    expect(e.hash).toBe(stableHash([e.summary, e.start, e.end]));
  });
});

describe("buildReminderEvent", () => {
  it("uses the reminder title and a 30-minute default block", () => {
    const e = buildReminderEvent({
      id: "r1",
      due_at: "2026-09-16T14:00:00.000Z",
      title: "Pay electricity bill",
      description: null,
      category: "bill",
    });
    expect(e.source_type).toBe("reminder");
    expect(e.summary).toBe("Pay electricity bill");
    expect(e.start).toBe("2026-09-16T14:00:00.000Z");
    expect(e.end).toBe("2026-09-16T14:30:00.000Z");
  });
});

describe("diffEvents", () => {
  const ev = (id: string, hash: string): DesiredEvent => ({
    source_type: "reminder",
    source_id: id,
    summary: "x",
    description: "",
    start: "2026-09-16T14:00:00.000Z",
    end: "2026-09-16T14:30:00.000Z",
    hash,
  });

  it("creates when no link exists", () => {
    const d = diffEvents([ev("r1", "h1")], []);
    expect(d.toCreate.map((e) => e.source_id)).toEqual(["r1"]);
    expect(d.toUpdate).toEqual([]);
    expect(d.toDeleteKeys).toEqual([]);
  });

  it("updates when the hash changed", () => {
    const d = diffEvents([ev("r1", "h2")], [{ source_type: "reminder", source_id: "r1", synced_hash: "h1" }]);
    expect(d.toUpdate.map((e) => e.source_id)).toEqual(["r1"]);
    expect(d.toCreate).toEqual([]);
  });

  it("skips when the hash matches", () => {
    const d = diffEvents([ev("r1", "h1")], [{ source_type: "reminder", source_id: "r1", synced_hash: "h1" }]);
    expect(d.toCreate).toEqual([]);
    expect(d.toUpdate).toEqual([]);
    expect(d.toDeleteKeys).toEqual([]);
  });

  it("deletes when a link has no desired event", () => {
    const d = diffEvents([], [{ source_type: "reminder", source_id: "r1", synced_hash: "h1" }]);
    expect(d.toDeleteKeys).toEqual([{ source_type: "reminder", source_id: "r1" }]);
  });
});
