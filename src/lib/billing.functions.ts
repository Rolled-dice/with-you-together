import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  type RazorpayEnv,
  createRazorpaySubscription as createRzpSub,
  cancelRazorpaySubscription as cancelRzpSub,
  getRazorpayPlanId,
} from "@/lib/razorpay.server";
import { priceIdFor, type PlanId } from "@/lib/currency";

const StripeEnvSchema = z.enum(["sandbox", "live"]);
const PlanIdSchema = z.enum(["together", "family", "care"]);

// Current pricing lookup keys — one per plan × currency (monthly recurring).
const PRICE_IDS = [
  "together_monthly_inr",
  "together_monthly_usd",
  "family_monthly_inr",
  "family_monthly_usd",
  "care_monthly_inr",
  "care_monthly_usd",
] as const;

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  // Stripe Search API is not available in all regions/sandboxes. Try it, but
  // fall back to list-by-email if it errors.
  try {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  } catch (err) {
    console.warn("customers.search unavailable, falling back to list:", (err as Error)?.message);
  }

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

const CheckoutInput = z.object({
  priceId: z.enum(PRICE_IDS),
  returnUrl: z.string().url(),
  environment: StripeEnvSchema,
});

export const createMembershipCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);

      const { data: { user } } = await context.supabase.auth.getUser();
      const email = user?.email ?? undefined;

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) return { error: "Price not found" };
      const stripePrice = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, {
        email,
        userId: context.userId,
      });

      // 7-day free trial only on the Together plan (₹799 / $8.99 monthly),
      // and only for first-time subscribers (no prior subscription rows).
      const isTogetherMonthly =
        data.priceId === "together_monthly_inr" ||
        data.priceId === "together_monthly_usd";

      let offerTrial = false;
      if (isTogetherMonthly) {
        const { data: prior } = await context.supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", context.userId)
          .limit(1)
          .maybeSingle();
        offerTrial = !prior;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        // Always collect a payment method so billing auto-starts after the trial.
        payment_method_collection: "always",
        metadata: { userId: context.userId },
        subscription_data: {
          metadata: { userId: context.userId },
          ...(offerTrial && {
            trial_period_days: 7,
            trial_settings: {
              end_behavior: { missing_payment_method: "cancel" },
            },
          }),
        },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

const PortalInput = z.object({
  returnUrl: z.string().url(),
  environment: StripeEnvSchema,
});

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PortalInput.parse(input))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { data: sub, error: subError } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) return { error: subError.message };
    if (!sub?.stripe_customer_id) return { error: "No subscription found" };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: StripeEnvSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end, provider")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return sub;
  });

// ---------------------------------------------------------------------------
// Razorpay (INR subscriptions). Razorpay serves India/INR customers; Stripe
// continues to serve USD. Plan IDs are pre-created on the Razorpay dashboard
// and resolved from env per environment.
// ---------------------------------------------------------------------------

const RazorpayCheckoutInput = z.object({
  plan: PlanIdSchema,
  environment: StripeEnvSchema,
});

export const createRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RazorpayCheckoutInput.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { subscriptionId: string; shortUrl: string | null } | { error: string }
    > => {
      try {
        const env = data.environment as RazorpayEnv;
        const plan = data.plan as PlanId;
        const planId = getRazorpayPlanId(env, plan);
        const priceId = priceIdFor(plan, "inr");

        const {
          data: { user },
        } = await context.supabase.auth.getUser();

        const subscription = await createRzpSub(env, {
          planId,
          userId: context.userId,
          email: user?.email ?? undefined,
          priceId,
        });

        // Store an incomplete row keyed by the Razorpay subscription id. The
        // webhook flips it to active on subscription.activated/charged. This
        // makes the subscription discoverable before the first webhook lands.
        const { error: upsertError } = await context.supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: context.userId,
              provider: "razorpay",
              razorpay_subscription_id: subscription.id,
              razorpay_customer_id: subscription.customer_id ?? null,
              product_id: planId,
              price_id: priceId,
              status: "incomplete",
              environment: env,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "razorpay_subscription_id" },
          );
        if (upsertError) return { error: upsertError.message };

        return {
          subscriptionId: subscription.id,
          shortUrl: subscription.short_url ?? null,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Razorpay request failed",
        };
      }
    },
  );

export const cancelRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ environment: StripeEnvSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { data: sub, error: subError } = await context.supabase
      .from("subscriptions")
      .select("razorpay_subscription_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .eq("provider", "razorpay")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) return { error: subError.message };
    const rzpId = (sub as { razorpay_subscription_id?: string } | null)
      ?.razorpay_subscription_id;
    if (!rzpId) return { error: "No Razorpay subscription found" };

    try {
      // cancel_at_cycle_end: keep access until the paid period ends. The
      // webhook records the resulting status change.
      await cancelRzpSub(data.environment as RazorpayEnv, rzpId, true);
      return { ok: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Razorpay cancel failed",
      };
    }
  });
