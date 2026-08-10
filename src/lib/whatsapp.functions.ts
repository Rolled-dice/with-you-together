import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The member's own WhatsApp link status. */
export const getMyWhatsappLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("whatsapp_contacts")
      .select("phone, verified_at, opted_in, link_code, link_code_expires_at, last_inbound_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { linked: false as const, code: null, phone: null, optedIn: true };
    const pending = data.phone.startsWith("pending-");
    return {
      linked: Boolean(data.verified_at) && !pending,
      phone: pending ? null : data.phone,
      code:
        data.link_code &&
        data.link_code_expires_at &&
        new Date(data.link_code_expires_at).getTime() > Date.now()
          ? data.link_code
          : null,
      optedIn: data.opted_in,
      lastInboundAt: data.last_inbound_at,
    };
  });

/** Issues a fresh 6-digit code the member sends to the bot from their phone. */
export const requestWhatsappCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: existing } = await context.supabase
      .from("whatsapp_contacts")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (existing) {
      await supabaseAdmin
        .from("whatsapp_contacts")
        .update({ link_code: code, link_code_expires_at: expires })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("whatsapp_contacts").insert({
        phone: `pending-${context.userId}`,
        user_id: context.userId,
        link_code: code,
        link_code_expires_at: expires,
      });
    }
    return { code, expiresAt: expires };
  });

export const unlinkWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whatsapp_contacts").delete().eq("user_id", context.userId);
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/** Admin view: recent conversation log + outbox state. */
export const getWhatsappActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [messages, outbox, contacts] = await Promise.all([
      context.supabase
        .from("whatsapp_messages")
        .select("id, phone, direction, body, media_url, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      context.supabase
        .from("whatsapp_outbox")
        .select("id, phone, kind, status, error, attempts, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("whatsapp_contacts")
        .select("phone, verified_at, opted_in, last_inbound_at")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    const { configuredProvider } = await import("@/lib/whatsapp/provider.server");
    return {
      provider: configuredProvider(),
      messages: messages.data ?? [],
      outbox: outbox.data ?? [],
      contacts: contacts.data ?? [],
    };
  });

/** Admin simulator: feeds a message through the bot as if it arrived on WhatsApp. */
export const simulateWhatsappInbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        phone: z.string().min(6).max(24),
        body: z.string().max(1000).optional(),
        media_url: z.string().url().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { handleInbound } = await import("@/lib/whatsapp/bot.server");
    return handleInbound({
      phone: data.phone,
      body: data.body ?? "",
      mediaUrl: data.media_url ?? null,
    });
  });

/** Admin: retry queued messages once a provider is connected. */
export const retryWhatsappOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { drainOutbox } = await import("@/lib/whatsapp/provider.server");
    return drainOutbox();
  });
