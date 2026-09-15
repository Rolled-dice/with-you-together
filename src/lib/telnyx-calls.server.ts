/** Runtime helpers for the Telnyx call flow and the agent CRM. */

import {
  agentSipUri,
  bridge,
  dial,
  hangup,
  mintAgentToken,
  startRecording,
  telnyxConfig,
  transfer,
} from "@/lib/telnyx.server";

type Ctx = { supabase: any; userId: string };

export async function requireAgent(context: Ctx) {
  const { data: agent } = await context.supabase
    .from("call_agents")
    .select("id, name, is_active")
    .eq("user_id", context.userId)
    .maybeSingle();
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!agent && !isAdmin) throw new Error("You are not set up as a call agent");
  return { agent, isAdmin: Boolean(isAdmin) };
}

export function requireConfig() {
  const cfg = telnyxConfig();
  if (!cfg) {
    throw new Error(
      "Calling isn't connected yet. Add your Telnyx API key, call control app and phone number to start dialling.",
    );
  }
  return cfg;
}

export async function softphoneToken() {
  const cfg = requireConfig();
  const token = await mintAgentToken(cfg);
  return { token, expiresInSeconds: 600 };
}

/**
 * Starts a call: dials the agent's browser softphone first, then the member's
 * phone once the agent leg answers (handled in the webhook).
 */
export async function startBookingCall(context: Ctx, bookingId: string) {
  const cfg = requireConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: booking, error } = await context.supabase
    .from("listener_bookings")
    .select("id, user_id, agent_id, crm_state, contact_phone")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Booking not found");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone, full_name, display_name")
    .eq("id", booking.user_id)
    .maybeSingle();
  const memberPhone =
    ((booking as any).contact_phone as string | null)?.trim() || profile?.phone?.trim();
  if (!memberPhone)
    throw new Error(
      "No number to call. Add a call-back number on this booking (Admin → Calls) or on the member's profile.",
    );


  // Clear out member legs left over from earlier attempts, otherwise the
  // webhook cannot tell which one to dial and skips the member entirely.
  await supabaseAdmin
    .from("call_legs")
    .update({ state: "ended", ended_at: new Date().toISOString(), hangup_cause: "superseded" })
    .eq("booking_id", bookingId)
    .eq("leg_role", "member")
    .eq("state", "pending");

  const sip = await agentSipUri(cfg);
  const agentLeg = await dial(cfg, sip, { bookingId, legRole: "agent" });

  await supabaseAdmin.from("call_legs").insert({
    booking_id: bookingId,
    leg_role: "agent",
    direction: "outbound",
    phone: sip,
    call_control_id: agentLeg.call_control_id,
    call_session_id: agentLeg.call_session_id,
    call_leg_id: agentLeg.call_leg_id,
    state: "dialing",
    started_at: new Date().toISOString(),
  });

  // Remember the member number so the webhook can dial it on answer.
  await supabaseAdmin.from("call_legs").insert({
    booking_id: bookingId,
    leg_role: "member",
    direction: "outbound",
    phone: memberPhone,
    state: "pending",
  });

  await supabaseAdmin.from("call_events").insert({
    booking_id: bookingId,
    event_type: "call.started",
    detail: { agent_leg: agentLeg.call_control_id, member_phone_masked: mask(memberPhone) },
    actor: context.userId,
  });
  await supabaseAdmin
    .from("listener_bookings")
    .update({ crm_state: "in_call", call_started_at: new Date().toISOString() })
    .eq("id", bookingId);

  return { ok: true, memberPhone: mask(memberPhone) };
}

export async function hangupBookingCall(context: Ctx, bookingId: string) {
  const cfg = requireConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: legs } = await supabaseAdmin
    .from("call_legs")
    .select("id, call_control_id")
    .eq("booking_id", bookingId)
    .is("ended_at", null);
  for (const leg of legs ?? []) {
    if (!leg.call_control_id) continue;
    try {
      await hangup(cfg, leg.call_control_id);
    } catch (e) {
      console.error("hangup failed", e);
    }
  }
  await supabaseAdmin.from("call_events").insert({
    booking_id: bookingId,
    event_type: "call.hangup_requested",
    detail: {},
    actor: context.userId,
  });
  return { ok: true };
}

export async function transferBookingCall(context: Ctx, bookingId: string, to: string) {
  const cfg = requireConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leg } = await supabaseAdmin
    .from("call_legs")
    .select("call_control_id")
    .eq("booking_id", bookingId)
    .eq("leg_role", "member")
    .is("ended_at", null)
    .maybeSingle();
  if (!leg?.call_control_id) throw new Error("No active member leg to transfer");
  await transfer(cfg, leg.call_control_id, to);
  await supabaseAdmin.from("call_events").insert({
    booking_id: bookingId,
    event_type: "call.transferred",
    detail: { to: mask(to) },
    actor: context.userId,
  });
  return { ok: true };
}

