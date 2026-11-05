import { getRequest } from "@tanstack/react-start/server";
import { getDodoApiKey, getDodoEnvironment } from "./dodo.config.server";
import {
  LAUNCH_CATALOG_VERSION,
  launchMarket,
  type LaunchPlan,
  type MarketId,
} from "./launch-catalog";
import { launchDodoTestCatalog, launchTestProductId } from "./launch-dodo-products";

export function launchCheckoutPayload(
  input: { plan: LaunchPlan; market: MarketId },
  userId: string,
  origin: string,
) {
  const productId = launchTestProductId(input.market, input.plan);
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

export async function createLaunchTestCheckout(
  input: { plan: LaunchPlan; market: MarketId },
  userId: string,
) {
  if (getDodoEnvironment() !== "test")
    throw new Error("Launch checkout is currently available in test mode only.");
  const payload = launchCheckoutPayload(input, userId, new URL(getRequest().url).origin);
  const headers = {
    Authorization: `Bearer ${getDodoApiKey("test")}`,
    "Content-Type": "application/json",
  };
  const productResponse = await fetch(
    `https://test.dodopayments.com/products/${payload.product_cart[0].product_id}`,
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!productResponse.ok) throw new Error("Unable to verify the test plan. Please try again.");
  const product = await productResponse.json();
  const expected = launchMarket(input.market);
  if (
    product.price?.type !== "recurring_price" ||
    product.price.currency !== expected.currency ||
    product.price.price !== expected[input.plan] ||
    product.price.trial_period_days !== 7 ||
    product.price.trial_payment_method_optional !== false ||
    product.price.payment_frequency_count !== 1 ||
    product.price.payment_frequency_interval !== "Month"
  ) {
    throw new Error("The test product no longer matches this plan. Checkout has been paused.");
  }
  const discountResponse = await fetch(
    `https://test.dodopayments.com/discounts/${launchDodoTestCatalog.discount.id}`,
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!discountResponse.ok) throw new Error("Unable to verify the first-month test offer.");
  const discount = await discountResponse.json();
  if (
    discount.type !== "percentage" ||
    discount.amount !== 3000 ||
    discount.subscription_cycles !== 1 ||
    !discount.restricted_to?.includes(payload.product_cart[0].product_id)
  )
    throw new Error("The first-month offer has changed. Checkout has been paused.");
  const response = await fetch("https://test.dodopayments.com/checkouts", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Dodo could not start test checkout. Please try again.");
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
