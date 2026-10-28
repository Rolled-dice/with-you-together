/**
 * Family session-pool enforcement for listener bookings.
 *
 * The monthly pool (family_session_pool) holds `total_sessions` for the whole
 * family, sized from the OWNER's tier. Owners split it with allocations
 * (family_session_allocations: allocated + used per member per period). The
 * unallocated remainder stays shared and any member can draw from it.
 *
 * "Available to a member" = (their allocation - their used) + unallocated pool.
 * Booking consumes one session (charged to the member's allocation row);
 * rescheduling within limits consumes from reschedules_total.
 *
 * These are plain helpers (not server functions) so requestBooking /
 * rescheduleBooking can call them inside their handlers.
 */

function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * Read a solo user's own tier and their session/reschedule usage for the
 * current period. Solo users (no family) draw from their OWN plan's monthly
 * allowance, tracked in solo_session_usage. Reads go through whatever client
 * is passed (authenticated for the summary); RLS lets the user see their row.
 */
async function soloBalance(supabase: any, userId: string): Promise<SessionBalance> {
  const period = currentPeriodStart();
  const { SESSION_LIMITS, RESCHEDULE_LIMITS } = await import("@/lib/quota.functions");

  const { data: profile } = await supabase
    .from("profiles")
    .select("care_tier")
    .eq("id", userId)
    .maybeSingle();
  const tier = (profile?.care_tier ?? "free") as string;
  const totalSessions = (SESSION_LIMITS[tier] ?? 0) as number;
  const reschedulesTotal = (RESCHEDULE_LIMITS[tier] ?? 0) as number;

  const { data: usage } = await supabase
    .from("solo_session_usage")
    .select("sessions_used, reschedules_used")
    .eq("user_id", userId)
    .eq("period_start", period)
    .maybeSingle();

  const sessionsUsed = (usage?.sessions_used ?? 0) as number;
  const reschedulesUsed = (usage?.reschedules_used ?? 0) as number;

  return {
    inFamily: false,
    totalSessions,
    familyUsed: sessionsUsed,
    myAllocated: totalSessions,
    myUsed: sessionsUsed,
    available: Math.max(0, totalSessions - sessionsUsed),
    reschedulesTotal,
    reschedulesUsed,
    reschedulesRemaining: Math.max(0, reschedulesTotal - reschedulesUsed),
    period,
  };
}

type FamilyCtx = {
  familyId: string;
  role: "owner" | "adult" | "teen";
  ownerId: string;
  tier: string;
};

async function loadCtx(supabase: any, userId: string): Promise<FamilyCtx | null> {
  const { data: member } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  const { data: family } = await supabase
    .from("families")
    .select("id, owner_id")
    .eq("id", member.family_id)
    .single();
  if (!family) return null;

  const { data: owner } = await supabase
    .from("profiles")
    .select("care_tier")
    .eq("id", family.owner_id)
    .maybeSingle();

  return {
    familyId: member.family_id,
    role: member.role,
    ownerId: family.owner_id,
    tier: (owner?.care_tier ?? "free") as string,
  };
}

export type SessionBalance = {
  inFamily: boolean;
  // null totals => not in a family (solo user; no pool gating today)
  totalSessions: number;
  familyUsed: number; // used across the whole family this period
  myAllocated: number;
  myUsed: number;
  // What THIS user can still book: own remaining allocation + shared unallocated.
  available: number;
  reschedulesTotal: number;
  reschedulesUsed: number;
  reschedulesRemaining: number;
  period: string;
};

/** Read-only balance for the member (drives the listeners-page summary + gating). */
async function getIncludedSessionBalance(supabase: any, userId: string): Promise<SessionBalance> {
  const period = currentPeriodStart();
  const ctx = await loadCtx(supabase, userId);

  if (!ctx) {
    // Solo user — draw from their own plan's monthly allowance.
    return soloBalance(supabase, userId);
  }

  const { SESSION_LIMITS, RESCHEDULE_LIMITS } = await import("@/lib/quota.functions");
  const totalSessions = (SESSION_LIMITS[ctx.tier] ?? 0) as number;
  const reschedulesTotal = (RESCHEDULE_LIMITS[ctx.tier] ?? 0) as number;

  // Pool row (for reschedules_used). Create lazily if missing.
  const { data: pool } = await supabase
    .from("family_session_pool")
    .select("reschedules_used")
    .eq("family_id", ctx.familyId)
    .eq("period_start", period)
    .maybeSingle();
  const reschedulesUsed = (pool?.reschedules_used ?? 0) as number;

  const { data: allocs } = await supabase
    .from("family_session_allocations")
    .select("member_user_id, allocated, used")
    .eq("family_id", ctx.familyId)
    .eq("period_start", period);

  let familyUsed = 0;
  let familyAllocated = 0;
  let myAllocated = 0;
  let sharedUsed = 0;
  let myUsed = 0;
  for (const a of allocs ?? []) {
    familyUsed += (a.used as number) ?? 0;
    sharedUsed += Math.max(0, (a.used ?? 0) - (a.allocated ?? 0));
    familyAllocated += (a.allocated as number) ?? 0;
    if (a.member_user_id === userId) {
      myAllocated = (a.allocated as number) ?? 0;
      myUsed = (a.used as number) ?? 0;
    }
  }

  const unallocated = Math.max(0, totalSessions - familyAllocated - sharedUsed);
  const myAllocationRemaining = Math.max(0, myAllocated - myUsed);
  // Member can use their remaining allocation plus the shared unallocated pool,
  // but never more than the whole family pool has left.
  const familyRemaining = Math.max(0, totalSessions - familyUsed);
  const available = Math.min(myAllocationRemaining + unallocated, familyRemaining);

  return {
    inFamily: true,
    totalSessions,
    familyUsed,
    myAllocated,
    myUsed,
    available,
    reschedulesTotal,
    reschedulesUsed,
    reschedulesRemaining: Math.max(0, reschedulesTotal - reschedulesUsed),
    period,
  };
}

export async function getSessionBalance(supabase: any, userId: string): Promise<SessionBalance> {
  const included = await getIncludedSessionBalance(supabase, userId);
  const { getExtraCallBalance } = await import("./call-credits.server");
  const purchased = await getExtraCallBalance(userId);
  return { ...included, available: included.available + purchased.available };
}
