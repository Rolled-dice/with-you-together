/**
 * Provider-agnostic WhatsApp delivery layer.
 *
 * Every outbound message is written to `whatsapp_outbox` first. If a messaging
 * provider is configured we try to deliver immediately and record the result;
 * if not, the row stays `queued` so nothing is lost and the queue can be
 * drained the moment Twilio/Plivo credentials land.
 */

type SendArgs = {
  phone: string;
  body: string;
  kind?: string;
  bookingId?: string | null;
  doseId?: string | null;
  /** Optional idempotency key — a duplicate insert is silently skipped. */
  dedupeKey?: string | null;
};

export type ProviderName = "twilio" | "plivo" | null;

export function configuredProvider(): ProviderName {
  if (process.env["TWILIO_API_KEY"] && process.env["WHATSAPP_FROM"]) return "twilio";
  if (process.env["PLIVO_AUTH_ID"] && process.env["PLIVO_AUTH_TOKEN"]) return "plivo";
  return null;
}

/** Normalises a phone number to E.164-ish digits with a leading `+`. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.replace(/^whatsapp:/i, "").trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
}

export async function enqueueMessage(args: SendArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const provider = configuredProvider();

  const { data: row, error } = await supabaseAdmin
    .from("whatsapp_outbox")
    .insert({
      phone: args.phone,
      body: args.body,
      kind: args.kind ?? "reply",
      booking_id: args.bookingId ?? null,
      dose_id: args.doseId ?? null,
      dedupe_key: args.dedupeKey ?? null,
      provider,
    })
    .select("id")
    .maybeSingle();

  // Unique violation on dedupe_key means we already queued this message.
  if (error && !`${error.message}`.includes("duplicate key")) {
    console.error("whatsapp outbox insert failed", error.message);
    return { queued: false, sent: false };
  }
  if (!row) return { queued: false, sent: false };

  await supabaseAdmin.from("whatsapp_messages").insert({
    phone: args.phone,
    direction: "outbound",
    body: args.body,
    provider,
  });

  if (!provider) return { queued: true, sent: false, id: row.id };

  const result = await deliver(provider, args.phone, args.body);
  await supabaseAdmin
    .from("whatsapp_outbox")
    .update({
      status: result.ok ? "sent" : "failed",
      attempts: 1,
      error: result.ok ? null : result.error?.slice(0, 500),
      provider_message_id: result.id ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
    })
    .eq("id", row.id);

  return { queued: true, sent: result.ok, id: row.id };
}

async function deliver(
  provider: Exclude<ProviderName, null>,
  to: string,
  body: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    if (provider === "twilio") {
      const lovableKey = process.env["LOVABLE_API_KEY"];
      const connectionKey = process.env["TWILIO_API_KEY"];
      const from = process.env["WHATSAPP_FROM"]!;
      if (!lovableKey || !connectionKey) return { ok: false, error: "Twilio not configured" };
      const accountSid = process.env["TWILIO_ACCOUNT_SID"];
      if (!accountSid) return { ok: false, error: "TWILIO_ACCOUNT_SID missing" };

      const res = await fetch(
        `https://connector-gateway.lovable.dev/twilio/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": connectionKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: `whatsapp:${from}`,
            To: `whatsapp:${to}`,
            Body: body,
          }).toString(),
        },
      );
      const text = await res.text();
      if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 300)}` };
      let id: string | undefined;
      try {
        id = JSON.parse(text)?.sid;
      } catch {
        /* ignore */
      }
      return { ok: true, id };
    }

    // Plivo REST
    const authId = process.env["PLIVO_AUTH_ID"]!;
    const authToken = process.env["PLIVO_AUTH_TOKEN"]!;
    const from = process.env["PLIVO_WHATSAPP_FROM"] ?? process.env["WHATSAPP_FROM"];
    if (!from) return { ok: false, error: "PLIVO_WHATSAPP_FROM missing" };
    const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Message/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${authId}:${authToken}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ src: from, dst: to, text: body, type: "whatsapp" }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Plivo ${res.status}: ${text.slice(0, 300)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Retries queued messages — used after a provider is connected. */
export async function drainOutbox(limit = 25) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const provider = configuredProvider();
  if (!provider) return { drained: 0, provider: null as ProviderName };

  const { data: rows } = await supabaseAdmin
    .from("whatsapp_outbox")
    .select("id, phone, body, attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  let drained = 0;
  for (const r of rows ?? []) {
    const result = await deliver(provider, r.phone, r.body);
    await supabaseAdmin
      .from("whatsapp_outbox")
      .update({
        status: result.ok ? "sent" : "failed",
        attempts: (r.attempts ?? 0) + 1,
        error: result.ok ? null : result.error?.slice(0, 500),
        provider,
        provider_message_id: result.id ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq("id", r.id);
    if (result.ok) drained += 1;
  }
  return { drained, provider };
}
