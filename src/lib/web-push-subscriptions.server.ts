import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const browserPushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith("https://")),
  keys: z.object({
    p256dh: z.string().min(32).max(256),
    auth: z.string().min(16).max(128),
  }),
});

export type BrowserPushSubscription = z.infer<typeof browserPushSubscriptionSchema>;

export async function saveWebPushSubscription(
  client: SupabaseClient,
  userId: string,
  input: BrowserPushSubscription,
) {
  const subscription = browserPushSubscriptionSchema.parse(input);
  const now = new Date().toISOString();
  const table = client.from("push_devices");
  const { data: existing, error: lookupError } = await table
    .select("user_id")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();
  if (lookupError) throw new Error("Could not check this device's notification settings.");
  if (existing && existing.user_id !== userId)
    throw new Error("This browser is already connected to a different account.");

  const payload = {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth_key: subscription.keys.auth,
    enabled: true,
    updated_at: now,
  };
  const { error } = existing
    ? await table.update(payload).eq("user_id", userId).eq("endpoint", subscription.endpoint)
    : await table.insert(payload);
  if (error) throw new Error("Could not save this device's notification settings.");
  return { ok: true } as const;
}

export async function removeWebPushSubscription(
  client: SupabaseClient,
  userId: string,
  endpointInput: string,
) {
  const endpoint = browserPushSubscriptionSchema.shape.endpoint.parse(endpointInput);
  const { error } = await client
    .from("push_devices")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw new Error("Could not disable this device's notification settings.");
  return { ok: true } as const;
}
