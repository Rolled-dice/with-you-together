import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  getDodoEnvironment,
  getDodoWebhookSecret,
  type DodoEnvironment,
} from "@/lib/dodo.config.server";
import { mapDodoStatus, verifyDodoWebhook } from "@/lib/dodo.server";

type DodoResource = Record<string, unknown>;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase webhook credentials are not configured");
  return createClient<Database>(url, serviceRoleKey);
}

function asObject(value: unknown): DodoResource {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as DodoResource) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function metadataFor(resource: DodoResource): DodoResource {
  const metadata = resource.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as DodoResource;
  }

  const checkout = asObject(resource.checkout);
  const checkoutMetadata = checkout.metadata;
  return checkoutMetadata &&
    typeof checkoutMetadata === "object" &&
    !Array.isArray(checkoutMetadata)
    ? (checkoutMetadata as DodoResource)
    : {};
}

function resourceFor(payload: DodoResource): DodoResource {
  const data = asObject(payload.data);
  return asObject(data.data ?? data.payload ?? data);
}

function dodoSubscriptionId(resource: DodoResource): string | null {
  return (
    asString(resource.subscription_id) ??
    asString(resource.id) ??
    asString(asObject(resource.subscription).subscription_id) ??
    asString(asObject(resource.subscription).id)
  );
}

function dodoCustomerId(resource: DodoResource): string | null {
  return (
    asString(resource.customer_id) ??
    asString(asObject(resource.customer).customer_id) ??
    asString(asObject(resource.customer).id)
  );
}

function periodDate(resource: DodoResource, key: string): string | null {
  const value = resource[key];
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
  }
  return null;
}

async function recordWebhook(
  supabase: ReturnType<typeof getSupabase>,
  payload: DodoResource,
  environment: DodoEnvironment,
  eventId: string,
  resource: DodoResource,
): Promise<boolean> {
  const metadata = metadataFor(resource);
  const { error } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: eventId,
    event_type: asString(payload.type) ?? "unknown",
    environment,
    provider: "dodo",
    user_id: asString(metadata.userId),
    dodo_subscription_id: dodoSubscriptionId(resource),
    processed: false,
    payload: payload as never,
  } as never);

  if (!error) return true;
  if (`${error.message}`.toLowerCase().includes("duplicate")) return false;
  throw new Error(`Dodo webhook ledger insert failed: ${error.message}`);
}

async function markProcessed(
  supabase: ReturnType<typeof getSupabase>,
  eventId: string,
  error?: string,
) {
  const { error: updateError } = await supabase
    .from("stripe_webhook_events")
    .update({
      processed: !error,
      error: error ?? null,
      processed_at: new Date().toISOString(),
    } as never)
    .eq("stripe_event_id", eventId);

  if (updateError) console.error("Dodo webhook ledger update failed:", updateError.message);
}

async function logBillingEvent(
  supabase: ReturnType<typeof getSupabase>,
  row: {
    userId: string;
    eventType: string;
    eventId: string;
    subscriptionId: string | null;
    priceId: string;
    status: string | null;
    environment: DodoEnvironment;
    resource: DodoResource;
  },
) {
  const { error } = await supabase.from("billing_events").insert({
    user_id: row.userId,
    event_type: row.eventType,
    stripe_event_id: row.eventId,
    dodo_subscription_id: row.subscriptionId,
    provider: "dodo",
    price_id: row.priceId,
    amount_cents: typeof row.resource.amount === "number" ? row.resource.amount : null,
    currency: asString(row.resource.currency),
    status: row.status,
    environment: row.environment,
    metadata: row.resource as never,
  } as never);
  if (error) throw new Error(`Dodo billing event insert failed: ${error.message}`);
}

async function upsertSubscription(
  supabase: ReturnType<typeof getSupabase>,
  resource: DodoResource,
  environment: DodoEnvironment,
  eventId: string,
  eventType: string,
) {
  const metadata = metadataFor(resource);
  const userId = asString(metadata.userId);
  const priceId = asString(metadata.priceId);
  const subscriptionId = dodoSubscriptionId(resource);
  if (!userId || !priceId || !subscriptionId) {
    throw new Error("Dodo subscription event is missing required metadata or subscription id");
  }

  const status = mapDodoStatus(asString(resource.status) ?? "");
  const productId =
    asString(resource.product_id) ??
    asString(asObject(resource.product).product_id) ??
    asString(asObject(resource.product).id) ??
    "";
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "dodo",
      dodo_subscription_id: subscriptionId,
      dodo_customer_id: dodoCustomerId(resource),
      product_id: productId,
      // This must be our internal key, never a Dodo product ID.
      price_id: priceId,
      status,
      current_period_start: periodDate(resource, "current_period_start"),
      current_period_end:
        periodDate(resource, "current_period_end") ?? periodDate(resource, "next_billing_date"),
      cancel_at_period_end: Boolean(resource.cancel_at_next_billing_date),
      environment,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "dodo_subscription_id" },
  );
  if (error) throw new Error(`Dodo subscription upsert failed: ${error.message}`);

  await logBillingEvent(supabase, {
    userId,
    eventType,
    eventId,
    subscriptionId,
    priceId,
    status,
    environment,
    resource,
  });
}

