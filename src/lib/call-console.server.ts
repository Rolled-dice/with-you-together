/** Agent workspace + supervisor board data for the call CRM. */

type Ctx = { supabase: any; userId: string };

async function myAgent(context: Ctx) {
  const { data, error } = await context.supabase
    .from("call_agents")
    .select("id, name, timezone, skills, max_concurrent, is_active")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function isAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

export async function listMyQueue(context: Ctx) {
  const agent = await myAgent(context);
  if (!agent) return { agent: null, rows: [] as any[] };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("listener_bookings")
    .select("id, user_id, requested_at, duration_minutes, note, status, crm_state, sla_deadline")
    .eq("agent_id", agent.id)
    .in("crm_state", ["assigned", "confirmed", "in_call", "escalated"])
    .in("status", ["requested", "confirmed"])
    .order("requested_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((r: any) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name")
      .in("id", ids);
    for (const p of profiles ?? []) {
      names.set(p.id, p.display_name ?? p.full_name ?? "Member");
    }
  }

  return {
    agent,
    rows: (data ?? []).map((r: any) => ({ ...r, member_name: names.get(r.user_id) ?? "Member" })),
  };
}

export async function agentScreenPop(context: Ctx, bookingId: string) {
  const agent = await myAgent(context);
  const admin = await isAdmin(context);
  if (!agent && !admin) throw new Error("Not authorised");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: booking } = await supabaseAdmin
    .from("listener_bookings")
    .select(
      "id, user_id, agent_id, requested_at, duration_minutes, note, status, crm_state, sla_deadline, rating, feedback_note",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found");
  if (!admin && booking.agent_id !== agent?.id) throw new Error("Not your call");

  const [{ data: profile }, { data: history }, { data: flags }, { data: legs }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name, phone, timezone, pronouns, care_tier, care_intent")
      .eq("id", booking.user_id)
      .maybeSingle(),
    supabaseAdmin
      .from("listener_bookings")
      .select("id, requested_at, crm_state, rating")
      .eq("user_id", booking.user_id)
      .neq("id", bookingId)
      .order("requested_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("call_flags")
      .select("id, kind, severity, note, resolved, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("call_legs")
      .select("id, leg_role, state, phone, started_at, answered_at, ended_at, hangup_cause")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    booking,
    member: profile
      ? {
          ...profile,
          phone: profile.phone ? maskPhone(profile.phone) : null,
        }
      : null,
    history: history ?? [],
    flags: flags ?? [],
    legs: legs ?? [],
  };
}

export async function callTimeline(context: Ctx, bookingId: string) {
  const agent = await myAgent(context);
  const admin = await isAdmin(context);
  if (!agent && !admin) throw new Error("Not authorised");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: events }, { data: recordings }, { data: dispositions }] = await Promise.all([
    supabaseAdmin
      .from("call_events")
      .select("id, event_type, detail, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("call_recordings")
      .select("id, url, duration_seconds, recorded_at")
      .eq("booking_id", bookingId)
      .order("recorded_at", { ascending: false }),
    supabaseAdmin
      .from("call_dispositions")
      .select("id, outcome, follow_up_needed, safety_concern, notes, wrap_up_seconds, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    events: events ?? [],
    recordings: recordings ?? [],
    dispositions: dispositions ?? [],
  };
}

export async function setPresence(
  context: Ctx,
  state: "available" | "on_call" | "wrap_up" | "offline",
  bookingId: string | null,
) {
  const agent = await myAgent(context);
  if (!agent) throw new Error("You are not set up as a call agent");
  const { error } = await context.supabase.from("agent_presence").upsert(
    {
      agent_id: agent.id,
      state,
      active_booking_id: bookingId,
      last_heartbeat_at: new Date().toISOString(),
    },
    { onConflict: "agent_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true, state };
}

export async function saveDisposition(
  context: Ctx,
  data: {
    booking_id: string;
    outcome: string;
    follow_up_needed: boolean;
    safety_concern: boolean;
    notes: string;
    wrap_up_seconds?: number;
  },
) {
  const agent = await myAgent(context);
  const admin = await isAdmin(context);
  if (!agent && !admin) throw new Error("Not authorised");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("call_dispositions").insert({
    booking_id: data.booking_id,
    agent_id: agent?.id ?? null,
    outcome: data.outcome,
    follow_up_needed: data.follow_up_needed,
    safety_concern: data.safety_concern,
    notes: data.notes || null,
    wrap_up_seconds: data.wrap_up_seconds ?? null,
    created_by: context.userId,
  });
  if (error) throw new Error(error.message);

  const nextState =
    data.outcome === "connected" ? "completed" : data.outcome === "no_answer" ? "missed" : "completed";
  await supabaseAdmin
    .from("listener_bookings")
    .update({ crm_state: nextState })
    .eq("id", data.booking_id);

  if (data.safety_concern) {
    await supabaseAdmin.from("call_flags").insert({
      booking_id: data.booking_id,
      kind: "safety",
      severity: "urgent",
      note: data.notes || "Safety concern raised on the call",
      raised_by: context.userId,
    });
  }

  await supabaseAdmin.from("call_events").insert({
    booking_id: data.booking_id,
    event_type: "call.disposition",
    detail: { outcome: data.outcome, follow_up: data.follow_up_needed },
    actor: context.userId,
  });

  return { ok: true };
}

export async function supervisorSnapshot(context: Ctx) {
  if (!(await isAdmin(context))) throw new Error("Admins only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: agents }, { data: presence }, { data: legs }, { data: recent }] =
    await Promise.all([
      supabaseAdmin.from("call_agents").select("id, name, is_active, timezone, skills"),
      supabaseAdmin.from("agent_presence").select("agent_id, state, active_booking_id, last_heartbeat_at"),
      supabaseAdmin
        .from("call_legs")
        .select("booking_id, leg_role, state, answered_at, started_at")
        .is("ended_at", null),
      supabaseAdmin
        .from("listener_bookings")
        .select("id, agent_id, crm_state, requested_at, call_started_at, call_ended_at")
        .gte("requested_at", since),
    ]);

  const presenceByAgent = new Map<string, any>(
    (presence ?? []).map((p: any) => [p.agent_id, p]),
  );
  const roster = (agents ?? []).map((a: any) => ({
    ...a,
    presence: presenceByAgent.get(a.id)?.state ?? "offline",
    active_booking_id: presenceByAgent.get(a.id)?.active_booking_id ?? null,
    last_heartbeat_at: presenceByAgent.get(a.id)?.last_heartbeat_at ?? null,
  }));

  const rows = recent ?? [];
  const completed = rows.filter((r: any) => r.crm_state === "completed");
  const missed = rows.filter((r: any) => r.crm_state === "missed");
  const escalated = rows.filter((r: any) => r.crm_state === "escalated");
  const talkSeconds = completed
    .filter((r: any) => r.call_started_at && r.call_ended_at)
    .map((r: any) => (Date.parse(r.call_ended_at) - Date.parse(r.call_started_at)) / 1000);
  const avgTalk = talkSeconds.length
    ? Math.round(talkSeconds.reduce((a: number, b: number) => a + b, 0) / talkSeconds.length)
    : 0;

  const perAgent = new Map<string, number>();
  for (const r of rows) {
    if (r.agent_id) perAgent.set(r.agent_id, (perAgent.get(r.agent_id) ?? 0) + 1);
  }

  return {
    roster,
    liveLegs: legs ?? [],
    queueDepth: rows.filter((r: any) => ["requested", "assigned", "confirmed"].includes(r.crm_state))
      .length,
    metrics: {
      total: rows.length,
      completed: completed.length,
      missed: missed.length,
      escalated: escalated.length,
      answerRate: rows.length ? Math.round((completed.length / rows.length) * 100) : 0,
      breachRate: rows.length ? Math.round((escalated.length / rows.length) * 100) : 0,
      avgTalkSeconds: avgTalk,
      perAgent: [...perAgent.entries()].map(([agent_id, count]) => ({ agent_id, count })),
    },
  };
}

export async function getRoutingRules(context: Ctx) {
  if (!(await isAdmin(context))) throw new Error("Admins only");
  const { data, error } = await context.supabase
    .from("routing_rules")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { rules: data };
}

export async function updateRoutingRules(context: Ctx, data: Record<string, unknown> & { id: string }) {
  if (!(await isAdmin(context))) throw new Error("Admins only");
  const { id, ...patch } = data;
  const { error } = await context.supabase.from("routing_rules").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

function maskPhone(phone: string) {
  return phone.length > 4 ? `${"•".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : phone;
}
