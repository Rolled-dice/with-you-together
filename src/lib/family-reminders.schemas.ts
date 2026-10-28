import { z } from "zod";
import { FamilyTimezone } from "./family.schemas";

export const ReminderInput = z.object({
  for_user_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z
    .enum(["general", "appointment", "bill", "hydration", "exercise", "birthday", "other"])
    .default("general"),
  due_at: z.string().datetime({ offset: true }),
  timezone: FamilyTimezone.optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
});
export const ReminderRows = z.array(
  z.object({
    id: z.string(),
    reminder_id: z.string(),
    for_user_id: z.string(),
    created_by: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    category: z.string(),
    recurrence: z.string().nullable(),
    timezone: z.string(),
    due_at: z.string(),
    status: z.enum(["pending", "snoozed", "done", "dismissed", "no_update"]),
    update_text: z.string().nullable(),
    completed_at: z.string().nullable(),
    can_complete: z.boolean(),
  }),
);
export type FamilyReminder = z.infer<typeof ReminderRows>[number];
