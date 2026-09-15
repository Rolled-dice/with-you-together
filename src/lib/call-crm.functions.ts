import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  CRM_STATES,
  FLAG_KINDS,
  FLAG_SEVERITIES,
  type CallAgent,
  type CallFlag,
  type CrmState,
  type QueueRow,
} from "@/lib/call-crm";
import {
  assertAdmin,
  extractSkills,
  logCallEvent,
  scoreAgents,
} from "@/lib/call-crm.server";

export const listCallQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: bookings, error }, { data: agents }, { data: flags }] =
      await Promise.all([
        context.supabase
          .from("listener_bookings")
          .select(
            "id, user_id, requested_at, duration_minutes, note, status, crm_state, sla_deadline, agent_id, contact_phone, listeners(name)",
          )
          .order("requested_at", { ascending: true })
          .limit(500),
        context.supabase.from("call_agents").select("id, name"),
        context.supabase.from("call_flags").select("booking_id").eq("resolved", false),
      ]);
    if (error) throw new Error(error.message);

    const agentName = new Map<string, string>(
      ((agents ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]),
    );
    const flagCount = new Map<string, number>();
    for (const f of (flags ?? []) as { booking_id: string }[]) {
      flagCount.set(f.booking_id, (flagCount.get(f.booking_id) ?? 0) + 1);
    }

    // Member profile numbers (fallback dial target) via the admin client.
    const userIds = Array.from(new Set(((bookings ?? []) as any[]).map((b) => b.user_id)));
    const profilePhone = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, phone")
        .in("id", userIds);
      for (const p of (profiles ?? []) as { id: string; phone: string | null }[]) {
        profilePhone.set(p.id, p.phone);
      }
    }

    const rows: QueueRow[] = ((bookings ?? []) as any[]).map((b) => ({
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
      contact_phone: b.contact_phone ?? null,
      profile_phone: profilePhone.get(b.user_id) ?? null,
    }));
    return { rows };
  });

export const setBookingContactPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        contact_phone: z
          .string()
          .trim()
          .regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +919999612799")
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({ contact_phone: data.contact_phone })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logCallEvent(context, data.id, "contact_phone_updated", {
      set: Boolean(data.contact_phone),
    });
    return { ok: true };
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

export const upsertCallAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
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
      })
      .parse(input),
  )
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
    const tooLate = startsAt.getTime() - Date.now() < 2 * 60 * 60 * 1000;

    const { data: agentRows, error: aerr } = await context.supabase
      .from("call_agents")
      .select(
        "id, name, email, phone, timezone, skills, work_start, work_end, max_concurrent, is_active",
      );
    if (aerr) throw new Error(aerr.message);

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

    const ranked = scoreAgents((agentRows ?? []) as CallAgent[], {
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
        kind: "other",
        severity: tooLate ? "urgent" : "high",
        note: "No eligible agent available (capacity reached or roster empty).",
        raised_by: context.userId,
      });
      await logCallEvent(context, data.id, "assignment_failed", {
        reason: "no_eligible_agent",
      });
      return { ok: false, reason: "No eligible agent, booking flagged for admin." };
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
    await logCallEvent(context, data.id, "assigned", {
      agent_id: winner.agent.id,
      score: winner.score,
      reasons: winner.reasons,
    });
    if (tooLate) {
      await context.supabase.from("call_flags").insert({
        booking_id: data.id,
        kind: "sla_breach",
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
    await logCallEvent(context, data.id, "assigned_manually", { agent_id: data.agent_id });
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
    await logCallEvent(context, data.id, "state_changed", { crm_state: data.crm_state });
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
        kind: z.enum(FLAG_KINDS),
        severity: z.enum(FLAG_SEVERITIES).default("normal"),
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
    await logCallEvent(context, data.booking_id, "flag_raised", { kind: data.kind });
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
