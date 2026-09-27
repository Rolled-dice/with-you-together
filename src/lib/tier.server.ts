/**
 * Effective-tier resolution for the "owner pays for everyone" family model.
 *
 * `profiles.care_tier` is trigger-managed from a user's OWN subscription, so a
 * family member who never bought a plan stays `free`. To make members inherit
 * the family owner's plan, callers must resolve the *effective* tier at read
 * time: the user's own tier when they aren't in a family, otherwise the family
 * OWNER's tier.
 *
 * Accepts any Supabase client (request-scoped or the token client built in
 * /api/chat), so it works from server functions and raw route handlers alike.
 */

export type EffectiveTier = {
  tier: string; // "free" | "care" | "care_plus"
  isMember: boolean; // true when the user is a NON-owner member of a family
  isOwner: boolean; // true when the user owns a family
  familyId: string | null;
  role: "owner" | "adult" | "teen" | null;
  ownerId: string | null;
  ownerName: string | null;
};

export async function getEffectiveTier(supabase: any, userId: string): Promise<EffectiveTier> {
  // Is the user in a family?
  const { data: member } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  // Not in a family — use their own tier.
  if (!member) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("care_tier")
      .eq("id", userId)
      .maybeSingle();
    return {
      tier: (profile?.care_tier ?? "free") as string,
      isMember: false,
      isOwner: false,
      familyId: null,
      role: null,
      ownerId: null,
      ownerName: null,
    };
  }

  const { data: family } = await supabase
    .from("families")
    .select("id, owner_id")
    .eq("id", member.family_id)
    .single();

  const ownerId = family?.owner_id as string | undefined;
  const isOwner = ownerId === userId;

  // The owner's tier is the family's effective tier for everyone.
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("care_tier, display_name")
    .eq("id", ownerId)
    .maybeSingle();

  return {
    tier: (ownerProfile?.care_tier ?? "free") as string,
    isMember: !isOwner,
    isOwner,
    familyId: member.family_id as string,
    role: member.role as "owner" | "adult" | "teen",
    ownerId: ownerId ?? null,
    ownerName: (ownerProfile?.display_name as string) ?? null,
  };
}
