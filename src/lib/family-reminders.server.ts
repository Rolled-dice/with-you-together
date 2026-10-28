import type { Json } from "@/integrations/supabase/types";
import { familyReminderCommand } from "./family.server";
import { ReminderRows } from "./family-reminders.schemas";

export async function readFamilyReminders(actor: string, mode: "list" | "today") {
  return ReminderRows.parse(await familyReminderCommand(actor, mode));
}
export async function changeFamilyReminder(actor: string, action: string, data: Json) {
  const result = await familyReminderCommand(actor, action, data);
  try {
    const { syncNow } = await import("./calendar-sync");
    await syncNow();
  } catch {
    console.warn("[calendar-sync] reminder sync will retry");
  }
  return result;
}
