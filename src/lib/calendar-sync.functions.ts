import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { triggerCalendarSyncForUser } from "@/lib/calendar-sync/supabaseSyncEngine.server";

/**
 * Triggers an immediate calendar synchronization sweep across the member's events.
 */
export const triggerCalendarSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => triggerCalendarSyncForUser(context.userId));

/**
 * Returns current zero-OAuth calendar synchronization status for the member.
 */
export const getCalendarSyncInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return {
      active: true as const,
      protocol: "RFC 5545 / RFC 6047 (iMIP)",
      zeroOAuth: true as const,
      supportedClients: [
        "Apple Calendar (iOS/macOS)",
        "Google Calendar (Android/Web)",
        "Outlook (Desktop/Web)",
      ],
    };
  });
