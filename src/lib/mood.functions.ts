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
