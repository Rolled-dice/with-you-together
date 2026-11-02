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

export function NotificationBell({ className }: { className?: string }) {
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
            data: { ids: (query.data ?? []).filter((n) => !n.read_at).map((n) => n.id) },
          }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKey(userId) });
    },
    onError: () => toast.error("Your update wasn’t saved. Please try again."),
  });
  const unread = (query.data ?? []).filter((n) => !n.read_at).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted ${className ?? ""}`}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <BellIcon className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-auto"
      >
        <h2 className="font-semibold">Notifications</h2>
        {query.isPending ? (
          <DataSkeleton />
        ) : query.isError ? (
          <DataError retry={() => void query.refetch()} />
        ) : (
          <>
            {unread > 0 && (
              <button
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(null)}
                className="min-h-11 text-sm underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
            <NotificationList
              items={query.data}
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
