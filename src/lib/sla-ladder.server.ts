import { slaLevel, type CrmState } from "@/lib/call-crm";

type LadderKind = "sla_t90" | "sla_t60" | "sla_breach";

const COPY: Record<LadderKind, { severity: string; title: string; body: (when: string) => string }> = {
  sla_t90: {
    severity: "warning",
    title: "Your listener call is in 90 minutes",
    body: (when) => `We'll call your phone at ${when}. Find a quiet spot when you can.`,
  },
  sla_t60: {
    severity: "warning",
    title: "One hour until your listener call",
    body: (when) => `Your call is scheduled for ${when}. Keep your phone nearby.`,
  },
  sla_breach: {
    severity: "critical",
    title: "Your call time has passed",
    body: (when) =>
      `Your call was due at ${when} and hasn't started. Our team has been alerted and will reach you shortly.`,
  },
};

/**
 * Evaluates the notification ladder (T-90m, T-60m, past SLA) for upcoming
 * scheduled calls and writes de-duplicated notifications. Breaches also escalate
 * the booking in the CRM and raise an admin flag.
 */
export async function evaluateSlaLadder(_client: unknown, userId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const horizon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const floor = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let q = supabaseAdmin
    .from("listener_bookings")
    .select("id, user_id, requested_at, crm_state, status")
    .in("status", ["requested", "confirmed"])
    .gte("requested_at", floor)
    .lte("requested_at", horizon);
  if (userId) q = q.eq("user_id", userId);

  const { data: bookings, error } = await q;
  if (error) throw new Error(error.message);

  let created = 0;
  let escalated = 0;

  for (const b of bookings ?? []) {
    const level = slaLevel(b.requested_at, (b.crm_state ?? "requested") as CrmState);
    const kind: LadderKind | null =
      level === "breached" ? "sla_breach" : level === "urgent" ? "sla_t60" : level === "warn" ? "sla_t90" : null;
    if (!kind) continue;

    const when = new Date(b.requested_at).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    const copy = COPY[kind];

    const { error: insErr } = await supabaseAdmin.from("notifications").insert({
      user_id: b.user_id,
      booking_id: b.id,
      kind,
      severity: copy.severity,
      title: copy.title,
      body: copy.body(when),
    });
    if (!insErr) created += 1;

    if (kind === "sla_breach" && b.crm_state !== "escalated") {
      await supabaseAdmin
        .from("listener_bookings")
        .update({ crm_state: "escalated" })
        .eq("id", b.id);
      await supabaseAdmin.from("call_flags").insert({
        booking_id: b.id,
        kind: "sla_breach",
        severity: "urgent",
        note: `Call due ${b.requested_at} did not start.`,
      });
      escalated += 1;
    }
  }

  return { checked: bookings?.length ?? 0, created, escalated };
}
