import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cancelDodoSubscriptionForUser,
  createDodoCheckoutForUser,
  getDodoSubscriptionForUser,
} from "@/lib/dodo.server";

const PriceIdSchema = z.enum([
  "care_monthly_inr",
  "care_monthly_usd",
  "care_plus_monthly_inr",
  "care_plus_monthly_usd",
]);

const DodoCheckoutInput = z.object({
  priceId: PriceIdSchema,
  environment: z.literal("test"),
  returnUrl: z.string().url(),
});

export const createDodoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DodoCheckoutInput.parse(input))
  .handler(({ data, context }) => createDodoCheckoutForUser(context.supabase, context.userId, data));

export const cancelDodoSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: z.literal("test") }).parse(input))
  .handler(({ data, context }) =>
    cancelDodoSubscriptionForUser(context.supabase, context.userId, data.environment),
  );

export const getMyDodoSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getDodoSubscriptionForUser(context.supabase, context.userId));