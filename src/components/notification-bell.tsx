import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  dismissNotification,
  listMyNotifications,
  markNotificationsRead,
} from "@/lib/notifications.functions";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS: Record<string, string> = {
  info: "border-border",
  warning: "border-amber-300 bg-amber-50/60",
  critical: "border-red-300 bg-red-50/60",
};

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const dismiss = useServerFn(dismissNotification);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list({}),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("notifications-bell")
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
            markRead({ data: {} }).then(() =>
              qc.invalidateQueries({ queryKey: ["notifications"] }),
            );
          }
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-brand text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="h-4.5 w-4.5" />
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
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nothing yet. Call reminders will appear here.
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "mb-2 rounded-brand border p-3 last:mb-0",
                    SEVERITY_CLASS[n.severity] ?? "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <button
                      aria-label="Dismiss"
                      onClick={() =>
                        dismiss({ data: { id: n.id } }).then(() =>
                          qc.invalidateQueries({ queryKey: ["notifications"] }),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {n.body && (
                    <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
