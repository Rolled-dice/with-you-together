import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_DISPLAY } from "@/lib/currency";
import { z } from "zod";

type StoredFamilyInvitation = {
  id: string;
  email: string | null;
  invitee_name: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  call_phone: string | null;
  attempts: number;
  consent_at: string | null;
  family_id: string;
  invited_by: string;
  families?: { name: string } | null;
};

function invitationState(invitation: Pick<StoredFamilyInvitation, "status" | "consent_at">) {
  if (invitation.status === "declined") return "declined";
  if (invitation.status === "verification_closed" || invitation.status === "expired") return "closed";
  if (invitation.status === "verification_pending") {
    return invitation.consent_at ? "approved" : "awaiting_call";
  }
  if (invitation.status === "active" || invitation.status === "accepted") return "approved";
  return "awaiting_call";
}

function toFamilyInvitationView(invitation: StoredFamilyInvitation) {
  return {
    id: invitation.id,
    email: invitation.email ?? "",
    invitee_name: invitation.invitee_name,
    invitee_phone: invitation.call_phone,
    role: invitation.role,
    status:
      invitation.status === "accepted"
        ? "accepted"
        : ["pending", "verification_pending", "active"].includes(invitation.status)
          ? "pending"
          : "revoked",
    verification_status: invitationState(invitation),
    verification_attempts: invitation.attempts,
    token: invitation.token,
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
  };
}

// ---- Read: my family (family + members + pending invites) ----
export const getMyFamily = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) return { family: null, members: [], invites: [], myRole: null };

    const { data: family, error: fErr } = await supabase
      .from("families")
      .select("id, name, owner_id, created_at")
      .eq("id", membership.family_id)
      .single();
    if (fErr) throw new Error(fErr.message);

    const { data: members, error: mErr } = await supabase
      .from("family_members")
      .select("id, user_id, role, joined_at")
      .eq("family_id", membership.family_id)
      .order("joined_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    // Fetch profile display names for members
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    const enriched = (members ?? []).map((m) => ({
      ...m,
      display_name: nameMap.get(m.user_id) ?? null,
    }));

    const isOwner = membership.role === "owner";
    let invites: Array<{
      id: string;
      email: string;
      invitee_name: string;
      invitee_phone: string | null;
      role: string;
      status: string;
      verification_status: string;
      verification_attempts: number;
      token: string;
      expires_at: string;
      created_at: string;
    }> = [];
    if (isOwner) {
      const { data: inv } = await supabase
        .from("family_invitations")
        .select("*")
        .eq("family_id", membership.family_id)
        .neq("status", "accepted")
        .order("created_at", { ascending: false });
      invites = ((inv ?? []) as unknown as StoredFamilyInvitation[]).map(toFamilyInvitationView);
    }

    return { family, members: enriched, invites, myRole: membership.role };
  });

// ---- Create family ----
const CreateInput = z.object({ name: z.string().min(1).max(80) });

export const createFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // A circle needs a paid plan. Kept as "any paid tier" to match the previous
    // behaviour — the retired `family` tier is simply dropped. Note that only
    // Care Plus actually sells a shared circle, so gating this to care_plus is a
    // product decision to make deliberately rather than a rename.
    const { data: prof } = await supabase
      .from("profiles")
      .select("care_tier")
      .eq("id", userId)
      .single();
    if (prof?.care_tier !== "care" && prof?.care_tier !== "care_plus") {
      throw new Error("A Care or Care Plus plan is required to create a family circle.");
    }

    // Ensure user isn't already in a family
    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("You're already in a family.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: fam, error: fErr } = await supabaseAdmin
      .from("families")
      .insert({ name: data.name, owner_id: userId })
      .select("id")
      .single();
    if (fErr) throw new Error(fErr.message);

    const { error: mErr } = await supabaseAdmin
      .from("family_members")
      .insert({ family_id: fam.id, user_id: userId, role: "owner" });
    if (mErr) throw new Error(mErr.message);

    return { id: fam.id };
  });

// ---- Update family name ----
const RenameInput = z.object({ name: z.string().min(1).max(80) });
export const renameFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RenameInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || mem.role !== "owner") throw new Error("Only the owner can rename.");
    const { error } = await supabase
      .from("families")
      .update({ name: data.name })
      .eq("id", mem.family_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Invite ----
const InviteInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
  phone: z
    .string()
    .trim()
    .transform((val) => val.replace(/[\s\-()]/g, ""))
    .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Use international format, such as +919876543210.")),
});

