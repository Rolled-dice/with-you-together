import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellIcon } from "@phosphor-icons/react";
import { markNotificationsRead, dismissNotification } from "@/lib/notifications.functions";
import { NotificationList } from "@/components/notifications/notification-list";
import { notificationKey, useNotifications } from "@/features/notifications/use-notifications";
import { useIdentity } from "@/features/session/session-store";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

export function NotificationBell({ className, label }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const query = useNotifications();
  const qc = useQueryClient();
  const { userId } = useIdentity();
  const markRead = useServerFn(markNotificationsRead);
  const dismiss = useServerFn(dismissNotification);
  const mutation = useMutation({
    mutationFn: (id: string | null) =>
      id
        ? dismiss({ data: { id } })
        : markRead({
            data: { ids: (query.data?.items ?? []).filter((n) => !n.read_at).map((n) => n.id) },
          }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKey(userId) });
    },
    onError: () => toast.error("Your update wasn’t saved. Please try again."),
  });
  const unread = query.isError ? 0 : (query.data?.unreadCount ?? 0);
  const shownUnread = (query.data?.items ?? []).filter((n) => !n.read_at).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${label ? "inline-flex items-center gap-2" : "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted"} ${className ?? ""}`}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <BellIcon className="h-5 w-5" />
          {label && <span>{label}</span>}
          {unread > 0 && (
            <span
              aria-hidden="true"
              className={
                label
                  ? "sn-notification-count"
                  : "absolute right-0 top-0 rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
              }
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="sn-notification-inbox max-h-[70dvh] w-96 max-w-[calc(100vw-2rem)] overflow-auto"
      >
        <header>
          <h2 className="font-semibold">Your updates</h2>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>
            Close
          </button>
        </header>
        <p>In-app updates for your account. Phone push notifications are not enabled.</p>
        {query.isPending ? (
          <DataSkeleton />
        ) : query.isError ? (
          <DataError retry={() => void query.refetch()} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {unread} unread · Showing the latest {query.data?.items.length ?? 0} updates
            </p>
            {shownUnread > 0 && (
              <button
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(null)}
                className="min-h-11 text-sm underline disabled:opacity-50"
              >
                Mark shown as read
              </button>
            )}
            <NotificationList
              disabled={mutation.isPending}
              items={query.data?.items ?? []}
              onDismiss={(id) => {
                if (!mutation.isPending) mutation.mutate(id);
              }}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
