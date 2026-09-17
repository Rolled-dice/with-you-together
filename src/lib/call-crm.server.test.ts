import { describe, expect, it } from "vitest";

import type { CallAgent } from "./call-crm";
import { extractSkills, scoreAgents } from "./call-crm.server";

/**
 * Characterization tests for the call-routing pure functions in
 * `call-crm.server.ts`: `extractSkills` (parses `[SKILL:xxx]` tags from a
 * booking note) and `scoreAgents` (the enterprise-style routing score:
 * capacity gate first, then working-hours overlap in the agent's own timezone,
 * skill match, and recent-load fairness, sorted highest score first).
 *
 * These pin the exact current behavior — scores, ordering, exclusions, and
 * tag-parsing rules — so a future regression is caught. All inputs are
 * deterministic: explicit UTC Dates and UTC-timezone agents so the
 * `Intl.DateTimeFormat` working-hours math is computable by hand (UTC offset 0,
 * so local minutes == UTC minutes).
 */
describe("extractSkills", () => {
  it("returns [] for a null note", () => {
    expect(extractSkills(null)).toEqual([]);
  });

  it("returns [] when the note has no [SKILL:] tags", () => {
    expect(extractSkills("Please call after lunch, feeling low today.")).toEqual([]);
  });

  it("extracts a single skill tag", () => {
    expect(extractSkills("[SKILL:grief]")).toEqual(["grief"]);
  });

  it("extracts multiple skill tags in order", () => {
    expect(extractSkills("[SKILL:grief][SKILL:anxiety]")).toEqual(["grief", "anxiety"]);
  });

  it("lowercases tag values (case-insensitive parse)", () => {
    expect(extractSkills("[SKILL:Grief]")).toEqual(["grief"]);
    expect(extractSkills("[SKILL:ANXIETY]")).toEqual(["anxiety"]);
  });

  it("finds tags mixed into surrounding note text", () => {
    const note = "Mum has been quiet [SKILL:grief] since the funeral, also [SKILL:elder-care] please.";
    expect(extractSkills(note)).toEqual(["grief", "elder-care"]);
  });
});

/**
 * Base agent template. Individual tests override only the fields they exercise.
 * Timezone "UTC" keeps localMinutes == UTC minutes so working-hours branches
 * are hand-computable.
 */
function makeAgent(overrides: Partial<CallAgent> = {}): CallAgent {
  return {
    id: "a1",
    name: "Agent One",
    email: null,
    phone: null,
    timezone: "UTC",
    skills: [],
    work_start: "09:00",
    work_end: "17:00",
    max_concurrent: 3,
    is_active: true,
    ...overrides,
  };
}

describe("scoreAgents", () => {
  // 12:00 UTC == 720 local minutes for a UTC agent → within 09:00–17:00 (in hours).
  const IN_HOURS = new Date("2026-01-01T12:00:00.000Z");
  // 03:00 UTC == 180 local minutes → outside 09:00–17:00 (out of hours).
  const OUT_OF_HOURS = new Date("2026-01-01T03:00:00.000Z");

  it("scores a single eligible in-hours agent: base 100 + 30 working hours = 130", () => {
    const agent = makeAgent();
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: [],
      load: new Map(),
      recent: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(130);
    expect(result[0].agent.id).toBe("a1");
    expect(result[0].reasons).toEqual(["load 0/3", "in working hours"]);
  });

  it("applies the outside-working-hours penalty: 100 - 45 = 55", () => {
    const agent = makeAgent();
    const result = scoreAgents([agent], {
      startsAt: OUT_OF_HOURS,
      wantedSkills: [],
      load: new Map(),
      recent: new Map(),
    });
    expect(result[0].score).toBe(55);
    expect(result[0].reasons).toEqual(["load 0/3", "outside working hours"]);
  });

  it("excludes inactive agents entirely", () => {
    const agent = makeAgent({ is_active: false });
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: [],
      load: new Map(),
      recent: new Map(),
    });
    expect(result).toEqual([]);
  });

  it("excludes an agent at or over capacity (load >= max_concurrent)", () => {
    const agent = makeAgent({ max_concurrent: 2 });
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: [],
      load: new Map([["a1", 2]]),
      recent: new Map(),
    });
    expect(result).toEqual([]);
  });

  it("subtracts 12 per active load unit below capacity", () => {
    const agent = makeAgent({ max_concurrent: 3 });
    // load 1 (< 3): 100 - 12 + 30 = 118
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: [],
      load: new Map([["a1", 1]]),
      recent: new Map(),
    });
    expect(result[0].score).toBe(118);
    expect(result[0].reasons).toEqual(["load 1/3", "in working hours"]);
  });

  it("adds 20 per matched wanted skill (case-insensitive against agent skills)", () => {
    const agent = makeAgent({ skills: ["Grief", "Anxiety"] });
    // 100 + 30 in-hours + 2 matches * 20 = 170
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: ["grief", "anxiety"],
      load: new Map(),
      recent: new Map(),
    });
    expect(result[0].score).toBe(170);
    expect(result[0].reasons).toEqual([
      "load 0/3",
      "in working hours",
      "skills: grief, anxiety",
    ]);
  });

  it("records 'no skill match' without a bonus when nothing overlaps", () => {
    const agent = makeAgent({ skills: ["grief"] });
    // 100 + 30, no matches → still 130
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: ["addiction"],
      load: new Map(),
      recent: new Map(),
    });
    expect(result[0].score).toBe(130);
    expect(result[0].reasons).toEqual(["load 0/3", "in working hours", "no skill match"]);
  });

  it("subtracts 4 per recent-call unit for fairness", () => {
    const agent = makeAgent();
    // 100 + 30 - (recent 3 * 4 = 12) = 118
    const result = scoreAgents([agent], {
      startsAt: IN_HOURS,
      wantedSkills: [],
      load: new Map(),
      recent: new Map([["a1", 3]]),
    });
    expect(result[0].score).toBe(118);
  });

  it("sorts eligible agents by score descending", () => {
    const strong = makeAgent({ id: "strong", skills: ["grief"] });
    const weak = makeAgent({ id: "weak" });
    const result = scoreAgents([weak, strong], {
      startsAt: IN_HOURS,
      wantedSkills: ["grief"],
      load: new Map(),
      recent: new Map(),
    });
    // strong: 100 + 30 + 20 = 150; weak: 100 + 30 + 0 (no match) = 130
    expect(result.map((r) => r.agent.id)).toEqual(["strong", "weak"]);
    expect(result[0].score).toBe(150);
    expect(result[1].score).toBe(130);
  });
});
