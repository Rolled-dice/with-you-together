import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // New table not yet in generated Supabase types; untyped access (repo convention).
    const db = context.supabase as any;
    const { data } = await db
      .from("google_calendar_credentials")
      .select("google_email, sync_enabled, calendar_id, last_synced_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      google_email: data.google_email,
      sync_enabled: data.sync_enabled,
      calendar_id: data.calendar_id,
      last_synced_at: data.last_synced_at,
    };
  });

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signState } = await import("@/lib/calendar/crypto.server");
    const { buildConsentUrl } = await import("@/lib/calendar/google-api.server");
    const encKey = process.env["CALENDAR_TOKEN_ENC_KEY"];
    const clientId = process.env["GOOGLE_CALENDAR_CLIENT_ID"];
    const redirectUri = process.env["GOOGLE_CALENDAR_REDIRECT_URI"];
    if (!encKey || !clientId || !redirectUri) {
      throw new Error("Google Calendar is not configured on the server yet.");
    }
    const state = await signState({ userId: context.userId }, encKey, 600_000);
    return { url: buildConsentUrl({ clientId, redirectUri, state }) };
  });

export const setCalendarSyncEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as any;
    const { error } = await db
      .from("google_calendar_credentials")
      .update({ sync_enabled: data.enabled })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { error } = await db
      .from("google_calendar_credentials")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
