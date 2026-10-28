import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { z } from "zod";

type DeliveryFunction =
  | "push_command"
  | "prepare_reminder_delivery"
  | "claim_reminder_push"
  | "finish_reminder_push"
  | "deliver_family_messages";
type DeliveryDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: Record<DeliveryFunction, { Args: Record<string, Json>; Returns: Json }>;
  };
};
const db = supabaseAdmin as unknown as SupabaseClient<DeliveryDatabase>;
export async function deliveryRpc(name: DeliveryFunction, args: Record<string, Json> = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error)
    throw new Error(
      error.code === "P0001"
        ? error.message
        : "Notification service is unavailable. Please try again.",
    );
  return data;
}
export function validPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(
        url.hostname,
      ) ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const PushSubscriptionInput = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine(validPushEndpoint, "Unsupported notification provider."),
  p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
  auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
});
export function pushConfig() {
  return {
    enabled:
      process.env.FAMILY_PUSH_ENABLED === "true" &&
      Boolean(
        process.env.WEB_PUSH_PUBLIC_KEY &&
        process.env.WEB_PUSH_PRIVATE_KEY &&
        process.env.WEB_PUSH_SUBJECT,
      ),
    publicKey: process.env.WEB_PUSH_PUBLIC_KEY || "",
  };
}
export async function updatePushDevice(
  actor: string,
  action: "subscribe" | "disable" | "status",
  data: Json,
) {
  if (action === "subscribe" && !pushConfig().enabled)
    throw new Error("Background notifications are not available yet.");
  return deliveryRpc("push_command", { p_actor: actor, p_action: action, p_data: data });
}
const PushJobs = z.array(
  z.object({
    id: z.string().uuid(),
    lease_token: z.string().uuid(),
    endpoint: z.string(),
    p256dh: z.string(),
    auth: z.string(),
    tag: z.string(),
    url: z.enum(["/family", "/reminders?view=everyday"]),
  }),
);
export async function deliverFamilyReminders() {
  const prepared = await deliveryRpc("prepare_reminder_delivery");
  if (!pushConfig().enabled) return { prepared, sent: 0, pushEnabled: false };
  const jobs = PushJobs.parse(await deliveryRpc("claim_reminder_push"));
  let sent = 0;
  for (const job of jobs) {
    let outcome = "retry";
    try {
      if (!validPushEndpoint(job.endpoint)) {
        outcome = "gone";
      } else {
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              tag: job.tag,
              title: "SomeoneNear",
              body: "A reminder is ready. Open the app to review it.",
              url: job.url,
            }),
            options: { ttl: 300 },
          },
          {
            endpoint: job.endpoint,
            expirationTime: null,
            keys: { p256dh: job.p256dh, auth: job.auth },
          },
          {
            subject: process.env.WEB_PUSH_SUBJECT!,
            publicKey: process.env.WEB_PUSH_PUBLIC_KEY!,
            privateKey: process.env.WEB_PUSH_PRIVATE_KEY!,
          },
        );
        const response = await fetch(job.endpoint, {
          ...payload,
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
        outcome = response.ok
          ? "sent"
          : response.status === 404 || response.status === 410
            ? "gone"
            : "retry";
      }
    } catch {
      console.warn("[family-push] delivery will retry", { jobId: job.id });
    }
    await deliveryRpc("finish_reminder_push", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_outcome: outcome,
    });
    if (outcome === "sent") sent++;
  }
  return { prepared, sent, pushEnabled: true };
}
