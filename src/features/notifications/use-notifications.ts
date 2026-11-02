import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listMyNotifications } from "@/lib/notifications.functions";
import { assertIdentity, getIdentity, useIdentity } from "@/features/session/session-store";

const notificationsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    booking_id: z.string().nullable(),
    kind: z.string(),
    severity: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    read_at: z.string().nullable(),
    created_at: z.string(),
  }),
);
export const notificationKey = (id: string | null) => ["notifications", id] as const;
export function useNotifications() {
  const { userId, generation } = useIdentity();
  const list = useServerFn(listMyNotifications);
  return useQuery({
    queryKey: notificationKey(userId),
    enabled: !!userId,
    retry: 1,
    queryFn: async () => {
      const result = await list();
      assertIdentity(generation);
      return notificationsSchema
        .parse(result)
        .filter((item) => !item.booking_id && !/call|telnyx|sla|escalat/i.test(item.kind));
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// Mount once under the authenticated route, never once per desktop/mobile bell.
export function RealtimeRecovery({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reconciling = false;
    const generation = getIdentity().generation;
    const reconcile = () => {
      if (disposed || reconciling || document.visibilityState !== "visible") return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        reconciling = true;
        void supabase.auth
          .getSession()
          .then(async ({ data, error }) => {
            if (
              disposed ||
              error ||
              data.session?.user.id !== userId ||
              getIdentity().generation !== generation
            )
              return;
            const prefixes = [
              "notifications",
              "dashboard",
              "reminders",
              "me",
              "medications",
              "send-later",
              "send-later-received",
            ];
            await queryClient.invalidateQueries({
              predicate: (q) => prefixes.includes(String(q.queryKey[0])),
            });
          })
          .catch(() => {
            /* Existing query error UI remains visible; next wake retries. */
          })
          .finally(() => {
            reconciling = false;
          });
      }, 150);
    };
    const channel = supabase
      .channel(`member-updates:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        reconcile,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") reconcile();
      });
    window.addEventListener("online", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("online", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
  return null;
}
