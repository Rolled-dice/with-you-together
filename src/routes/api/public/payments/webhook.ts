import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function resolvePriceKey(item: any): string {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    ""
  );
}

async function logEvent(row: {
  user_id?: string | null;
  event_type: string;
  stripe_event_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_invoice_id?: string | null;
  price_id?: string | null;
  previous_price_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  environment: StripeEnv;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabase()
    .from("billing_events")
    .insert(row as any);
  // Ignore duplicate-key errors (idempotent retries from Stripe).
  if (error && !`${error.message}`.includes("duplicate")) {
    console.error("billing_events insert failed:", error);
  }
}

async function getExistingPriceId(subscriptionId: string, env: StripeEnv) {
  const { data } = await getSupabase()
    .from("subscriptions")
    .select("price_id")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  return data?.price_id ?? null;
}

async function handleSubscriptionUpsert(
  subscription: any,
  env: StripeEnv,
  eventId: string,
  eventType: string,
) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceKey(item);
  const productId = item?.price?.product ?? "";
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const previousPriceId = await getExistingPriceId(subscription.id, env);

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  await logEvent({
    user_id: userId,
    event_type: eventType,
    stripe_event_id: eventId,
    stripe_subscription_id: subscription.id,
    price_id: priceId,
    previous_price_id: previousPriceId,
    status: subscription.status,
    environment: env,
    metadata: {
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    },
  });
}

async function handleSubscriptionDeleted(
  subscription: any,
  env: StripeEnv,
  eventId: string,
) {
  const userId = subscription.metadata?.userId ?? null;
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  await logEvent({
    user_id: userId,
    event_type: "subscription.canceled",
    stripe_event_id: eventId,
    stripe_subscription_id: subscription.id,
    status: "canceled",
    environment: env,
  });
}

async function handleCheckoutCompleted(
  session: any,
  env: StripeEnv,
  eventId: string,
) {
  const userId = session.metadata?.userId ?? null;
  await logEvent({
    user_id: userId,
    event_type: "checkout.completed",
    stripe_event_id: eventId,
    stripe_subscription_id:
      typeof session.subscription === "string" ? session.subscription : null,
    amount_cents: session.amount_total ?? null,
    currency: session.currency ?? null,
    status: session.payment_status ?? null,
    environment: env,
    metadata: { mode: session.mode },
  });
}

async function handleInvoicePaid(
  invoice: any,
  env: StripeEnv,
  eventId: string,
) {
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : null;
  let userId: string | null = null;
  if (subscriptionId) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("environment", env)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  const line = invoice.lines?.data?.[0];
  await logEvent({
    user_id: userId,
    event_type: "invoice.paid",
    stripe_event_id: eventId,
    stripe_subscription_id: subscriptionId,
    stripe_invoice_id: invoice.id ?? null,
    price_id: resolvePriceKey(line),
    amount_cents: invoice.amount_paid ?? null,
    currency: invoice.currency ?? null,
    status: invoice.status ?? null,
    environment: env,
    metadata: {
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      billing_reason: invoice.billing_reason ?? null,
    },
  });
}

async function handleInvoiceFailed(
  invoice: any,
  env: StripeEnv,
  eventId: string,
) {
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : null;
  let userId: string | null = null;
  if (subscriptionId) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("environment", env)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  await logEvent({
    user_id: userId,
    event_type: "invoice.payment_failed",
    stripe_event_id: eventId,
    stripe_subscription_id: subscriptionId,
    stripe_invoice_id: invoice.id ?? null,
    amount_cents: invoice.amount_due ?? null,
    currency: invoice.currency ?? null,
    status: invoice.status ?? null,
    environment: env,
    metadata: {
      attempt_count: invoice.attempt_count ?? null,
      next_payment_attempt: invoice.next_payment_attempt ?? null,
    },
  });
}

function extractRefs(obj: any): {
  userId: string | null;
  subId: string | null;
  custId: string | null;
} {
  const userId = obj?.metadata?.userId ?? null;
  const subId =
    obj?.object === "subscription"
      ? obj?.id
      : typeof obj?.subscription === "string"
        ? obj.subscription
        : null;
  const custId =
    typeof obj?.customer === "string"
      ? obj.customer
      : (obj?.customer?.id ?? null);
  return { userId, subId, custId };
}

async function recordWebhook(event: any, env: StripeEnv) {
  const refs = extractRefs(event?.data?.object ?? {});
  // Truncate payload to keep row small.
  const payload = JSON.parse(JSON.stringify(event?.data?.object ?? {}));
  const { error } = await getSupabase()
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      environment: env,
      user_id: refs.userId,
      stripe_subscription_id: refs.subId,
      stripe_customer_id: refs.custId,
      processed: false,
      payload,
    } as any);
  if (error && !`${error.message}`.includes("duplicate")) {
    console.error("stripe_webhook_events insert failed:", error);
  }
}

async function markProcessed(eventId: string, err?: string) {
  await getSupabase()
    .from("stripe_webhook_events")
    .update({
      processed: !err,
      error: err ?? null,
      processed_at: new Date().toISOString(),
    } as any)
    .eq("stripe_event_id", eventId);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const eventId = (event as any).id ?? "";
  await recordWebhook(event, env);
  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionUpsert(event.data.object, env, eventId, "subscription.created");
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object, env, eventId, "subscription.updated");
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env, eventId);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env, eventId);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object, env, eventId);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object, env, eventId);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    await markProcessed(eventId);
  } catch (e: any) {
    await markProcessed(eventId, e?.message ?? String(e));
    throw e;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
