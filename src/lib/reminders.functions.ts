import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ReminderInput } from "./family-reminders.schemas";
import { FamilyIdInput } from "./family.schemas";
import { changeFamilyReminder, readFamilyReminders } from "./family-reminders.server";

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => readFamilyReminders(context.userId, "list"));
export const getFamilyToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => readFamilyReminders(context.userId, "today"));
export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReminderInput.parse(i))
  .handler(({ context, data }) => changeFamilyReminder(context.userId, "create", data));
export const completeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyIdInput.parse(i))
  .handler(({ context, data }) => changeFamilyReminder(context.userId, "complete", data));
export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyIdInput.parse(i))
  .handler(({ context, data }) => changeFamilyReminder(context.userId, "delete", data));
export const snoozeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    FamilyIdInput.extend({ due_at: z.string().datetime({ offset: true }) }).parse(i),
  )
  .handler(({ context, data }) => changeFamilyReminder(context.userId, "snooze", data));
export const shareReminderUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    FamilyIdInput.extend({ update_text: z.string().trim().min(1).max(2000) }).parse(i),
  )
  .handler(({ context, data }) => changeFamilyReminder(context.userId, "update", data));
