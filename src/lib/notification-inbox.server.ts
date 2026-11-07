import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppNotification } from "./notifications.functions";
function visibleNotifications(client: SupabaseClient, userId: string, countOnly = false) {
  return client
    .from("notifications")
    .select(
      countOnly ? "id" : "id,booking_id,kind,severity,title,body,read_at,created_at",
      countOnly ? { count: "exact", head: true } : {},
    )
    .eq("user_id", userId)
    .is("booking_id", null)
    .not("kind", "ilike", "%call%")
    .not("kind", "ilike", "%telnyx%")
    .not("kind", "ilike", "%sla%")
    .not("kind", "ilike", "%escalat%");
}
export async function readNotificationInbox(client: SupabaseClient, userId: string) {
  const [items, unread] = await Promise.all([
    visibleNotifications(client, userId).order("created_at", { ascending: false }).limit(30),
    visibleNotifications(client, userId, true).is("read_at", null),
  ]);
  // Notifications are a non-critical enhancement. During a PostgREST schema
  // cache refresh, keep the authenticated shell usable and show an empty inbox
  // instead of surfacing a global retry toast on every page.
  if (items.error || unread.error) return { items: [], unreadCount: 0 };
  return {
    items: (items.data ?? []) as unknown as AppNotification[],
    unreadCount: unread.count ?? 0,
  };
}
