/** Delivers due Send It Later messages and notifies sender + recipient. */

export async function deliverDueMessages() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const { data: due, error } = await supabaseAdmin
    .from("scheduled_messages")
    .select("id, user_id, recipient_name, recipient_user_id, kind, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(50);
  if (error) throw new Error(error.message);
  if (!due?.length) return { delivered: 0 };

  let delivered = 0;
  for (const m of due) {
    const { error: upErr } = await supabaseAdmin
      .from("scheduled_messages")
      .update({ status: "delivered", delivered_at: now })
      .eq("id", m.id)
      .eq("status", "scheduled");
    if (upErr) continue;
    delivered += 1;

    const kindLabel =
      m.kind === "text" ? "a message" : m.kind === "voice" ? "a voice note" : "a video message";

    if (m.recipient_user_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: m.recipient_user_id,
        kind: "send_later",
        severity: "info",
        title: "A message arrived for you 💌",
        body: `Someone sent you ${kindLabel}, open Send Later to read or play it.`,
      });
    }
    await supabaseAdmin.from("notifications").insert({
      user_id: m.user_id,
      kind: "send_later",
      severity: "info",
      title: "Your message was delivered",
      body: `Your ${kindLabel} for ${m.recipient_name} was delivered just now.`,
    });
  }
  return { delivered };
}
