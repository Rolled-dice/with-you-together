import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const CRM_STATES = [
  "requested",
  "assigned",
  "confirmed",
  "in_call",
  "completed",
  "missed",
  "escalated",
] as const;
export type CrmState = (typeof CRM_STATES)[number];

export type CallAgent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  skills: string[];
  work_start: string;
  work_end: string;
  max_concurrent: number;
  is_active: boolean;
};

export type QueueRow = {
  id: string;
  user_id: string;
  requested_at: string;
  duration_minutes: number;
  note: string | null;
  status: string;
  crm_state: CrmState;
  sla_deadline: string | null;
  agent_id: string | null;
  agent_name: string | null;
  listener_name: string | null;
  open_flags: number;
};

export type CallFlag = {
  id: string;
  booking_id: string;
  kind: string;
  severity: string;
  note: string | null;
  resolved: boolean;
  created_at: string;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

async function logEvent(
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

export const listCallQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: bookings, error }, { data: agents }, { data: flags }] =
      await Promise.all([
        context.supabase
          .from("listener_bookings")
          .select(
            "id, user_id, requested_at, duration_minutes, note, status, crm_state, sla_deadline, agent_id, listeners(name)",
          )
          .order("requested_at", { ascending: true })
          .limit(500),
        context.supabase.from("call_agents").select("id, name"),
        context.supabase.from("call_flags").select("booking_id").eq("resolved", false),
      ]);
    if (error) throw new Error(error.message);

    const agentName = new Map<string, string>(
      (agents ?? []).map((a: { id: string; name: string }) => [a.id, a.name]),
    );
    const flagCount = new Map<string, number>();
    for (const f of (flags ?? []) as { booking_id: string }[]) {
      flagCount.set(f.booking_id, (flagCount.get(f.booking_id) ?? 0) + 1);
    }

    const rows: QueueRow[] = (bookings ?? []).map((b: any) => ({
      id: b.id,
      user_id: b.user_id,
      requested_at: b.requested_at,
      duration_minutes: b.duration_minutes,
      note: b.note,
      status: b.status,
      crm_state: (b.crm_state ?? "requested") as CrmState,
      sla_deadline: b.sla_deadline,
      agent_id: b.agent_id,
      agent_name: b.agent_id ? agentName.get(b.agent_id) ?? null : null,
      listener_name: b.listeners?.name ?? null,
      open_flags: flagCount.get(b.id) ?? 0,
    }));
    return { rows };
  });

export const listCallAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("call_agents")
      .select(
        "id, name, email, phone, timezone, skills, work_start, work_end, max_concurrent, is_active",
      )
      .order("name");
    if (error) throw new Error(error.message);
    return { agents: (data ?? []) as CallAgent[] };
  });

const AgentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  timezone: z.string().min(1).max(64),
  skills: z.array(z.string().max(40)).max(20).default([]),
  work_start: z.string().regex(/^\d{2}:\d{2}$/),
  work_end: z.string().regex(/^\d{2}:\d{2}$/),
  max_concurrent: z.number().int().min(1).max(20),
  is_active: z.boolean().default(true),
});

export const upsertCallAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AgentInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { id, ...fields } = data;
    const payload = {
      ...fields,
      email: fields.email ?? null,
      phone: fields.phone ?? null,
    };
    if (id) {
      const { error } = await context.supabase
        .from("call_agents")
        .update(payload)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: inserted, error } = await context.supabase
      .from("call_agents")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id as string };
  });

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

