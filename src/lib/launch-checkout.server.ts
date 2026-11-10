import { getRequest } from "@tanstack/react-start/server";
import { getDodoApiKey, getDodoEnvironment } from "./dodo.config.server";
import {
  LAUNCH_CATALOG_VERSION,
  launchMarket,
  marketForCountry,
  type LaunchPlan,
  type MarketId,
} from "./launch-catalog";
import { launchDodoTestCatalog, launchTestProductId } from "./launch-dodo-products";

type DodoDiscount = {
  code?: unknown;
  type?: unknown;
  amount?: unknown;
  subscription_cycles?: unknown;
  usage_limit?: unknown;
  per_customer_usage_limit?: unknown;
  restricted_to?: unknown;
  expires_at?: unknown;
  customer_eligibility?: unknown;
};

function launchProductId(environment: "test" | "live", market: MarketId, plan: LaunchPlan) {
  if (environment === "test") return launchTestProductId(market, plan);
  const suffix = plan === "care_plus" ? "CARE_PLUS" : "CARE";
  const marketSuffix: Record<MarketId, string> = {
    in: "INR",
    us: "USD",
    gb: "GBP",
    eu: "EUR",
    ca: "CAD",
    au: "AUD",
    pl: "PLN",
    mx: "MXN",
    sg: "SGD",
    jp: "JPY",
    kr: "KRW",
    th: "THB",
    kh: "KH",
    ae: "AED",
    sa: "SAR",
    qa: "QAR",
    kw: "KWD",
    bh: "BHD",
    om: "OMR",
  };
  const catalogValue = process.env.DODO_LIVE_PRODUCT_CATALOG?.trim();
  if (catalogValue) {
    try {
      const catalog = JSON.parse(catalogValue) as Record<string, unknown>;
      const catalogProduct = catalog[`${market}:${plan}`];
      if (typeof catalogProduct === "string" && catalogProduct.trim()) return catalogProduct.trim();
    } catch {
      throw new Error("DODO_LIVE_PRODUCT_CATALOG is invalid");
    }
  }
  return process.env[`DODO_LIVE_PRODUCT_${suffix}_${marketSuffix[market]}`]?.trim() || null;
}

async function resolveTrustedMarket(supabase: any, userId: string, fallback: MarketId): Promise<MarketId> {
  const request = getRequest() as Request & { cf?: { country?: string } };
  const country = request.cf?.country ?? request.headers.get("cf-ipcountry");
  if (country) return marketForCountry(country);
  if (!supabase) return fallback;
  const { data } = await supabase.from("profiles").select("phone_country").eq("id", userId).maybeSingle();
  return marketForCountry(data?.phone_country);
}

