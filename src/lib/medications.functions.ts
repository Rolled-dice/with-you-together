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
      const { syncNow } = await import("@/lib/calendar-sync");
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
      const { syncNow } = await import("@/lib/calendar-sync");
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
      return me ? [{ user_id: context.userId, display_name: me.display_name || me.full_name || "You", role: "owner" }] : [];
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
    return (members ?? []).filter((m) => m.user_id === context.userId).map((m) => {
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
      .eq("for_user_id", context.userId)
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
    z.object({
      dose_id: z.string().uuid(),
      status: z.enum(["taken", "skipped"]),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("dose_logs")
      .update({
        status: data.status,
        logged_at: new Date().toISOString(),
        logged_by: context.userId,
        note: data.note ?? null,
      })
      .eq("id", data.dose_id);
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar-sync");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] medication mutation", e);
    }
    return { ok: true };
  });

export const getPrescriptionUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ medication_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: medication, error } = await context.supabase.from("medications").select("prescription_image_path").eq("id", data.medication_id).maybeSingle();
    if (error || !medication?.prescription_image_path) throw new Error("This prescription is not available to you.");
    const { data: signed, error: storageError } = await context.supabase.storage.from("prescriptions").createSignedUrl(medication.prescription_image_path, 60);
    if (storageError || !signed) throw new Error("This prescription is not available to you.");
    return { url: signed.signedUrl };
  });

// ---- Prescription parsing via Lovable AI Vision ----
const ParseInput = z.object({ image_path: z.string().min(1) });

const ParsedMedication = z.object({
  name: z.string().nullable().optional(),
  dosage: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  times_per_day: z.number().int().min(1).max(6).nullable().optional(),
  when_to_take: z.union([
    z.enum(["morning", "afternoon", "evening", "night"]),
    z.array(z.enum(["morning", "afternoon", "evening", "night"])),
  ]).nullable().optional(),
});

const ParsedPrescription = z.object({
  doctor: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  medications: z.array(ParsedMedication).default([]),
});

export const parsePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ParseInput.parse(i))
  .handler(async ({ context, data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const { data: signed, error: sErr } = await context.supabase.storage
      .from("prescriptions")
      .createSignedUrl(data.image_path, 300);
    if (sErr || !signed?.signedUrl) throw new Error("Could not read prescription image");

    // Fetch the image bytes so we can hand them straight to Gemini as an image
    // part (Web-standard fetch — Cloudflare Worker safe, no Node APIs).
    const imgRes = await fetch(signed.signedUrl);
    if (!imgRes.ok) throw new Error("Could not read prescription image");
    const imageBytes = new Uint8Array(await imgRes.arrayBuffer());
    const mediaType = imgRes.headers.get("content-type") || "image/jpeg";

    const { generateText } = await import("ai");
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google(process.env["GEMINI_VISION_MODEL"] || "gemini-2.5-flash");

    const SYSTEM =
      "You are a careful medical assistant. Extract medications from a prescription image. " +
      "Return STRICT JSON only (no markdown, no code fences) matching: " +
      '{ "doctor": string|null, "date": string|null, "medications": [{ "name", "dosage", "form", "frequency", "duration", "instructions", "times_per_day", "when_to_take" }] }. ' +
      "times_per_day is an integer 1-6. when_to_take is one of morning, afternoon, evening, night, or an array of these. " +
      "If unsure, use null. Never invent medications you can't read.";

    let text: string;
    try {
      const result = await generateText({
        model,
        maxRetries: 1,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all medications from this prescription:" },
              { type: "image", image: imageBytes, mediaType },
            ],
          },
        ],
      });
      text = result.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/quota|429|rate/i.test(message)) {
        throw new Error("The photo reader is busy right now. Please try again shortly.");
      }
      if (/api key|401|permission|403/i.test(message)) {
        throw new Error("Photo reading is not configured correctly yet.");
      }
      throw new Error("We could not read this prescription photo.");
    }

    // Gemini may wrap JSON in ```json fences — strip them before parsing.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed: z.infer<typeof ParsedPrescription> = { medications: [] };
    try {
      parsed = ParsedPrescription.parse(JSON.parse(cleaned));
    } catch {
      throw new Error("We could not confidently read the medicine details. Try a brighter, closer photo.");
    }
    return parsed;
  });

// Helper: seed today's dose logs for a medication based on its schedules
async function seedDoseLogs(supabase: any, medicationId: string) {
  const { data: med } = await supabase
    .from("medications")
    .select("id, for_user_id, is_active, start_date, end_date, medication_schedules(id, time_of_day, days_of_week)")
    .eq("id", medicationId)
    .maybeSingle();
  if (!med || !med.is_active) return;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (med.start_date && todayStr < med.start_date) return;
  if (med.end_date && todayStr > med.end_date) return;
  const dow = today.getDay();
  const rows: Array<{ medication_id: string; schedule_id: string; for_user_id: string; scheduled_at: string }> = [];
  for (const s of med.medication_schedules ?? []) {
    if (Array.isArray(s.days_of_week) && !s.days_of_week.includes(dow)) continue;
    const [hh, mm] = String(s.time_of_day).split(":").map((n: string) => parseInt(n, 10));
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
    await supabase.from("dose_logs").upsert(rows, { onConflict: "medication_id,scheduled_at", ignoreDuplicates: true });
  }
}
