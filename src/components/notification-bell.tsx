import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, XIcon } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import type { AppNotification } from "@/lib/notifications.functions";
import { cn } from "@/lib/utils";
import { NotificationList } from "@/components/notifications/notification-list";
import { useNavigate } from "@tanstack/react-router";

/**
 * CONTAINER (data + platform coupled — Tier 2/3, see
 * docs/architecture/expo-readiness.md). Owns the Supabase realtime
 * subscription, the server-fn data layer, and the web dropdown/popover
 * chrome. Delegates the actual thread rendering to the presentational
 * <NotificationList>, which is portable. On a future Expo port this file is
 * rewritten (native data + a bottom sheet or screen), while NotificationList
 * carries over.
 */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, booking_id, kind, severity, title, body, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return (data ?? []) as AppNotification[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-bell-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread) {
            void supabase
              .from("notifications")
              .update({ read_at: new Date().toISOString() })
              .in("id", items.filter((item) => !item.read_at).map((item) => item.id))
              .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
          }
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-brand text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <BellIcon className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-brand border border-border bg-surface shadow-lg animate-fade-in">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close notifications"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <NotificationList
            className="max-h-80 overflow-y-auto p-2"
            items={items}
            onOpen={(item) => {
              setOpen(false);
              if (item.kind === "family_reminder") void navigate({ to: "/reminders", search: { view: "everyday" } });
              else void navigate({ to: item.kind === "send_later" ? "/send-later" : item.kind?.startsWith("family_") ? "/family" : "/listeners" });
            }}
            onDismiss={(id) => {
              void supabase
                .from("notifications")
                .delete()
                .eq("id", id)
                .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
            }}
          />
        </div>
      )}
    </div>
  );
}