/** Webhook driver: reacts to Telnyx call control events. */
export async function handleTelnyxEvent(payload: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decodeClientState } = await import("@/lib/telnyx.server");

  const event = payload?.data?.event_type as string | undefined;
  const p = payload?.data?.payload ?? {};
  const state = decodeClientState(p.client_state) as { b?: string; r?: string; v?: number; c?: string };
  const bookingId = state.b;
  const legRole = state.r;

  // Voice OTP calls: speak the code, then hang up. No booking involved.
  if (state.v && state.c && p.call_control_id) {
    const { speakVerificationCode, hangupCall } = await import("@/lib/phone-verify.server");
    if (event === "call.answered") {
      await speakVerificationCode(p.call_control_id, state.c);
    } else if (event === "call.speak.ended") {
      await hangupCall(p.call_control_id);
    }
    return { ok: true };
  }

  if (!event || !bookingId) return { ignored: true };

  await supabaseAdmin.from("call_events").insert({
    booking_id: bookingId,
    event_type: `telnyx.${event}`,
    detail: { leg_role: legRole ?? null, call_control_id: p.call_control_id ?? null },
  });

  const now = new Date().toISOString();

  if (event === "call.answered" && legRole === "agent") {
    await supabaseAdmin
      .from("call_legs")
      .update({ state: "answered", answered_at: now })
      .eq("call_control_id", p.call_control_id);

    const cfg = telnyxConfig();
    const { data: memberLegs } = await supabaseAdmin
      .from("call_legs")
      .select("id, phone")
      .eq("booking_id", bookingId)
      .eq("leg_role", "member")
      .eq("state", "pending")
      .order("created_at", { ascending: false })
      .limit(1);
    const memberLeg = memberLegs?.[0];
    if (!cfg || !memberLeg?.phone) {
      await supabaseAdmin.from("call_events").insert({
        booking_id: bookingId,
        event_type: "member_dial_skipped",
        detail: { reason: !cfg ? "telnyx_not_configured" : "no_pending_member_leg" },
      });
      return { ok: true };
    }
    try {
      const leg = await dial(cfg, memberLeg.phone, {
        bookingId,
        legRole: "member",
        sessionId: p.call_session_id,
      });
      await supabaseAdmin
        .from("call_legs")
        .update({
          call_control_id: leg.call_control_id,
          call_session_id: leg.call_session_id,
          call_leg_id: leg.call_leg_id,
          state: "dialing",
          started_at: now,
        })
        .eq("id", memberLeg.id);
    } catch (e) {
      console.error("member dial failed", e);
      await supabaseAdmin.from("call_events").insert({
        booking_id: bookingId,
        event_type: "member_dial_failed",
        detail: { error: e instanceof Error ? e.message : "dial failed" },
      });
      await supabaseAdmin
        .from("call_legs")
        .update({ state: "ended", ended_at: now, hangup_cause: "dial_failed" })
        .eq("id", memberLeg.id);
    }
    return { ok: true };
  }

  if (event === "call.answered" && legRole === "member") {
    await supabaseAdmin
      .from("call_legs")
      .update({ state: "answered", answered_at: now })
      .eq("call_control_id", p.call_control_id);

    const cfg = telnyxConfig();
    const { data: agentLeg } = await supabaseAdmin
      .from("call_legs")
      .select("call_control_id")
      .eq("booking_id", bookingId)
      .eq("leg_role", "agent")
      .is("ended_at", null)
      .maybeSingle();
    if (cfg && agentLeg?.call_control_id && p.call_control_id) {
      await bridge(cfg, p.call_control_id, agentLeg.call_control_id);
      try {
        await startRecording(cfg, p.call_control_id);
      } catch (e) {
        console.error("record start failed", e);
      }
    }
    return { ok: true };
  }

  if (event === "call.hangup") {
    await supabaseAdmin
      .from("call_legs")
      .update({ state: "ended", ended_at: now, hangup_cause: p.hangup_cause ?? null })
      .eq("call_control_id", p.call_control_id);

    // When one side drops, drop the other immediately, an orphan leg keeps
    // billing minutes for a conversation that can no longer happen.
    const cfgHangup = telnyxConfig();
    if (cfgHangup) {
      const { data: others } = await supabaseAdmin
        .from("call_legs")
        .select("id, call_control_id")
        .eq("booking_id", bookingId)
        .neq("call_control_id", p.call_control_id)
        .is("ended_at", null);
      for (const other of others ?? []) {
        if (!other.call_control_id) continue;
        try {
          await hangup(cfgHangup, other.call_control_id);
        } catch {
          /* already gone */
        }
        await supabaseAdmin
          .from("call_legs")
          .update({ state: "ended", ended_at: now, hangup_cause: "peer_hangup" })
          .eq("id", other.id);
      }
    }

    const { data: open } = await supabaseAdmin
      .from("call_legs")
      .select("id")
      .eq("booking_id", bookingId)
      .is("ended_at", null);
    if (!open || open.length === 0) {
      await supabaseAdmin
        .from("listener_bookings")
        .update({ call_ended_at: now, crm_state: "completed", status: "completed" })
        .eq("id", bookingId);
    }
    return { ok: true };
  }

  if (event === "call.recording.saved") {
    await supabaseAdmin.from("call_recordings").insert({
      booking_id: bookingId,
      recording_id: p.recording_id ?? null,
      channels: p.channels ?? null,
      format: p.format ?? null,
      url: p.public_recording_urls?.mp3 ?? p.recording_urls?.mp3 ?? null,
      duration_seconds: p.duration_millis ? Math.round(p.duration_millis / 1000) : null,
      recorded_at: now,
    });
    return { ok: true };
  }

  return { ok: true };
}

function mask(phone: string) {
  return phone.length > 4 ? `${"•".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : phone;
}