/** Skill tags mentioned in a booking note, e.g. "[SKILL:grief]" or plain keywords. */
function extractSkills(note: string | null): string[] {
  if (!note) return [];
  const tagged = [...note.matchAll(/\[SKILL:([a-z0-9_-]+)\]/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  return tagged;
}

type ScoredAgent = { agent: CallAgent; score: number; reasons: string[] };

function scoreAgents(
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

    // Load / capacity
    const load = opts.load.get(agent.id) ?? 0;
    if (load >= agent.max_concurrent) continue; // at capacity: not eligible
    score -= load * 12;
    reasons.push(`load ${load}/${agent.max_concurrent}`);

    // Working hours in the agent's own timezone
    const mins = localMinutes(agent.timezone, opts.startsAt);
    const start = hhmmToMinutes(agent.work_start);
    const end = hhmmToMinutes(agent.work_end);
    const inHours = start <= end ? mins >= start && mins < end : mins >= start || mins < end;
    if (inHours) {
      score += 30;
      reasons.push("in working hours");
    } else {
      score -= 45;
      reasons.push("outside working hours");
    }

    // Skill match
    if (opts.wantedSkills.length) {
      const have = agent.skills.map((s) => s.toLowerCase());
      const hits = opts.wantedSkills.filter((s) => have.includes(s));
      score += hits.length * 20;
      if (hits.length) reasons.push(`skills: ${hits.join(", ")}`);
      else reasons.push("no skill match");
    }

    // Fairness: fewer recent calls wins
    score -= (opts.recent.get(agent.id) ?? 0) * 4;

    scored.push({ agent, score, reasons });
  }
  return scored.sort((a, b) => b.score - a.score);
}

export const autoAssignBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: booking, error: berr } = await context.supabase
      .from("listener_bookings")
      .select("id, requested_at, note, crm_state")
      .eq("id", data.id)
      .single();
    if (berr) throw new Error(berr.message);
    if (!booking) throw new Error("Booking not found.");

    const startsAt = new Date(booking.requested_at);
    const twoHours = 2 * 60 * 60 * 1000;
    const tooLate = startsAt.getTime() - Date.now() < twoHours;

    const { data: agentRows, error: aerr } = await context.supabase
      .from("call_agents")
      .select(
        "id, name, email, phone, timezone, skills, work_start, work_end, max_concurrent, is_active",
      );
    if (aerr) throw new Error(aerr.message);
    const agents = (agentRows ?? []) as CallAgent[];

    const { data: openBookings } = await context.supabase
      .from("listener_bookings")
      .select("agent_id, requested_at, crm_state")
      .in("crm_state", ["assigned", "confirmed", "in_call"]);
    const load = new Map<string, number>();
    const recent = new Map<string, number>();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const b of (openBookings ?? []) as any[]) {
      if (!b.agent_id) continue;
      load.set(b.agent_id, (load.get(b.agent_id) ?? 0) + 1);
      if (new Date(b.requested_at).getTime() > dayAgo) {
        recent.set(b.agent_id, (recent.get(b.agent_id) ?? 0) + 1);
      }
    }

    const ranked = scoreAgents(agents, {
      startsAt,
      wantedSkills: extractSkills(booking.note),
      load,
      recent,
    });

    if (ranked.length === 0) {
      await context.supabase
        .from("listener_bookings")
        .update({ crm_state: "escalated" })
        .eq("id", data.id);
      await context.supabase.from("call_flags").insert({
        booking_id: data.id,
        kind: "unassignable",
        severity: tooLate ? "urgent" : "high",
        note: "No eligible agent available (capacity or roster empty).",
        raised_by: context.userId,
      });
      await logEvent(context, data.id, "assignment_failed", { reason: "no_eligible_agent" });
      return { ok: false, reason: "No eligible agent — flagged for admin." };
    }

    const winner = ranked[0];
    const { error: uerr } = await context.supabase
      .from("listener_bookings")
      .update({
        agent_id: winner.agent.id,
        crm_state: "assigned",
        sla_deadline: startsAt.toISOString(),
      })
      .eq("id", data.id);
    if (uerr) throw new Error(uerr.message);
    await logEvent(context, data.id, "assigned", {
      agent_id: winner.agent.id,
      score: winner.score,
      reasons: winner.reasons,
    });
    if (tooLate) {
      await context.supabase.from("call_flags").insert({
        booking_id: data.id,
        kind: "lead_time",
        severity: "high",
        note: "Assigned inside the 2-hour lead-time window.",
        raised_by: context.userId,
      });
    }
    return {
      ok: true,
      agent: winner.agent.name,
      score: winner.score,
      reasons: winner.reasons,
    };
  });

export const assignBookingAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), agent_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({ agent_id: data.agent_id, crm_state: "assigned" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logEvent(context, data.id, "assigned_manually", { agent_id: data.agent_id });
    return { ok: true };
  });

export const setBookingCrmState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), crm_state: z.enum(CRM_STATES) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({ crm_state: data.crm_state })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logEvent(context, data.id, "state_changed", { crm_state: data.crm_state });
    return { ok: true };
  });

export const listCallFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("call_flags")
      .select("id, booking_id, kind, severity, note, resolved, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { flags: (data ?? []) as CallFlag[] };
  });

export const raiseCallFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        booking_id: z.string().uuid(),
        kind: z.enum(["safety", "no_show", "abuse", "tech_failure", "sla_breach", "other"]),
        severity: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        note: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("call_flags").insert({
      booking_id: data.booking_id,
      kind: data.kind,
      severity: data.severity,
      note: data.note ?? null,
      raised_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await logEvent(context, data.booking_id, "flag_raised", { kind: data.kind });
    return { ok: true };
  });

export const resolveCallFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("call_flags")
      .update({ resolved: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
