import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const StripeEnvSchema = z.enum(["sandbox", "live"]);

// New pricing lookup keys (monthly only), plus legacy keys for existing subs.
const PRICE_IDS = [
  "together_monthly_inr",
  "together_monthly_usd",
  "family_monthly_inr",
  "family_monthly_usd",
  "care_monthly_inr",
  "care_monthly_usd",
  // legacy
  "together_monthly",
  "family_monthly",
  "together_yearly",
  "family_yearly",
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
      .select("status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return sub;
  });
