import type { CallAgent } from "@/lib/call-crm";

export async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export async function logCallEvent(
  ctx: { supabase: any; userId: string },
  bookingId: string,
  eventType: string,
  detail: Record<string, unknown> = {},
) {
  await ctx.supabase.from("call_events").insert({
    booking_id: bookingId,
    event_type: eventType,
    detail,
    actor: ctx.userId,
  });
}

/** Offset in minutes between a timezone and UTC at a given instant. */
function tzOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const p = fmt.formatToParts(at).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    const asUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour === "24" ? "00" : p.hour),
      Number(p.minute),
      Number(p.second),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function localMinutes(timeZone: string, at: Date): number {
  const off = tzOffsetMinutes(timeZone, at);
  const utcMin = at.getUTCHours() * 60 + at.getUTCMinutes();
  return (((utcMin + off) % 1440) + 1440) % 1440;
}

function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

/** Skill tags mentioned in a booking note, e.g. "[SKILL:grief]". */
export function extractSkills(note: string | null): string[] {
  if (!note) return [];
  return [...note.matchAll(/\[SKILL:([a-z0-9_-]+)\]/gi)].map((m) => m[1].toLowerCase());
}

export type ScoredAgent = { agent: CallAgent; score: number; reasons: string[] };

/**
 * Enterprise-style routing score: capacity first, then working-hours overlap in
 * the agent's own timezone, skill match, and recent-load fairness.
 */
export function scoreAgents(
  agents: CallAgent[],
  opts: {
    startsAt: Date;
    wantedSkills: string[];
    load: Map<string, number>;
    recent: Map<string, number>;
  },
): ScoredAgent[] {
  const scored: ScoredAgent[] = [];
  for (const agent of agents) {
    if (!agent.is_active) continue;
    const reasons: string[] = [];
    let score = 100;

    const load = opts.load.get(agent.id) ?? 0;
    if (load >= agent.max_concurrent) continue; // at capacity
    score -= load * 12;
    reasons.push(`load ${load}/${agent.max_concurrent}`);

    const mins = localMinutes(agent.timezone, opts.startsAt);
    const start = hhmmToMinutes(agent.work_start);
    const end = hhmmToMinutes(agent.work_end);
    const inHours =
      start <= end ? mins >= start && mins < end : mins >= start || mins < end;
    if (inHours) {
      score += 30;
      reasons.push("in working hours");
    } else {
      score -= 45;
      reasons.push("outside working hours");
    }

    if (opts.wantedSkills.length) {
      const have = agent.skills.map((s) => s.toLowerCase());
      const hits = opts.wantedSkills.filter((s) => have.includes(s));
      score += hits.length * 20;
      reasons.push(hits.length ? `skills: ${hits.join(", ")}` : "no skill match");
    }

    score -= (opts.recent.get(agent.id) ?? 0) * 4;

    scored.push({ agent, score, reasons });
  }
  return scored.sort((a, b) => b.score - a.score);
}
