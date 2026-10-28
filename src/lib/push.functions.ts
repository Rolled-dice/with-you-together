import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PushSubscriptionInput, pushConfig, updatePushDevice } from "./family-delivery.server";
export const getPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => pushConfig());
export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PushSubscriptionInput.parse(i))
  .handler(({ context, data }) => updatePushDevice(context.userId, "subscribe", data));
export const disablePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ endpoint: z.string().url().max(2048) }).parse(i))
  .handler(({ context, data }) => updatePushDevice(context.userId, "disable", data));
export const getPushStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ endpoint: z.string().url().max(2048) }).parse(i))
  .handler(async ({ context, data }) =>
    z
      .object({ enabled: z.boolean() })
      .parse(await updatePushDevice(context.userId, "status", data)),
  );
