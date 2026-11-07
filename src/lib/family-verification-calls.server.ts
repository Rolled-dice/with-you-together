import { agentSipUri, bridge, dial, hangup, telnyxConfig } from "@/lib/telnyx.server";
import { requireAgent } from "@/lib/telnyx-calls.server";

type Context = { supabase: any; userId: string };
type CallEvent = {
  call_control_id?: string;
  call_session_id?: string;
  hangup_cause?: string;
};

const activeStatuses = ["starting", "dialing_agent", "dialing_invitee", "in_call"];

export async function startFamilyInvitationCall(context: Context, invitationId: string) {
  await requireAgent(context);
  const cfg = telnyxConfig();
  if (!cfg) throw new Error("Telnyx calling is not configured.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: invitation, error: invitationError } = await db
    .from("family_invitations")
    .select("id, call_phone, status, attempts, consent_at, expires_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (invitationError) throw new Error(invitationError.message);
  if (
    !invitation ||
    invitation.status !== "verification_pending" ||
    invitation.consent_at ||
    !invitation.call_phone ||
    invitation.attempts >= 3 ||
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    throw new Error("This family invitation is not available for a verification call.");
  }

  const { data: session, error: sessionError } = await db
    .from("family_invitation_call_sessions")
    .insert({ invitation_id: invitationId, agent_user_id: context.userId })
    .select("id")
    .single();
  if (sessionError) {
    if (sessionError.code === "23505") {
      throw new Error("A verification call is already in progress for this invitation.");
    }
    throw new Error(sessionError.message);
  }

  try {
    const sip = await agentSipUri(cfg);
    const agentLeg = await dial(cfg, sip, {
      familyInvitationId: invitationId,
      verificationSessionId: session.id,
      legRole: "agent",
    });
    const { error: updateError } = await db
      .from("family_invitation_call_sessions")
      .update({ status: "dialing_agent", agent_call_control_id: agentLeg.call_control_id })
      .eq("id", session.id);
    if (updateError) {
      await hangup(cfg, agentLeg.call_control_id).catch(() => undefined);
      throw updateError;
    }
    return { session_id: session.id, status: "dialing_agent" as const };
  } catch (error) {
    await db
      .from("family_invitation_call_sessions")
      .update({ status: "failed", error_code: "start_failed", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    throw new Error(error instanceof Error ? error.message : "Could not start the verification call.");
  }
}

export async function handleFamilyInvitationCallEvent(
  event: string,
  sessionId: string,
  invitationId: string,
  legRole: string,
  payload: CallEvent,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: session, error } = await db
    .from("family_invitation_call_sessions")
    .select("id, invitation_id, status, agent_call_control_id, invitee_call_control_id")
    .eq("id", sessionId)
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || !payload.call_control_id) return { ignored: true };

  const cfg = telnyxConfig();
  if (!cfg) throw new Error("Telnyx calling is not configured.");

  if (event === "call.answered" && legRole === "agent") {
    const { data: claimed, error: claimError } = await db
      .from("family_invitation_call_sessions")
      .update({ status: "dialing_invitee" })
      .eq("id", session.id)
      .eq("status", "dialing_agent")
      .eq("agent_call_control_id", payload.call_control_id)
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) return { ok: true };

    const { data: invitation, error: inviteError } = await db
      .from("family_invitations")
      .select("call_phone, status, consent_at, expires_at")
      .eq("id", invitationId)
      .maybeSingle();
    if (
      inviteError ||
      !invitation ||
      invitation.status !== "verification_pending" ||
      invitation.consent_at ||
      !invitation.call_phone ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      await db
        .from("family_invitation_call_sessions")
        .update({ status: "failed", error_code: "invitation_unavailable", ended_at: new Date().toISOString() })
        .eq("id", session.id);
      await hangup(cfg, payload.call_control_id);
      return { ok: true };
    }

    try {
      const inviteeLeg = await dial(cfg, invitation.call_phone, {
        familyInvitationId: invitationId,
        verificationSessionId: session.id,
        legRole: "member",
        sessionId: payload.call_session_id,
      });
      const { error: updateError } = await db
        .from("family_invitation_call_sessions")
        .update({ invitee_call_control_id: inviteeLeg.call_control_id })
        .eq("id", session.id)
        .eq("status", "dialing_invitee");
      if (updateError) throw updateError;
    } catch (dialError) {
      await db
        .from("family_invitation_call_sessions")
        .update({ status: "failed", error_code: "invitee_dial_failed", ended_at: new Date().toISOString() })
        .eq("id", session.id);
      await hangup(cfg, payload.call_control_id).catch(() => undefined);
      throw dialError;
    }
    return { ok: true };
  }

  if (event === "call.answered" && legRole === "member") {
    const { data: claimed, error: claimError } = await db
      .from("family_invitation_call_sessions")
      .update({ status: "in_call", connected_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("status", "dialing_invitee")
      .eq("invitee_call_control_id", payload.call_control_id)
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed || !session.agent_call_control_id) return { ok: true };
    try {
      await bridge(cfg, payload.call_control_id, session.agent_call_control_id);
    } catch (bridgeError) {
      await db
        .from("family_invitation_call_sessions")
        .update({ status: "failed", error_code: "bridge_failed", ended_at: new Date().toISOString() })
        .eq("id", session.id);
      await Promise.all([
        hangup(cfg, payload.call_control_id).catch(() => undefined),
        hangup(cfg, session.agent_call_control_id).catch(() => undefined),
      ]);
      throw bridgeError;
    }
    return { ok: true };
  }

  if (event === "call.hangup") {
    const isAgentLeg = session.agent_call_control_id === payload.call_control_id;
    const isInviteeLeg = session.invitee_call_control_id === payload.call_control_id;
    if (!isAgentLeg && !isInviteeLeg) return { ignored: true };

    const { data: ended, error: endError } = await db
      .from("family_invitation_call_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", session.id)
      .in("status", activeStatuses)
      .select("id")
      .maybeSingle();
    if (endError) throw new Error(endError.message);
    if (ended) {
      const otherLeg = isAgentLeg
        ? session.invitee_call_control_id
        : session.agent_call_control_id;
      if (otherLeg) await hangup(cfg, otherLeg).catch(() => undefined);
    }
  }
  return { ok: true };
}
