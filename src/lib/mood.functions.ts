import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Mood check-ins power the Insights page. They are stored as lightweight,
 * body-less rows and are private to the signed-in member.
 */
export const listMoodCheckIns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("journal_entries")
      .select("id, mood, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    return data;
  });

export const createMoodCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mood: z.number().int().min(1).max(5) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("journal_entries")
      .insert({
        user_id: context.userId,
        mood: data.mood,
        title: "",
        body: "",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Written journal entries live in the SAME `journal_entries` table as mood
 * check-ins — a journal is just a row where the text columns are populated and
 * mood is optional, the inverse of a check-in (mood set, text blank). No new
 * table, RLS or migration is needed.
 *
 * Kept separate from the check-in list so Insights can page journal text
 * independently of the 400-row mood window used for the charts.
 */
export type JournalEntry = {
  id: string;
  title: string | null;
  body: string;
  mood: number | null;
  created_at: string;
};

export const listJournalEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JournalEntry[]> => {
    // Only rows with actual writing — a mood-only check-in has an empty body
    // and should not clutter the journal list.
    const { data, error } = await context.supabase
      .from("journal_entries")
      .select("id, title, body, mood, created_at")
      .eq("user_id", context.userId)
      .neq("body", "")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as JournalEntry[];
  });

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        body: z.string().trim().min(1, "Write a little something first.").max(8000),
        title: z.string().trim().max(120).optional(),
        // Optional: lets someone attach how they felt to a written entry.
        mood: z.number().int().min(1).max(5).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("journal_entries")
      .insert({
        user_id: context.userId,
        body: data.body,
        title: data.title ?? "",
        mood: data.mood ?? null,
      })
      .select("id, title, body, mood, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as JournalEntry;
  });

export const deleteJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // RLS already scopes deletes to the owner; the explicit user_id filter is
    // defence in depth, not the primary guard.
    const { error } = await context.supabase
      .from("journal_entries")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
