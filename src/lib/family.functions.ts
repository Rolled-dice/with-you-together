import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_DISPLAY } from "@/lib/currency";
import { z } from "zod";

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

    const isAdmin = membership.role === "owner" || membership.role === "adult";
    let invites: Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      token: string;
      expires_at: string;
      created_at: string;
    }> = [];
    if (isAdmin) {
      const { data: inv } = await supabase
        .from("family_invitations")
        .select("id, email, role, status, token, expires_at, created_at")
        .eq("family_id", membership.family_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      invites = inv ?? [];
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
  email: z.string().email().max(200),
  role: z.enum(["adult", "teen"]).default("adult"),
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
    if (!mem || (mem.role !== "owner" && mem.role !== "adult"))
      throw new Error("Only family admins can invite.");

    // Circle size comes from the plan catalogue. This was hardcoded to 4 while
    // Care Plus is sold as "up to 5 people", so the cap contradicted the offer.
    const maxMembers = PLAN_DISPLAY.care_plus.members;
    const { count } = await supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", mem.family_id);
    if ((count ?? 0) >= maxMembers)
      throw new Error(`Family is full (max ${maxMembers} members).`);

    const email = data.email.trim().toLowerCase();
    const { data: inv, error } = await supabase
      .from("family_invitations")
      .insert({
        family_id: mem.family_id,
        email,
        role: data.role,
        invited_by: userId,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return { id: inv.id, token: inv.token };
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
      .select("id, family_id, email, role, status, expires_at")
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
      invitation: inv,
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

    const { data: inv, error } = await supabaseAdmin
      .from("family_invitations")
      .select("id, family_id, email, role, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found.");
    if (inv.status !== "pending") throw new Error("This invitation is no longer valid.");
    if (new Date(inv.expires_at) < new Date()) throw new Error("This invitation has expired.");

    // Match email
    const { data: userData } = await context.supabase.auth.getUser();
    const userEmail = userData.user?.email?.toLowerCase();
    if (!userEmail || userEmail !== inv.email.toLowerCase()) {
      throw new Error(`This invitation is for ${inv.email}. Sign in with that email to accept.`);
    }

    // Not already in a family
    const { data: existing } = await supabaseAdmin
      .from("family_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("You're already in a family. Leave it first.");

    // Capacity check
    const { count } = await supabaseAdmin
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", inv.family_id);
    if ((count ?? 0) >= 4) throw new Error("This family is full.");

    const { error: insErr } = await supabaseAdmin
      .from("family_members")
      .insert({ family_id: inv.family_id, user_id: userId, role: inv.role });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("family_invitations")
      .update({ status: "accepted" })
      .eq("id", inv.id);

    return { family_id: inv.family_id };
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
    if (!mem || (mem.role !== "owner" && mem.role !== "adult"))
      throw new Error("Only family admins can remove members.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("family_members")
      .select("id, role, family_id")
      .eq("id", data.member_id)
      .single();
    if (!target || target.family_id !== mem.family_id) throw new Error("Not found.");
    if (target.role === "owner") throw new Error("The owner can't be removed.");

    const { error } = await supabaseAdmin
      .from("family_members")
      .delete()
      .eq("id", data.member_id);
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
