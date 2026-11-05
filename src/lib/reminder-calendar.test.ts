import { describe, expect, it } from "vitest";
import { buildReminderCalendar } from "./reminder-calendar";
describe("device calendar reminder", () => {
  it("exports UTC dates, recurrence and a real ten-minute alarm", () => {
    const ics = buildReminderCalendar(
      {
        id: "reminder",
        title: "Evening walk",
        dueAt: "2026-11-04T18:00:00+05:30",
        recurrence: "daily",
      },
      new Date("2026-11-04T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART:20261104T123000Z\r\nDTEND:20261104T124500Z");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("TRIGGER:-PT10M");
  });
  it("escapes injected event lines and folds Unicode at 75 bytes", () => {
    const ics = buildReminderCalendar({
      id: "one",
      title: "Tea, rest;\nEND:VEVENT\n" + "🌙".repeat(50),
      dueAt: "2026-11-04T18:00:00Z",
    });
    expect(ics.match(/\r\nEND:VEVENT\r\n/g)).toHaveLength(1);
    expect(ics).toContain("Tea\\, rest\\;\\nEND:VEVENT\\n");
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
    expect(() => buildReminderCalendar({ id: "one", title: "Tea", dueAt: "bad" })).toThrow(
      /valid date/,
    );
  });
});
