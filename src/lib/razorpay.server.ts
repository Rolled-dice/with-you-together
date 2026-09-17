// Server-only Razorpay client for INR subscriptions, mirroring the shape of
// stripe.server.ts. Fetch-based (no Node SDK) so it runs on the Cloudflare
// Worker runtime, and all secrets are read from process.env inside handlers,
// never at module scope.
//
// Razorpay is used for INR (India) customers; Stripe continues to serve USD.
// Recurring billing uses Razorpay Subscriptions, which require pre-created
// Plan IDs on the Razorpay dashboard (one per tier + currency). Those IDs are
// account-specific and provided via env (see razorpay-config).

import type { PlanId } from "@/lib/currency";

export type RazorpayEnv = "sandbox" | "live";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

/**
 * Razorpay test keys start with `rzp_test_`, live keys with `rzp_live_`.
 * We keep a single key pair per environment; sandbox uses the test keys,
 * live uses the live keys. Falls back to the generic key names when the
 * env-specific ones are absent (so a single test key set works immediately).
 */
export function getRazorpayCredentials(env: RazorpayEnv): {
  keyId: string;
  keySecret: string;
} {
  if (env === "live") {
    return {
      keyId: getEnv("RAZORPAY_LIVE_KEY_ID"),
      keySecret: getEnv("RAZORPAY_LIVE_KEY_SECRET"),
    };
  }
  // sandbox / test
  return {
    keyId: process.env.RAZORPAY_TEST_KEY_ID ?? getEnv("RAZORPAY_KEY_ID"),
    keySecret: process.env.RAZORPAY_TEST_KEY_SECRET ?? getEnv("RAZORPAY_KEY_SECRET"),
  };
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  // btoa is available on the Worker runtime; avoid Node Buffer for the header.
  const token = btoa(`${keyId}:${keySecret}`);
  return `Basic ${token}`;
}

async function razorpayFetch<T>(
  env: RazorpayEnv,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const { keyId, keySecret } = getRazorpayCredentials(env);
  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: basicAuthHeader(keyId, keySecret),
      "Content-Type": "application/json",
    },
    ...(init?.body !== undefined && { body: JSON.stringify(init.body) }),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const message =
      (parsed as { error?: { description?: string } })?.error?.description ??
      `Razorpay request failed (${res.status})`;
    throw new Error(message);
  }
  return parsed as T;
}

export interface RazorpaySubscription {
  id: string;
  entity: "subscription";
  plan_id: string;
  status: string;
  customer_id?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  short_url?: string | null;
  notes?: Record<string, string> | null;
}

/**
 * Creates a Razorpay Subscription for a plan. `total_count` is the number of
 * billing cycles Razorpay will attempt; for an open-ended monthly membership
 * we set a large horizon (default 120 = 10 years) and rely on cancellation to
 * stop it. Returns the subscription incl. `short_url` (hosted checkout page)
 * and `id` (used to open the in-page Razorpay widget).
 */
export async function createRazorpaySubscription(
  env: RazorpayEnv,
  params: {
    planId: string;
    userId: string;
    email?: string;
    priceId: string;
    totalCount?: number;
    notifyByRazorpay?: boolean;
  },
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(env, "/subscriptions", {
    method: "POST",
    body: {
      plan_id: params.planId,
      total_count: params.totalCount ?? 120,
      // We drive our own notifications; don't let Razorpay email/SMS.
      customer_notify: params.notifyByRazorpay ? 1 : 0,
      notes: {
        userId: params.userId,
        priceId: params.priceId,
        ...(params.email && { email: params.email }),
      },
    },
  });
}

export async function fetchRazorpaySubscription(
  env: RazorpayEnv,
  subscriptionId: string,
): Promise<RazorpaySubscription> {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
    throw new Error("Invalid subscription id");
  }
  return razorpayFetch<RazorpaySubscription>(env, `/subscriptions/${subscriptionId}`);
}

/**
 * Cancels a subscription. `cancelAtCycleEnd` keeps access until the paid
 * period ends (mirrors Stripe's cancel_at_period_end behaviour).
 */
export async function cancelRazorpaySubscription(
  env: RazorpayEnv,
  subscriptionId: string,
  cancelAtCycleEnd = true,
): Promise<RazorpaySubscription> {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
    throw new Error("Invalid subscription id");
  }
  return razorpayFetch<RazorpaySubscription>(env, `/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 },
  });
}

/**
 * Verifies a Razorpay webhook. Razorpay computes HMAC-SHA256 over the RAW
 * request body (keyed with the dashboard webhook secret) and hex-encodes it in
 * the `X-Razorpay-Signature` header. We must hash the exact bytes received, so
 * this takes the raw body string, not parsed JSON.
 */
export async function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  env: RazorpayEnv,
): Promise<boolean> {
  if (!signature || !rawBody) return false;
  const secret =
    env === "live"
      ? getEnv("RAZORPAY_LIVE_WEBHOOK_SECRET")
      : (process.env.RAZORPAY_TEST_WEBHOOK_SECRET ?? getEnv("RAZORPAY_WEBHOOK_SECRET"));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = bytesToHex(new Uint8Array(signed));
  return timingSafeEqualHex(expected, signature);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

// Constant-time comparison to avoid leaking signature bytes via timing.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Maps a Razorpay subscription status to our internal `subscriptions.status`
 * vocabulary (shared with Stripe rows so the care_tier trigger and UI treat
 * them uniformly).
 *
 * Razorpay statuses: created, authenticated, active, pending, halted,
 * cancelled, completed, expired, paused.
 */
export function mapRazorpayStatus(status: string): string {
  switch (status) {
    case "active":
    case "authenticated":
      return "active";
    case "pending":
    case "halted":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "completed":
    case "expired":
      return "canceled";
    case "paused":
      return "paused";
    case "created":
      return "incomplete";
    default:
      return status;
  }
}

/**
 * Resolves the Razorpay Plan ID for a tier. Plan IDs are created on the
 * Razorpay dashboard (they cannot be created at build time) and supplied via
 * env, e.g. RAZORPAY_PLAN_TOGETHER, RAZORPAY_PLAN_FAMILY, RAZORPAY_PLAN_CARE
 * (test) and RAZORPAY_LIVE_PLAN_* for live mode. Razorpay is INR-only here.
 */
export function getRazorpayPlanId(env: RazorpayEnv, plan: PlanId): string {
  const suffix = plan.toUpperCase(); // TOGETHER | FAMILY | CARE
  if (env === "live") return getEnv(`RAZORPAY_LIVE_PLAN_${suffix}`);
  return process.env[`RAZORPAY_TEST_PLAN_${suffix}`] ?? getEnv(`RAZORPAY_PLAN_${suffix}`);
}
