import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppNotification = {
  id: string;
  booking_id: string | null;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, booking_id, kind, severity, title, body, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as AppNotification[];
  });

export const getNotificationInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readNotificationInbox } = await import("./notification-inbox.server");
    return readNotificationInbox(context.supabase, context.userId);
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const q = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null)
      .in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveMyPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      endpoint: z.string().url().max(2048),
      keys: z.object({ p256dh: z.string().min(32).max(256), auth: z.string().min(16).max(128) }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { saveWebPushSubscription }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/web-push-subscriptions.server"),
    ]);
    return saveWebPushSubscription(supabaseAdmin, context.userId, data);
  });

export const removeMyPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) =>
    z.object({ endpoint: z.string().url().max(2048) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { removeWebPushSubscription }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/web-push-subscriptions.server"),
    ]);
    return removeWebPushSubscription(supabaseAdmin, context.userId, data.endpoint);
  });

export const sendTestPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ supabaseAdmin }, { sendGenericReminderPush }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/web-push.server"),
    ]);
    const { data: devices, error } = await supabaseAdmin
      .from("push_devices")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", context.userId)
      .eq("enabled", true);

    if (error) throw new Error(error.message);
    if (!devices || devices.length === 0) {
      throw new Error("No active device notification registered yet. Click 'Enable on this device' first.");
    }

    let sentCount = 0;
    for (const d of devices) {
      const outcome = await sendGenericReminderPush(
        { endpoint: d.endpoint, p256dh: d.p256dh, authKey: d.auth_key },
        {
          destination: "/reminders",
          title: "SomeoneNear · Gentle Reminder",
          body: "This is a test notification. Your phone is ready for zero-cost medication & hydration alerts!",
        },
        process.env,
      );
      if (outcome === "sent") sentCount++;
    }
    return { ok: true, sent: sentCount };
  });

/** Runs the SLA ladder for the signed-in user's own upcoming calls (client-triggered fallback for cron). */
export const runMySlaLadder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { evaluateSlaLadder } = await import("@/lib/sla-ladder.server");
    return evaluateSlaLadder(context.supabase, context.userId);
  });
