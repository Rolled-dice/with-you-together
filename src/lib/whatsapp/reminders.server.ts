/**
 * Medication dose reminders over WhatsApp.
 *
 * Finds doses due in the next 20 minutes for members with a verified,
 * opted-in WhatsApp number and queues a friendly nudge they can answer with
 * TAKEN / SKIP. De-duplicated per dose via the outbox `dedupe_key`.
 */
export async function sendDueDoseReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { enqueueMessage } = await import("./provider.server");

  const from = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 20 * 60 * 1000).toISOString();

  const { data: doses, error } = await supabaseAdmin
    .from("dose_logs")
    .select("id, for_user_id, scheduled_at, status, medications(name, dosage, instructions)")
    .eq("status", "pending")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .limit(200);
  if (error) throw new Error(error.message);
  if (!doses?.length) return { checked: 0, queued: 0 };

  const userIds = [...new Set(doses.map((d) => d.for_user_id))];
  const { data: contacts } = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("phone, user_id")
    .in("user_id", userIds)
    .eq("opted_in", true)
    .not("verified_at", "is", null);

  const byUser = new Map((contacts ?? []).map((c) => [c.user_id as string, c.phone as string]));
  let queued = 0;

  for (const d of doses) {
    const phone = byUser.get(d.for_user_id);
    if (!phone) continue;
    const med = (d.medications ?? {}) as { name?: string; dosage?: string; instructions?: string };
    const body = [
      `Time for your ${med.name ?? "medicine"}${med.dosage ? `, ${med.dosage}` : ""}. 💙`,
      med.instructions ? med.instructions : null,
      "",
      "Reply TAKEN when you've had it, or SKIP if you're skipping this one.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await enqueueMessage({
      phone,
      body,
      kind: "dose_reminder",
      doseId: d.id,
      dedupeKey: `dose:${d.id}`,
    });
    if (res.queued) queued += 1;
  }

  return { checked: doses.length, queued };
}
