import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ReminderInput = z.object({
  for_user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(["general", "appointment", "bill", "hydration", "exercise", "birthday", "other"]).default("general"),
  due_at: z.string(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
});

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reminders")
      .select("*")
      .in("status", ["pending", "snoozed"])
      .order("due_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReminderInput.parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("reminders")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] createReminder", e);
    }
    return row;
  });

export const completeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("reminders")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] reminder mutation", e);
    }
    return { ok: true };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("reminders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] reminder mutation", e);
    }
    return { ok: true };
  });