export const inviteFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => InviteInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || mem.role !== "owner")
      throw new Error("Only the family owner can invite members.");

    // Circle size comes from the plan catalogue. This was hardcoded to 4 while
    // Care Plus is sold as "up to 5 people", so the cap contradicted the offer.
    const maxMembers = PLAN_DISPLAY.care_plus.members;
    const { count: memberCount, error: memberCountError } = await supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", mem.family_id);
    if (memberCountError) throw new Error(memberCountError.message);

    const { count: pendingCount, error: pendingCountError } = await supabase
      .from("family_invitations")
      .select("id", { count: "exact", head: true })
      .eq("family_id", mem.family_id)
      .in("status", ["pending", "verification_pending"])
      .gt("expires_at", new Date().toISOString());
    if (pendingCountError) throw new Error(pendingCountError.message);

    if ((memberCount ?? 0) + (pendingCount ?? 0) >= maxMembers)
      throw new Error(`Family is full (max ${maxMembers} members).`);

    const email = data.email?.trim().toLowerCase() || null;
    const { data: matchingByPhone, error: matchingPhoneError } = await (supabase as any)
      .from("family_invitations")
      .select("id")
      .eq("family_id", mem.family_id)
      .eq("call_phone", data.phone)
      .in("status", ["pending", "verification_pending"])
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (matchingPhoneError) throw new Error(matchingPhoneError.message);
    if (matchingByPhone?.length)
      throw new Error("A pending invitation already exists for this mobile number.");

    if (email) {
      const { data: matchingByEmail, error: matchingEmailError } = await supabase
        .from("family_invitations")
        .select("id")
        .eq("family_id", mem.family_id)
        .eq("email", email)
        .in("status", ["pending", "verification_pending"])
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (matchingEmailError) throw new Error(matchingEmailError.message);
      if (matchingByEmail?.length)
        throw new Error("A pending invitation already exists for this email.");
    }

    const { data: inv, error } = await supabase
      .from("family_invitations")
      .insert({
        family_id: mem.family_id,
        email,
        invitee_name: data.name,
        call_phone: data.phone,
        contact_phone: data.phone,
        contact_channel: email ? "email" : "phone_call",
        status: "verification_pending",
        role: "adult",
        invited_by: userId,
      } as never)
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);

    const [{ data: family }, { data: inviter }] = await Promise.all([
      supabase.from("families").select("name").eq("id", mem.family_id).single(),
      supabase.from("profiles").select("display_name").eq("id", userId).single(),
    ]);
    const siteUrl = (process.env.PUBLIC_SITE_URL || "https://www.someonenear.com").replace(
      /\/+$/,
      "",
    );
    const inviteUrl = `${siteUrl}/invite?token=${encodeURIComponent(inv.token)}`;
    let emailSent: boolean | null = null;
    try {
      if (email) {
        const { sendFamilyInvitationEmail } = await import("@/lib/family-invitation-email.server");
        emailSent = await sendFamilyInvitationEmail({
          to: email,
          familyName: family?.name || "your family circle",
          inviterName: inviter?.display_name || "Someone in your family",
          role: "adult",
          inviteUrl,
        });
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("family_invitations")
        .update({
          delivery_status: emailSent === null ? "not_sent" : emailSent ? "sent" : "failed",
          last_sent_at: emailSent ? new Date().toISOString() : null,
        } as never)
        .eq("id", inv.id);
    } catch (e) {
      console.warn("[inviteFamilyMember] email notification or delivery status update skipped:", e);
    }

    return { id: inv.id, token: inv.token, emailSent, emailProvided: Boolean(email) };
  });

// ---- Revoke invite ----
const RevokeInput = z.object({ id: z.string().uuid() });
export const revokeFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RevokeInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("family_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Lookup invite by token (for accept page) ----
const TokenInput = z.object({ token: z.string().min(8).max(200) });
export const getInvitationByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TokenInput.parse(i))
  .handler(async ({ context, data }) => {
    // Use admin client to look up token (invitee isn't a family admin yet)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("family_invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) return { invitation: null, family: null };

    const { data: fam } = await supabaseAdmin
      .from("families")
      .select("id, name")
      .eq("id", inv.family_id)
      .single();

    // Also return current user email for match display
    const { data: userData } = await context.supabase.auth.getUser();
    return {
      invitation: inv
        ? {
            id: inv.id,
            email: inv.email ?? "",
            status: toFamilyInvitationView(inv as unknown as StoredFamilyInvitation).status,
            verification_status: invitationState(inv as unknown as StoredFamilyInvitation),
            family_id: inv.family_id,
          }
        : null,
      family: fam,
      current_email: userData.user?.email ?? null,
    };
  });

// ---- Accept invite ----
export const acceptFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TokenInput.parse(i))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claimInvitation = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      functionName: string,
      args: { p_token: string; p_user_id: string },
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
    const { data: familyId, error } = await claimInvitation("claim_approved_family_invitation", {
      p_token: data.token,
      p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    return { family_id: familyId };
  });

// ---- Remove member (admin) ----
const RemoveInput = z.object({ member_id: z.string().uuid() });
export const removeFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RemoveInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || mem.role !== "owner")
      throw new Error("Only the family owner can remove members.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("family_members")
      .select("id, role, family_id")
      .eq("id", data.member_id)
      .single();
    if (!target || target.family_id !== mem.family_id) throw new Error("Not found.");
    if (target.role === "owner") throw new Error("The owner can't be removed.");

    const { error } = await supabaseAdmin.from("family_members").delete().eq("id", data.member_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Leave family (self) ----
export const leaveFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("family_members")
      .select("id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) throw new Error("You're not in a family.");
    if (mem.role === "owner") throw new Error("Owners must delete the family instead of leaving.");
    const { error } = await supabase.from("family_members").delete().eq("id", mem.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Delete family (owner) ----
export const deleteFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || mem.role !== "owner") throw new Error("Only the owner can delete the family.");
    const { error } = await supabase.from("families").delete().eq("id", mem.family_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
