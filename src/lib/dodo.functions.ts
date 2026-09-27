import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cancelDodoSubscriptionForUser,
  createDodoCheckoutForUser,
  getDodoSubscriptionForUser,
  reconcileDodoSubscriptionForUser,
} from "@/lib/dodo.server";

const PriceIdSchema = z.enum([
  "care_monthly_inr",
  "care_monthly_usd",
  "care_plus_monthly_inr",
  "care_plus_monthly_usd",
]);

const DodoCheckoutInput = z.object({
  priceId: PriceIdSchema,
  returnUrl: z.string().url(),
});

export const createDodoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DodoCheckoutInput.parse(input))
  .handler(({ data, context }) =>
    createDodoCheckoutForUser(context.supabase, context.userId, data),
  );

export const cancelDodoSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => cancelDodoSubscriptionForUser(context.supabase, context.userId));

export const getMyDodoSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getDodoSubscriptionForUser(context.supabase, context.userId));

/**
 * Coverage info for the Settings membership card. Lets the UI show a
 * "Covered by <owner>" panel for non-owner family members (who can't buy or
 * cancel their own plan) instead of the plan cards.
 */
export const getMyCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getEffectiveTier } = await import("@/lib/tier.server");
    const e = await getEffectiveTier(context.supabase, context.userId);
    return {
      tier: e.tier,
      isMember: e.isMember,
      isOwner: e.isOwner,
      ownerName: e.ownerName,
    };
  });

const ReconcileInput = z.object({ subscriptionId: z.string().optional() });

/**
 * Reconcile the signed-in user's Dodo subscription from the Dodo API into
 * Supabase. Used on checkout return so the plan activates immediately without
 * depending on webhook delivery. Writes use the service-role client.
 */
export const reconcileDodoSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReconcileInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return reconcileDodoSubscriptionForUser(supabaseAdmin, context.userId, {
      subscriptionId: data.subscriptionId ?? null,
    });
  });
