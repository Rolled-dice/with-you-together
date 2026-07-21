import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TIER_LIMITS: Record<string, number> = {
  free: 25,
  together: 500,
  family: 1500,
  care: 3000,
};

// Human Listener session limits (per family / user per month).
export const SESSION_LIMITS: Record<string, number> = {
  free: 0,
  together: 4,
  family: 12,
  care: 24,
};

export const RESCHEDULE_LIMITS: Record<string, number> = {
  free: 0,
  together: 4,
  family: 8,
  care: 12,
};

export const MEMBER_LIMITS: Record<string, number> = {
  free: 1,
  together: 1,
  family: 3,
  care: 4,
};

export function getTierLimit(tier: string | null | undefined) {
  return TIER_LIMITS[tier ?? "free"] ?? TIER_LIMITS.free;
}

function periodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function periodEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
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
    const start = periodStart();
    const resetsAt = periodEnd().toISOString();

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
      limit,
      remaining: Math.max(0, limit - used),
      resets_at: resetsAt,
    };
  });
