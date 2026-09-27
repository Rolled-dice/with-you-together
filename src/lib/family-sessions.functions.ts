import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SESSION_LIMITS, RESCHEDULE_LIMITS } from "@/lib/quota.functions";

function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

// Ensure a pool row exists for the given family & current month.
async function ensurePool(
  supabase: any,
  familyId: string,
  tier: string,
) {
  const period = currentPeriodStart();
  const total = SESSION_LIMITS[tier] ?? 0;
  const resTotal = RESCHEDULE_LIMITS[tier] ?? 0;

  const { data: existing } = await supabase
    .from("family_session_pool")
    .select("*")
    .eq("family_id", familyId)
    .eq("period_start", period)
    .maybeSingle();

  if (existing) {
    // Keep totals fresh if the plan changed mid-month (only grow, never shrink used).
    if (existing.total_sessions !== total || existing.reschedules_total !== resTotal) {
      await supabase
        .from("family_session_pool")
        .update({ total_sessions: total, reschedules_total: resTotal })
        .eq("family_id", familyId)
        .eq("period_start", period);
    }
    return { ...existing, total_sessions: total, reschedules_total: resTotal };
  }

  const { data: created, error } = await supabase
    .from("family_session_pool")
    .insert({
      family_id: familyId,
      period_start: period,
      total_sessions: total,
      reschedules_total: resTotal,
      reschedules_used: 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created;
}

async function loadFamilyContext(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  const { data: family } = await supabase
    .from("families")
    .select("id, name, owner_id")
    .eq("id", member.family_id)
    .single();

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("care_tier")
    .eq("id", family.owner_id)
    .single();

  return {
    familyId: member.family_id as string,
    role: member.role as "owner" | "adult" | "teen",
    tier: (ownerProfile?.care_tier ?? "free") as string,
  };
}

export const getFamilyPool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadFamilyContext(context.supabase, context.userId);
    if (!ctx) return null;

    const pool = await ensurePool(context.supabase, ctx.familyId, ctx.tier);
    const period = currentPeriodStart();

    // family_members has no display_name column; resolve names from profiles
    // (same pattern as getMyFamily). Selecting display_name off family_members
    // makes PostgREST error out, which previously left members empty and hid
    // the per-member allocation inputs.
    const { data: members } = await context.supabase
      .from("family_members")
      .select("user_id, role")
      .eq("family_id", ctx.familyId);

    const memberIds = (members ?? []).map((m: any) => m.user_id as string).filter(Boolean);
    const names = new Map<string, string>();
    if (memberIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      for (const p of profs ?? []) {
        names.set(p.id as string, (p.display_name as string) ?? "Member");
      }
    }

    const { data: allocs } = await context.supabase
      .from("family_session_allocations")
      .select("member_user_id, allocated, used")
      .eq("family_id", ctx.familyId)
      .eq("period_start", period);

    const allocationsByUser = new Map<string, { allocated: number; used: number }>(
      (allocs ?? []).map((a: any) => [
        a.member_user_id as string,
        { allocated: a.allocated as number, used: a.used as number },
      ]),
    );

    const memberRows = (members ?? []).map((m: any) => ({
      user_id: m.user_id as string,
      role: m.role as string,
      display_name: names.get(m.user_id as string) ?? "Member",
      allocated: allocationsByUser.get(m.user_id)?.allocated ?? 0,
      used: allocationsByUser.get(m.user_id)?.used ?? 0,
    }));

    const totalAllocated = memberRows.reduce((s, r) => s + r.allocated, 0);
    const totalUsed = memberRows.reduce((s, r) => s + r.used, 0);
    const unallocated = Math.max(0, pool.total_sessions - totalAllocated);

    return {
      familyId: ctx.familyId,
      tier: ctx.tier,
      role: ctx.role,
      period,
      totalSessions: pool.total_sessions as number,
      totalUsed,
      unallocated,
      reschedulesTotal: pool.reschedules_total as number,
      reschedulesUsed: pool.reschedules_used as number,
      members: memberRows,
    };
  });

const AllocInput = z.object({
  allocations: z
    .array(
      z.object({
        member_user_id: z.string().uuid(),
        allocated: z.number().int().min(0).max(1000),
      }),
    )
    .max(20),
});

export const setAllocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AllocInput.parse(i))
  .handler(async ({ context, data }) => {
    const ctx = await loadFamilyContext(context.supabase, context.userId);
    if (!ctx) throw new Error("No family");
    if (ctx.role !== "owner" && ctx.role !== "adult") {
      throw new Error("Only Owner or Adult can allocate sessions");
    }
    const pool = await ensurePool(context.supabase, ctx.familyId, ctx.tier);
    const period = currentPeriodStart();
    const sum = data.allocations.reduce((s, a) => s + a.allocated, 0);
    if (sum > pool.total_sessions) {
      throw new Error(
        `Allocations (${sum}) exceed monthly total (${pool.total_sessions}).`,
      );
    }

    for (const a of data.allocations) {
      const { error } = await context.supabase
        .from("family_session_allocations")
        .upsert(
          {
            family_id: ctx.familyId,
            member_user_id: a.member_user_id,
            period_start: period,
            allocated: a.allocated,
          },
          { onConflict: "family_id,member_user_id,period_start" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
