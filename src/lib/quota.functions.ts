import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Daily AI companion message allowance per tier.
// care_plus ($79) is unlimited; care ($49) has a daily allowance that refills every day.
export const UNLIMITED = Number.POSITIVE_INFINITY;

export const DAILY_TIER_LIMITS: Record<string, number> = {
  free: 5,
  together: 20,
  family: 40,
  care: 40,
  care_plus: UNLIMITED,
};

// Legacy monthly limits kept for reference / older callers.
export const TIER_LIMITS: Record<string, number> = {
  free: 25,
  together: 500,
  family: 1500,
  care: 3000,
  care_plus: UNLIMITED,
};

// Human Listener session limits (per family / user per month).
export const SESSION_LIMITS: Record<string, number> = {
  free: 0,
  together: 4,
  family: 12,
  care: 18,
  care_plus: 30,
};

export const RESCHEDULE_LIMITS: Record<string, number> = {
  free: 0,
  together: 4,
  family: 8,
  care: 12,
  care_plus: 20,
};

export const MEMBER_LIMITS: Record<string, number> = {
  free: 1,
  together: 1,
  family: 3,
  care: 2,
  care_plus: 5,
};

export function getTierLimit(tier: string | null | undefined) {
  const key = tier ?? "free";
  return DAILY_TIER_LIMITS[key] ?? DAILY_TIER_LIMITS.free;
}

export function isUnlimitedTier(tier: string | null | undefined) {
  return getTierLimit(tier) === UNLIMITED;
}

function dayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dayEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export const getMyAiQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("care_tier")
      .eq("id", userId)
      .maybeSingle();

    const tier = profile?.care_tier ?? "free";
    const limit = getTierLimit(tier);
    const unlimited = limit === UNLIMITED;
    const start = dayStart();
    const resetsAt = dayEnd().toISOString();

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", start.toISOString());

    const used = count ?? 0;
    return {
      tier,
      used,
      unlimited,
      limit: unlimited ? null : limit,
      remaining: unlimited ? null : Math.max(0, limit - used),
      resets_at: resetsAt,
      period: "day" as const,
    };
  });
