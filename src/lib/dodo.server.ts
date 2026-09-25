import {
  dodoBaseUrl,
  dodoProductIdForPrice,
  getDodoApiKey,
  getDodoEnvironment,
  type DodoEnvironment,
  type DodoPriceId,
} from "@/lib/dodo.config.server";

export type DodoEnv = DodoEnvironment;

export type DodoCheckoutSession = {
  checkoutUrl: string;
  subscriptionId: string;
};

type DodoCheckoutResponse = {
  checkout_url?: string;
  session_id?: string;
  subscription_id?: string;
  id?: string;
};

async function dodoFetch<T>(
  env: DodoEnv,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${dodoBaseUrl(env)}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getDodoApiKey(env)}`,
      "Content-Type": "application/json",
    },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { message: raw };
  }

  if (!response.ok) {
    const message =
      (parsed as { detail?: string; message?: string; error?: { message?: string } })?.detail ??
      (parsed as { detail?: string; message?: string; error?: { message?: string } })?.message ??
      (parsed as { error?: { message?: string } })?.error?.message ??
      `Dodo Payments request failed (${response.status})`;
    throw new Error(message);
  }

  return parsed as T;
}

/**
 * Creates a hosted Dodo Checkout Session. The internal price key is deliberately
 * retained in metadata; it is not a Dodo product identifier and must be stored
 * in subscriptions.price_id by the server/webhook so tier entitlements work.
 */
export async function createDodoCheckoutSession(params: {
  env: DodoEnv;
  productId: string;
  priceId: string;
  userId: string;
  email?: string;
  returnUrl: string;
}): Promise<DodoCheckoutSession> {
  const session = await dodoFetch<DodoCheckoutResponse>(params.env, "/checkouts", {
    method: "POST",
    body: {
      product_cart: [{ product_id: params.productId, quantity: 1 }],
      ...(params.email ? { customer: { email: params.email } } : {}),
      return_url: params.returnUrl,
      metadata: { userId: params.userId, priceId: params.priceId },
    },
  });

  const checkoutUrl = session.checkout_url;
  // The documented response guarantees session_id. Some subscription checkouts
  // also provide subscription_id; prefer it when available for direct upserts.
  const subscriptionId = session.subscription_id ?? session.session_id ?? session.id;
  if (!checkoutUrl || !subscriptionId) {
    throw new Error("Dodo Payments returned an incomplete checkout session");
  }

  return { checkoutUrl, subscriptionId };
}

export async function cancelDodoSubscription(params: {
  env: DodoEnv;
  subscriptionId: string;
  atPeriodEnd: boolean;
}): Promise<void> {
  if (!params.subscriptionId.trim()) throw new Error("Invalid Dodo subscription id");

  await dodoFetch(params.env, `/subscriptions/${encodeURIComponent(params.subscriptionId)}`, {
    method: "PATCH",
    body: { cancel_at_next_billing_date: params.atPeriodEnd },
  });
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  const maxLength = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

/**
 * Verifies a Standard Webhooks v1 HMAC-SHA256 signature against the untouched
 * raw payload. The Dodo secret is `whsec_` plus a base64-encoded key.
 */
export async function verifyDodoWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const webhookId = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!webhookId || !timestamp || !signatureHeader || !secret) return false;

  const sentAtSeconds = Number(timestamp);
  if (!Number.isFinite(sentAtSeconds) || Math.abs(Date.now() - sentAtSeconds * 1000) > 5 * 60_000) {
    return false;
  }

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let secretBytes: Uint8Array;
  try {
    secretBytes = base64ToBytes(encodedSecret);
  } catch {
    return false;
  }

  // Make a fresh ArrayBuffer-backed view for TypeScript's strict Web Crypto
  // BufferSource type while retaining Web-standard runtime APIs only.
  const keyBytes = new Uint8Array(secretBytes);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = `${webhookId}.${timestamp}.${rawBody}`;
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );

  for (const candidate of signatureHeader.split(/\s+/)) {
    const [version, signature] = candidate.split(",", 2);
    if (version !== "v1" || !signature) continue;
    try {
      if (timingSafeEqualBytes(mac, base64ToBytes(signature))) return true;
    } catch {
      // Ignore malformed signature values and continue checking other v1 values.
    }
  }

  return false;
}

export function mapDodoStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "active";
    case "on_hold":
      return "past_due";
    case "failed":
      return "incomplete_expired";
    case "cancelled":
    case "expired":
      return "canceled";
    case "trialing":
      return "trialing";
    case "pending":
    case "created":
      return "incomplete";
    default:
      return status;
  }
}

export async function createDodoCheckoutForUser(
  supabase: any,
  userId: string,
  input: { priceId: DodoPriceId; returnUrl: string },
): Promise<{ checkoutUrl: string } | { error: string }> {
  try {
    const environment = getDodoEnvironment();
    const productId = dodoProductIdForPrice(input.priceId, environment);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const session = await createDodoCheckoutSession({
      env: environment,
      productId,
      priceId: input.priceId,
      userId,
      email: user?.email ?? undefined,
      returnUrl: input.returnUrl,
    });

    // Subscription state is written only by the verified Dodo webhook using the
    // Supabase service role. The browser-authenticated client has read-only RLS
    // access to billing records and must never create or alter subscription rows.
    return { checkoutUrl: session.checkoutUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dodo checkout failed" };
  }
}

export async function cancelDodoSubscriptionForUser(
  supabase: any,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const environment = getDodoEnvironment();
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("dodo_subscription_id")
      .eq("user_id", userId)
      .eq("provider", "dodo")
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };

    const subscriptionId = (subscription as { dodo_subscription_id?: string } | null)
      ?.dodo_subscription_id;
    if (!subscriptionId) return { error: "No Dodo subscription found" };

    await cancelDodoSubscription({ env: environment, subscriptionId, atPeriodEnd: true });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dodo cancellation failed" };
  }
}

export async function getDodoSubscriptionForUser(supabase: any, userId: string) {
  const environment = getDodoEnvironment();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, price_id, current_period_end, cancel_at_period_end, provider")
    .eq("user_id", userId)
    .eq("provider", "dodo")
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message };
  return data;
}
