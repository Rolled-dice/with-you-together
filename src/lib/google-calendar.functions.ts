import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Legacy Google Calendar OAuth functions — DEPRECATED.
 * Replaced by zero-OAuth RFC 5545 / RFC 6047 calendar synchronization engine (@/lib/calendar-sync).
 */

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      connected: false as const,
      zeroOAuth: true as const,
      message: "Zero-OAuth calendar synchronization is active.",
    };
  });

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      ok: false as const,
      code: "oauth_retired" as const,
      message: "Google Calendar OAuth is no longer required. Calendar invites sync automatically.",
    };
  });

export const setCalendarSyncEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { ok: true };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { ok: true };
  });
