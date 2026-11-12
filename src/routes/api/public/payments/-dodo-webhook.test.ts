import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  insertError: null as null | { code: string; message: string },
  processed: false,
  current: {} as Record<string, unknown>,
  subscriptionRows: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/dodo.config.server", () => ({
  getDodoEnvironment: () => "live",
  getDodoWebhookSecret: () => "qa-secret",
}));
vi.mock("@/lib/dodo.server", () => ({
  verifyDodoWebhook: async () => true,
  retrieveDodoSubscription: async () => state.current,
  mapDodoStatus: (status: string) => status === "cancelled" ? "canceled" : status,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: async () => ({ error: table === "stripe_webhook_events" ? state.insertError : null }),
      upsert: async (row: Record<string, unknown>) => {
        if (table === "subscriptions") state.subscriptionRows.push(row);
        return { error: null };
      },
      select: () => ({ eq: () => ({ single: async () => ({ data: { processed: state.processed }, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { Route } from "./dodo-webhook";

type Handler = (input: { request: Request }) => Promise<Response>;
const handler = (Route as unknown as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers.POST;

function delivery(type = "qa.probe") {
  return handler({ request: new Request("https://www.someonenear.com/api/public/payments/dodo-webhook?env=live", {
    method: "POST",
    headers: { "webhook-id": "qa-event", "content-type": "application/json" },
    body: JSON.stringify({ type, data: {
      subscription_id: "sub-1", status: "active", metadata: { userId: "user-1", priceId: "care_launch_2026_11_in" },
    } }),
  }) });
}

afterEach(() => {
  state.insertError = null;
  state.processed = false;
  state.current = {};
  state.subscriptionRows.length = 0;
  vi.unstubAllEnvs();
});

describe("Dodo webhook delivery", () => {
  it("returns a retryable error if the event cannot be recorded", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    state.insertError = { code: "XX000", message: "database unavailable" };
    expect((await delivery()).status).toBe(503);
  });

  it("reprocesses a recorded event that never completed", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    state.insertError = { code: "23505", message: "duplicate key" };
    state.processed = false;
    expect((await delivery()).status).toBe(200);
  });

  it("acknowledges a previously processed event without replaying it", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    state.insertError = { code: "23505", message: "duplicate key" };
    state.processed = true;
    const response = await delivery();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true });
  });

  it("uses the current provider state when an older active event arrives after cancellation", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    state.current = {
      subscription_id: "sub-1", status: "cancelled", product_id: "pdt-1",
      next_billing_date: "2026-11-14T00:00:00Z",
      metadata: { userId: "user-1", priceId: "care_launch_2026_11_in" },
    };
    expect((await delivery("subscription.active")).status).toBe(200);
    expect(state.subscriptionRows).toContainEqual(expect.objectContaining({ status: "canceled" }));
  });

  it("activates membership from a verified payment without a provider lookup", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const response = await handler({ request: new Request("https://www.someonenear.com/api/public/payments/dodo-webhook?env=live", {
      method: "POST",
      headers: { "webhook-id": "payment-event", "content-type": "application/json" },
      body: JSON.stringify({
        type: "payment.succeeded",
        data: {
          subscription_id: "sub-paid",
          customer: { customer_id: "cus-paid" },
          created_at: "2026-11-12T14:42:21.484Z",
          service_periods: [{
            starts_at: "2026-11-12T14:42:21.484Z",
            ends_at: "2026-11-19T14:42:55.322Z",
          }],
          metadata: { userId: "user-1", priceId: "care_launch_2026_11_in" },
          status: "succeeded",
        },
      }),
    }) });

    expect(response.status).toBe(200);
    expect(state.subscriptionRows).toContainEqual(expect.objectContaining({
      dodo_subscription_id: "sub-paid",
      dodo_customer_id: "cus-paid",
      price_id: "care_launch_2026_11_in",
      status: "active",
      current_period_end: "2026-11-19T14:42:55.322Z",
      environment: "live",
    }));
  });
});