async function processWebhook(
  supabase: ReturnType<typeof getSupabase>,
  payload: DodoResource,
  environment: DodoEnvironment,
  eventId: string,
) {
  const eventType = asString(payload.type) ?? "unknown";
  const resource = resourceFor(payload);
  const metadata = metadataFor(resource);
  const userId = asString(metadata.userId);
  if (!userId) {
    console.error("Dodo webhook missing metadata.userId; event will not be applied", {
      eventId,
      eventType,
    });
    throw new Error("Dodo webhook missing metadata.userId");
  }

  switch (eventType) {
    case "subscription.active":
      await upsertSubscription(supabase, resource, environment, eventId, "subscription.updated");
      return;
    case "subscription.renewed":
      await upsertSubscription(supabase, resource, environment, eventId, "subscription.renewed");
      await logBillingEvent(supabase, {
        userId,
        eventType: "invoice.paid",
        eventId: `${eventId}:invoice`,
        subscriptionId: dodoSubscriptionId(resource),
        priceId: asString(metadata.priceId) ?? "",
        status: "active",
        environment,
        resource,
      });
      return;
    case "subscription.updated":
    case "subscription.on_hold":
    case "subscription.failed":
    case "subscription.cancelled":
      await upsertSubscription(supabase, resource, environment, eventId, "subscription.updated");
      return;
    case "payment.succeeded":
    case "payment.failed":
      await logBillingEvent(supabase, {
        userId,
        eventType: eventType === "payment.succeeded" ? "payment.succeeded" : "payment.failed",
        eventId,
        subscriptionId: dodoSubscriptionId(resource),
        priceId: asString(metadata.priceId) ?? "",
        status: asString(resource.status),
        environment,
        resource,
      });
      return;
    default:
      console.log("Unhandled Dodo webhook event:", eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/dodo-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestedEnvironment = new URL(request.url).searchParams.get("env");
        if (requestedEnvironment !== "test" && requestedEnvironment !== "live") {
          console.error("Dodo webhook missing/invalid env:", requestedEnvironment);
          return Response.json({ received: true, ignored: "invalid env" });
        }

        let environment: DodoEnvironment;
        let webhookSecret: string;
        try {
          environment = getDodoEnvironment();
          if (requestedEnvironment !== environment) {
            console.error("Dodo webhook environment does not match active payment mode:", {
              requestedEnvironment,
              environment,
            });
            return Response.json({ received: true, ignored: "environment mismatch" });
          }
          webhookSecret = getDodoWebhookSecret(environment);
        } catch (error) {
          console.error("Dodo webhook configuration failure:", error);
          return Response.json({ error: "Webhook is not configured" }, { status: 500 });
        }

        const rawBody = await request.text();
        const valid = await verifyDodoWebhook(rawBody, request.headers, webhookSecret);
        if (!valid) return Response.json({ error: "Invalid signature" }, { status: 400 });

        let payload: DodoResource;
        try {
          payload = JSON.parse(rawBody) as DodoResource;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const eventId = request.headers.get("webhook-id");
        if (!eventId) return Response.json({ error: "Invalid signature" }, { status: 400 });

        try {
          const supabase = getSupabase();
          const resource = resourceFor(payload);
          const isNew = await recordWebhook(supabase, payload, environment, eventId, resource);
          if (!isNew) return Response.json({ received: true, duplicate: true });

          try {
            await processWebhook(supabase, payload, environment, eventId);
            await markProcessed(supabase, eventId);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("Dodo webhook processing failed:", message);
            await markProcessed(supabase, eventId, message);
          }
        } catch (error) {
          // A valid event must not cause retries forever because of a transient
          // persistence error. The error is logged for operational follow-up.
          console.error("Dodo webhook infrastructure failure:", error);
        }

        return Response.json({ received: true });
      },
    },
  },
});
