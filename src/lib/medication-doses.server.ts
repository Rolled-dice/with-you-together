import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
// Helper: seed today's dose logs for a medication based on its schedules
export async function seedDoseLogs(supabase: SupabaseClient<Database>, medicationId: string) {
  const { data: med } = await supabase
    .from("medications")
    .select(
      "id, for_user_id, is_active, start_date, end_date, medication_schedules(id, time_of_day, days_of_week)",
    )
    .eq("id", medicationId)
    .maybeSingle();
  if (!med || !med.is_active) return;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (med.start_date && todayStr < med.start_date) return;
  if (med.end_date && todayStr > med.end_date) return;
  const dow = today.getDay();
  const rows: Array<{
    medication_id: string;
    schedule_id: string;
    for_user_id: string;
    scheduled_at: string;
  }> = [];
  for (const s of med.medication_schedules ?? []) {
    if (Array.isArray(s.days_of_week) && !s.days_of_week.includes(dow)) continue;
    const [hh, mm] = String(s.time_of_day)
      .split(":")
      .map((n: string) => parseInt(n, 10));
    const when = new Date(today);
    when.setHours(hh || 0, mm || 0, 0, 0);
    rows.push({
      medication_id: med.id,
      schedule_id: s.id,
      for_user_id: med.for_user_id,
      scheduled_at: when.toISOString(),
    });
  }
  if (rows.length > 0) {
    await supabase
      .from("dose_logs")
      .upsert(rows, { onConflict: "medication_id,scheduled_at", ignoreDuplicates: true });
  }
}