export function launchCheckoutPayload(
  input: { plan: LaunchPlan; market: MarketId },
  userId: string,
  origin: string,
) {
  const productId = launchProductId("test", input.market, input.plan);
  if (!productId)
    throw new Error(
      `Test checkout is unavailable in ${launchMarket(input.market).currency}. Your requested price has been preserved.`,
    );
  return {
    product_cart: [{ product_id: productId, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    discount_codes: [launchDodoTestCatalog.discount.code],
    feature_flags: { allow_currency_selection: false, allow_discount_code: false },
    return_url: `${origin}/checkout?plan=${input.plan}&market=${input.market}&completed=1`,
    metadata: {
      userId,
      priceId: `${input.plan}_launch_2026_11_${input.market}`,
      catalogVersion: LAUNCH_CATALOG_VERSION,
      market: input.market,
      plan: input.plan,
    },
  };
}

function internalTesterIds() {
  return new Set(
    (process.env.INTERNAL_TESTER_UID_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isInternalTester(userId: string) {
  return internalTesterIds().has(userId);
}

async function verifyDiscount(
  baseUrl: string,
  headers: Record<string, string>,
  discountId: string,
  productId: string,
  expectedAmount: number,
  options: { requireSingleUse: boolean },
) {
  const response = await fetch(`${baseUrl}/discounts/${encodeURIComponent(discountId)}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Unable to verify the configured Dodo discount.");
  const discount = (await response.json()) as DodoDiscount;
  const restrictedTo = Array.isArray(discount.restricted_to) ? discount.restricted_to : [];
  if (
    discount.type !== "percentage" ||
    discount.amount !== expectedAmount ||
    discount.subscription_cycles !== 1 ||
    !restrictedTo.includes(productId) ||
    typeof discount.code !== "string" ||
    !discount.code.trim()
  ) {
    throw new Error("The configured Dodo discount no longer matches this offer.");
  }
  if (options.requireSingleUse) {
    const expiresAt = typeof discount.expires_at === "string" ? Date.parse(discount.expires_at) : NaN;
    if (
      discount.usage_limit !== 1 ||
      discount.per_customer_usage_limit !== 1 ||
      discount.customer_eligibility !== "specific" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + 48 * 60 * 60 * 1000
    ) {
      throw new Error("The internal Dodo test discount is not restricted enough.");
    }
  }
  return discount.code.trim();
}

export async function createLaunchTestCheckout(
  input: { plan: LaunchPlan; market: MarketId; voucher?: string },
  userId: string,
  supabase?: any,
) {
  const environment = getDodoEnvironment();
  if (!supabase && environment !== "test")
    throw new Error("A signed-in user is required for live checkout.");
  const trustedMarket = await resolveTrustedMarket(supabase, userId, input.market);
  const productId = launchProductId(environment, trustedMarket, input.plan);
  if (!productId) throw new Error(`Checkout is unavailable in ${launchMarket(trustedMarket).currency}.`);

  const { data: existingSubscriptions, error: subscriptionError } = supabase
    ? await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("provider", "dodo")
        .eq("environment", environment)
        .in("status", ["active", "trialing", "cancelled", "on_hold", "expired"])
    : { data: [], error: null };
  let isFirstTimeSubscriber = !existingSubscriptions?.length;
  if (subscriptionError) {
    if (environment === "live") {
      throw new Error("Unable to verify subscription eligibility. Please try again.");
    }
    // Older production projects may not expose the subscription view yet. Use
    // the profile tier as a conservative fallback: an active paid tier never
    // receives another trial, while a new/free account can still open test
    // checkout instead of being blocked before Dodo is contacted.
    const { data: profile } = await supabase
      .from("profiles")
      .select("care_tier, care_status")
      .eq("id", userId)
      .maybeSingle();
    const hasPaidTier =
      profile?.care_status === "active" ||
      profile?.care_tier === "care" ||
      profile?.care_tier === "care_plus";
    isFirstTimeSubscriber = !hasPaidTier;
  }

  if (environment === "live" && existingSubscriptions?.some((row: { status?: string }) =>
    ["active", "trialing", "on_hold"].includes(row.status ?? "")
  )) {
    throw new Error("You already have an active SomeoneNear subscription.");
  }

  const headers = {
    Authorization: `Bearer ${getDodoApiKey(environment)}`,
    "Content-Type": "application/json",
  };
  const baseUrl = environment === "test" ? "https://test.dodopayments.com" : "https://live.dodopayments.com";
  const internalDiscountId =
    environment === "live" && (isInternalTester(userId) || input.voucher)
      ? process.env.DODO_LIVE_INTERNAL_TEST_DISCOUNT_ID?.trim()
      : undefined;
  if (input.voucher && !internalDiscountId) {
    throw new Error("This voucher is unavailable.");
  }

  const payload = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    billing_currency: launchMarket(trustedMarket).currency,
    subscription_data: { trial_period_days: isFirstTimeSubscriber ? 7 : 0 },
    ...(isFirstTimeSubscriber ? { discount_codes: [launchDodoTestCatalog.discount.code] } : {}),
    feature_flags: { allow_currency_selection: false, allow_discount_code: environment === "live" },
    return_url: `${new URL(getRequest().url).origin}/checkout?plan=${input.plan}&market=${trustedMarket}&completed=1`,
    metadata: {
      userId,
      priceId: `${input.plan}_launch_2026_11_${trustedMarket}`,
      catalogVersion: LAUNCH_CATALOG_VERSION,
      market: trustedMarket,
      plan: input.plan,
      isFirstTimeSubscriber: String(isFirstTimeSubscriber),
    },
  } as { discount_codes?: string[]; [key: string]: unknown };
  const productResponse = await fetch(`${baseUrl}/products/${productId}`, { headers, signal: AbortSignal.timeout(15_000) });
  if (!productResponse.ok) throw new Error("Unable to verify the selected Dodo plan. Please try again.");
  const product = await productResponse.json();
  const expected = launchMarket(trustedMarket);
  if (
    product.price?.type !== "recurring_price" ||
    product.price.currency !== expected.currency ||
    product.price.price !== expected[input.plan] ||
    product.price.trial_period_days !== 7 ||
    product.price.trial_payment_method_optional !== false ||
    product.price.payment_frequency_count !== 1 ||
    product.price.payment_frequency_interval !== "Month"
  ) {
    throw new Error("The Dodo product no longer matches this plan. Checkout has been paused.");
  }

  let discountCode: string | null = null;
  if (isFirstTimeSubscriber && !internalDiscountId) {
    const discountId = environment === "test"
      ? launchDodoTestCatalog.discount.id
      : process.env.DODO_LIVE_LAUNCH_DISCOUNT_ID?.trim();
    if (!discountId) throw new Error("The live first-month offer is not configured.");
    discountCode = await verifyDiscount(baseUrl, headers, discountId, productId, 3000, {
      requireSingleUse: false,
    });
  }
  if (internalDiscountId) {
    discountCode = await verifyDiscount(baseUrl, headers, internalDiscountId, productId, 10000, {
      requireSingleUse: true,
    });
    if (input.voucher && input.voucher.trim().toUpperCase() !== discountCode) {
      throw new Error("This voucher is unavailable.");
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !data.user.email) {
      throw new Error("Please sign in again to use your voucher.");
    }
    payload.customer = { email: data.user.email };
  }
  if (discountCode) payload.discount_codes = [discountCode];
  const response = await fetch(`${baseUrl}/checkouts`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Dodo could not start ${environment} checkout. Please try again.`);
  const session = await response.json();
  const checkoutUrl = new URL(session.checkout_url);
  if (
    checkoutUrl.protocol !== "https:" ||
    !checkoutUrl.hostname.endsWith(".dodopayments.com") ||
    typeof session.session_id !== "string"
  )
    throw new Error("Dodo returned an invalid checkout session.");
  return { checkoutUrl: checkoutUrl.href, sessionId: session.session_id };
}
