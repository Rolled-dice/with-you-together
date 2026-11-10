import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { combineToUtc } from "@/lib/listeners.functions";

// Helper: seed today's dose logs for a medication based on its schedules in user's timezone
export async function seedDoseLogs(supabase: SupabaseClient<Database>, medicationId: string) {
  const { data: med } = await supabase
    .from("medications")
    .select(
      "id, for_user_id, is_active, start_date, end_date, medication_schedules(id, time_of_day, days_of_week)",
    )
    .eq("id", medicationId)
    .maybeSingle();
  if (!med || !med.is_active) return;

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", med.for_user_id)
    .maybeSingle();
  const tz = userProfile?.timezone || "Asia/Kolkata";

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (med.start_date && todayStr < med.start_date) return;
  if (med.end_date && todayStr > med.end_date) return;

  // Day of week in user's local timezone
  const dow = new Date(Date.parse(`${todayStr}T12:00:00Z`)).getDay();

  const rows: Array<{
    medication_id: string;
    schedule_id: string;
    for_user_id: string;
    scheduled_at: string;
  }> = [];

  for (const s of med.medication_schedules ?? []) {
    if (Array.isArray(s.days_of_week) && !s.days_of_week.includes(dow)) continue;
    const timeStr = String(s.time_of_day).slice(0, 5);
    const scheduledAt = combineToUtc(todayStr, timeStr, tz);
    rows.push({
      medication_id: med.id,
      schedule_id: s.id,
      for_user_id: med.for_user_id,
      scheduled_at: scheduledAt,
    });
  }

  if (rows.length > 0) {
    await supabase
      .from("dose_logs")
      .upsert(rows, { onConflict: "medication_id,scheduled_at", ignoreDuplicates: true });

    // Clean up stale uncompleted doses for today that do not match the valid schedule times
    // Compare numeric epoch timestamps to prevent false negatives from formatting differences (+00:00 vs .000Z)
    const validTimeMs = new Set(rows.map((r) => new Date(r.scheduled_at).getTime()));
    const tomorrowStr = new Date(Date.parse(`${todayStr}T12:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
    const dayStart = combineToUtc(todayStr, "00:00", tz);
    const dayEnd = combineToUtc(tomorrowStr, "00:00", tz);

    const { data: todayDoses } = await supabase
      .from("dose_logs")
      .select("id, scheduled_at, status")
      .eq("medication_id", med.id)
      .gte("scheduled_at", dayStart)
      .lt("scheduled_at", dayEnd);

    const staleIds = (todayDoses ?? [])
      .filter(
        (d) =>
          d.status === "pending" && !validTimeMs.has(new Date(d.scheduled_at).getTime()),
      )
      .map((d) => d.id);

    if (staleIds.length > 0) {
      await supabase.from("dose_logs").delete().in("id", staleIds);
    }
  }
}
