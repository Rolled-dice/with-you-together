import { seedDoseLogs } from "./medication-doses.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";

const ScheduleInput = z.object({
  time_of_day: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  with_food: z.boolean().default(false),
  days_of_week: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
});

const MedicationInput = z.object({
  for_user_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).nullable().optional(),
  form: z.string().max(50).nullable().optional(),
  instructions: z.string().max(500).nullable().optional(),
  prescribed_by: z.string().max(200).nullable().optional(),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  refill_date: z.string().nullable().optional(),
  prescription_image_path: z.string().nullable().optional(),
  parsed_data: z.unknown().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  schedules: z.array(ScheduleInput).default([]),
});

export const listMedications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medications")
      .select("*, medication_schedules(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MedicationInput.parse(i))
  .handler(async ({ context, data }) => {
    const { schedules, ...med } = data;
    const medication = {
      ...med,
      parsed_data: med.parsed_data as Json | null | undefined,
      added_by: context.userId,
    };
    const { data: row, error } = await context.supabase
      .from("medications")
      .insert(medication)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (schedules.length > 0) {
      const { error: sErr } = await context.supabase
        .from("medication_schedules")
        .insert(schedules.map((s) => ({ ...s, medication_id: row.id })));
      if (sErr) throw new Error(sErr.message);
    }
    // Seed today's dose logs
    await seedDoseLogs(context.supabase, row.id);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] createMedication", e);
    }
    return row;
  });

export const deleteMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("medications")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] medication mutation", e);
    }
    return { ok: true };
  });

export const listFamilyMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: myMembership } = await context.supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!myMembership?.family_id) {
      const { data: me } = await context.supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .eq("id", context.userId)
        .maybeSingle();
      return me
        ? [
            {
              user_id: context.userId,
              display_name: me.display_name || me.full_name || "You",
              role: "owner",
            },
          ]
        : [];
    }
    const { data: members, error } = await context.supabase
      .from("family_members")
      .select("user_id, role")
      .eq("family_id", myMembership.family_id);
    if (error) throw new Error(error.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, display_name, full_name")
      .in("id", ids);
    return (members ?? []).map((m) => {
      const p = profiles?.find((pp) => pp.id === m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        display_name: p?.display_name || p?.full_name || "Family member",
      };
    });
  });

export const listTodaysDoses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Ensure today's logs are seeded for every active med the user can see
    const { data: meds } = await context.supabase
      .from("medications")
      .select("id")
      .eq("is_active", true);
    for (const m of meds ?? []) {
      await seedDoseLogs(context.supabase, m.id);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { data, error } = await context.supabase
      .from("dose_logs")
      .select("*, medications(name, dosage, form, instructions, for_user_id)")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const logDose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        dose_id: z.string().uuid(),
        status: z.enum(["taken", "skipped"]),
        note: z.string().max(500).optional(),
        channel: z
          .enum(["web_app", "mobile_push", "sms_reply", "caregiver_portal"])
          .default("web_app")
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const channel = data.channel ?? "web_app";
    const auditNote = data.note
      ? `${data.note} [Audit: ${channel}]`
      : `[Audit: Confirmed via ${channel}]`;
    const { error } = await context.supabase
      .from("dose_logs")
      .update({
        status: data.status,
        logged_at: new Date().toISOString(),
        logged_by: context.userId,
        note: auditNote,
      })
      .eq("id", data.dose_id);
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] medication mutation", e);
    }
    return { ok: true, channel };
  });

// Photo extraction uses the existing Gemini server credential; review before saving.
export const parsePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ image_path: z.string().min(1).max(300) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { readPrescription } = await import("./prescription.server");
    return readPrescription(context, data.image_path, process.env.GEMINI_API_KEY);
  });
