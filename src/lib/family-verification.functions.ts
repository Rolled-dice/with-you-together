import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAgent } from "@/lib/telnyx-calls.server";
import { startFamilyInvitationCall } from "@/lib/family-verification-calls.server";
import { z } from "zod";

type StoredVerificationInvitation = {
  id: string;
  email: string | null;
  invitee_name: string;
  call_phone: string | null;
  attempts: number;
  created_at: string;
  expires_at: string;
  token: string;
  family_id: string;
  invited_by: string;
  consent_at: string | null;
  families?: { name: string } | null;
};

export const getFamilyVerificationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAgent(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("family_invitations")
      .select("*, families(name)")
      .eq("status", "verification_pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);

    const pending = ((data ?? []) as unknown as StoredVerificationInvitation[]).filter(
      (row) => !row.consent_at && row.call_phone,
    );
    const { data: sessions, error: sessionError } = pending.length
      ? await (supabaseAdmin as any)
          .from("family_invitation_call_sessions")
          .select("id, invitation_id, status, created_at")
          .in(
            "invitation_id",
            pending.map((row) => row.id),
          )
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (sessionError) throw new Error(sessionError.message);
    const latestSession = new Map<string, { id: string; status: string; created_at: string }>();
    for (const session of sessions ?? []) {
      if (!latestSession.has(session.invitation_id)) {
        latestSession.set(session.invitation_id, {
          id: session.id,
          status: session.status,
          created_at: session.created_at,
        });
      }
    }
    const inviterIds = [...new Set(pending.map((row) => row.invited_by))];
    const { data: profiles, error: profileError } = inviterIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, full_name")
          .in("id", inviterIds)
      : { data: [], error: null };
    if (profileError) throw new Error(profileError.message);
    const inviterNames = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.display_name || profile.full_name || "Family owner",
      ]),
    );

    return pending.map((row) => ({
      id: row.id,
      email: row.email ?? "",
      invitee_name: row.invitee_name,
      invitee_phone: row.call_phone,
      verification_attempts: row.attempts,
      call_status: latestSession.get(row.id)?.status ?? null,
      call_session_id: latestSession.get(row.id)?.id ?? null,
      call_started_at: latestSession.get(row.id)?.created_at ?? null,
      created_at: row.created_at,
      expires_at: row.expires_at,
      token: row.token,
      family_name: row.families?.name ?? "Family circle",
      inviter_name: inviterNames.get(row.invited_by) ?? "Family owner",
    }));
  });

const StartCallInput = z.object({ invitation_id: z.string().uuid() });

export const startFamilyVerificationCallFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartCallInput.parse(input))
  .handler(async ({ context, data }) =>
    startFamilyInvitationCall(context as never, data.invitation_id),
  );

const RecordCallInput = z.object({
  invitation_id: z.string().uuid(),
  call_session_id: z.string().uuid(),
  outcome: z.enum([
    "connected_yes",
    "connected_no",
    "no_answer",
    "voicemail",
    "wrong_number",
    "tech_failure",
  ]),
  verbal_consent: z.boolean(),
  notes: z.string().max(1000).default(""),
});

export const recordFamilyVerificationCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecordCallInput.parse(input))
  .handler(async ({ context, data }) => {
    await requireAgent(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: callSession, error: callSessionError } = await (supabaseAdmin as any)
      .from("family_invitation_call_sessions")
      .select("status")
      .eq("id", data.call_session_id)
      .eq("invitation_id", data.invitation_id)
      .eq("agent_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (callSessionError) throw new Error(callSessionError.message);
    if (!callSession || !["ended", "failed"].includes(callSession.status)) {
      throw new Error("Start and finish the Telnyx call before saving its outcome.");
    }
    if (callSession.status === "failed" && data.outcome !== "tech_failure") {
      throw new Error("This call failed technically; record it as a technical failure.");
    }
    const recordCall = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      functionName: string,
      args: {
        p_invitation_id: string;
        p_agent_user_id: string;
        p_outcome: string;
        p_verbal_consent: boolean;
        p_notes: string;
      },
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: result, error } = await recordCall("record_family_invitation_call", {
      p_invitation_id: data.invitation_id,
      p_agent_user_id: context.userId,
      p_outcome: data.outcome,
      p_verbal_consent: data.verbal_consent,
      p_notes: data.notes.trim(),
    });
    if (error) throw new Error(error.message);

    const resultData = result as {
      verification_status: string;
      member_added: boolean;
      email: string | null;
      token: string;
    };
    if (resultData.verification_status === "approved") {
      const [{ data: invitation }, { data: agent }] = await Promise.all([
        supabaseAdmin
          .from("family_invitations")
          .select("family_id, invited_by")
          .eq("id", data.invitation_id)
          .single(),
        supabaseAdmin
          .from("profiles")
          .select("display_name")
          .eq("id", context.userId)
          .maybeSingle(),
      ]);
      const { data: family } = invitation
        ? await supabaseAdmin
            .from("families")
            .select("name")
            .eq("id", invitation.family_id)
            .maybeSingle()
        : { data: null };
      const { data: inviter } = invitation
        ? await supabaseAdmin
            .from("profiles")
            .select("display_name")
            .eq("id", invitation.invited_by)
            .maybeSingle()
        : { data: null };
      const siteUrl = (process.env.PUBLIC_SITE_URL || "https://www.someonenear.com").replace(
        /\/+$/,
        "",
      );
      const { sendFamilyInvitationEmail } = await import("@/lib/family-invitation-email.server");
      const approvalEmailSent = resultData.email
        ? await sendFamilyInvitationEmail({
            to: resultData.email,
            familyName: family?.name || "your family circle",
            inviterName: inviter?.display_name || agent?.display_name || "Someone in your family",
            role: "adult",
            inviteUrl: `${siteUrl}/invite?token=${encodeURIComponent(resultData.token)}`,
            approved: true,
          })
        : false;
      return { ...resultData, approval_email_sent: approvalEmailSent };
    }
    if (["declined", "closed"].includes(resultData.verification_status)) {
      const { data: invitation, error: invitationError } = await (supabaseAdmin as any)
        .from("family_invitations")
        .select("family_id, invited_by, attempts, call_phone, invitee_name")
        .eq("id", data.invitation_id)
        .single();
      if (invitationError) throw new Error(invitationError.message);
      const [{ data: family }, { data: ownerProfile }, ownerAuth] = await Promise.all([
        supabaseAdmin
          .from("families")
          .select("name")
          .eq("id", invitation.family_id)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("display_name, full_name")
          .eq("id", invitation.invited_by)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(invitation.invited_by),
      ]);
      const { sendFamilyInvitationSupportAlert } = await import(
        "@/lib/family-invitation-email.server"
      );
      const supportEmailSent = await sendFamilyInvitationSupportAlert({
        familyName: family?.name || "Family circle",
        inviteeName: invitation.invitee_name,
        inviteePhone: invitation.call_phone || "Not available",
        ownerName: ownerProfile?.display_name || ownerProfile?.full_name || "Family admin",
        ownerEmail: ownerAuth.data.user?.email ?? null,
        outcome:
          resultData.verification_status === "declined" ? "declined" : "verification_closed",
        attempts: invitation.attempts,
      });
      return { ...resultData, support_email_sent: supportEmailSent };
    }
    return { ...resultData, approval_email_sent: null };
  });
