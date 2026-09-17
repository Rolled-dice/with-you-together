import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type RazorpayEnv,
  verifyRazorpayWebhook,
  mapRazorpayStatus,
} from "@/lib/razorpay.server";

// Razorpay webhook receiver, mirroring the Stripe webhook route. Razorpay
// signs the RAW body with HMAC-SHA256 (hex) in X-Razorpay-Signature, so we
// must read the body as text and verify before parsing. Uses a service-role
// Supabase client to bypass RLS for subscription/billing writes.

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

type RzpEntity = Record<string, any>;

function getSubscriptionEntity(event: any): RzpEntity | null {
  return event?.payload?.subscription?.entity ?? null;
}

function getPaymentEntity(event: any): RzpEntity | null {
  return event?.payload?.payment?.entity ?? null;
}

// Razorpay does not include a single unique event id in the body, so we
// synthesise a stable idempotency key from provider + event + subscription +
// created_at (seconds). Stored in the existing stripe_event_id UNIQUE column.
function synthEventId(event: any, sub: RzpEntity | null): string {
  const created = event?.created_at ?? Math.floor(Date.now() / 1000);
  const subId = sub?.id ?? event?.payload?.payment?.entity?.id ?? "unknown";
  return `razorpay:${event?.event ?? "unknown"}:${subId}:${created}`;
}

async function recordWebhook(
  event: any,
  env: RazorpayEnv,
  eventId: string,
  sub: RzpEntity | null,
) {
  const userId = sub?.notes?.userId ?? null;
  const payload = JSON.parse(JSON.stringify(event?.payload ?? {}));
  const { error } = await getSupabase()
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: eventId,
      event_type: event?.event ?? "unknown",
      environment: env,
      provider: "razorpay",
      user_id: userId,
      razorpay_subscription_id: sub?.id ?? null,
      processed: false,
      payload,
    } as any);
  if (error && !`${error.message}`.includes("duplicate")) {
    console.error("razorpay webhook_events insert failed:", error);
  }
  // Signal duplicates to the caller so we can skip reprocessing.
  return !(error && `${error.message}`.includes("duplicate"));
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

async function logEvent(row: {
  user_id?: string | null;
  event_type: string;
  stripe_event_id?: string | null;
  razorpay_subscription_id?: string | null;
  price_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  environment: RazorpayEnv;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabase()
    .from("billing_events")
    .insert({ ...row, provider: "razorpay" } as any);
  if (error && !`${error.message}`.includes("duplicate")) {
    console.error("billing_events insert failed:", error);
  }
}

async function upsertFromSubscription(
  sub: RzpEntity,
  env: RazorpayEnv,
  eventId: string,
  eventType: string,
) {
  const userId = sub?.notes?.userId ?? null;
  if (!userId) {
    console.error("Razorpay subscription missing notes.userId");
    return;
  }
  const status = mapRazorpayStatus(String(sub?.status ?? ""));
  const priceId = sub?.notes?.priceId ?? null;
  const periodStart = sub?.current_start
    ? new Date(sub.current_start * 1000).toISOString()
    : null;
  const periodEnd = sub?.current_end
    ? new Date(sub.current_end * 1000).toISOString()
    : null;

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        provider: "razorpay",
        razorpay_subscription_id: sub.id,
        razorpay_customer_id: sub?.customer_id ?? null,
        product_id: sub?.plan_id ?? "",
        price_id: priceId ?? "",
        status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        // Razorpay signals end-of-cycle cancel via has_scheduled_changes /
        // end_at; treat a cancel schedule as cancel_at_period_end.
        cancel_at_period_end: Boolean(sub?.end_at) && status !== "canceled",
        environment: env,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "razorpay_subscription_id" },
    );

  await logEvent({
    user_id: userId,
    event_type: eventType,
    stripe_event_id: eventId,
    razorpay_subscription_id: sub.id,
    price_id: priceId,
    status,
    environment: env,
    metadata: {
      razorpay_status: sub?.status ?? null,
      current_period_end: periodEnd,
    },
  });
}

async function handleCharged(
  sub: RzpEntity | null,
  payment: RzpEntity | null,
  env: RazorpayEnv,
  eventId: string,
) {
  const userId = sub?.notes?.userId ?? null;
  await logEvent({
    user_id: userId,
    event_type: "invoice.paid",
    stripe_event_id: eventId,
    razorpay_subscription_id: sub?.id ?? null,
    price_id: sub?.notes?.priceId ?? null,
    amount_cents: payment?.amount ?? null, // Razorpay amounts are already in paise/cents
    currency: payment?.currency ?? null,
    status: payment?.status ?? null,
    environment: env,
    metadata: { payment_id: payment?.id ?? null },
  });
  // Also refresh the subscription row (active + new period) if present.
  if (sub) await upsertFromSubscription(sub, env, `${eventId}:sub`, "subscription.charged");
}

async function handleWebhook(rawBody: string, signature: string | null, env: RazorpayEnv) {
  const valid = await verifyRazorpayWebhook(rawBody, signature, env);
  if (!valid) throw new Error("Invalid webhook signature");

  const event = JSON.parse(rawBody);
  const sub = getSubscriptionEntity(event);
  const payment = getPaymentEntity(event);
  const eventId = synthEventId(event, sub);

  const isNew = await recordWebhook(event, env, eventId, sub);
  if (!isNew) return; // idempotent: already processed this event

  try {
    switch (event?.event) {
      case "subscription.activated":
      case "subscription.authenticated":
      case "subscription.updated":
      case "subscription.resumed":
        if (sub) await upsertFromSubscription(sub, env, eventId, "subscription.updated");
        break;
      case "subscription.charged":
        await handleCharged(sub, payment, env, eventId);
        break;
      case "subscription.pending":
      case "subscription.halted":
        if (sub) await upsertFromSubscription(sub, env, eventId, "subscription.updated");
        break;
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.expired":
        if (sub) await upsertFromSubscription(sub, env, eventId, "subscription.canceled");
        break;
      default:
        console.log("Unhandled Razorpay event:", event?.event);
    }
    await markProcessed(eventId);
  } catch (e: any) {
    await markProcessed(eventId, e?.message ?? String(e));
    throw e;
  }
}

export const Route = createFileRoute("/api/public/payments/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Razorpay webhook missing/invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          const rawBody = await request.text();
          const signature = request.headers.get("x-razorpay-signature");
          await handleWebhook(rawBody, signature, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Razorpay webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
