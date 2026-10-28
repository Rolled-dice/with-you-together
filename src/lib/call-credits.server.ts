import { z } from "zod";
import { callCreditCommand } from "./family.server";
import {
  dodoBaseUrl,
  getDodoApiKey,
  getDodoEnvironment,
  type DodoEnvironment,
} from "./dodo.config.server";

export function extraCallCatalog() {
  const environment = getDodoEnvironment();
  const offers = (["INR", "USD"] as const).map((currency) => ({
    currency,
    amount: Number(process.env[`EXTRA_CALL_AMOUNT_${currency}`] || 0),
    productId:
      process.env[`DODO_${environment.toUpperCase()}_PRODUCT_EXTRA_CALL_${currency}`] || "",
  }));
  const enabled =
    process.env.EXTRA_CALLS_ENABLED === "true" &&
    process.env.EXTRA_CALL_TERMS_READY === "true" &&
    offers.every(
      (offer) => Number.isSafeInteger(offer.amount) && offer.amount > 0 && offer.productId,
    );
  return { enabled, offers, environment };
}
export async function getExtraCallBalance(actor: string) {
  return z
    .object({
      can_buy: z.boolean(),
      available: z.number(),
      expires_at: z.string().nullable(),
      purchase_expires_at: z.string().nullable(),
    })
    .parse(await callCreditCommand(actor, "balance"));
}
export async function getExtraCallOptions(actor: string) {
  const catalog = extraCallCatalog();
  const balance = await getExtraCallBalance(actor);
  return {
    ...balance,
    enabled: Boolean(catalog.enabled),
    offers: catalog.enabled
      ? catalog.offers.map(({ currency, amount }) => ({ currency, amount }))
      : [],
  };
}
export async function createExtraCallCheckout(
  actor: string,
  currency: "INR" | "USD",
  expiresAt: string,
) {
  const catalog = extraCallCatalog();
  if (!catalog.enabled) throw new Error("Extra-call purchases are not available yet.");
  const offer = catalog.offers.find((item) => item.currency === currency)!;
  const order = z.object({ id: z.string(), expires_at: z.string() }).parse(
    await callCreditCommand(actor, "order", {
      product_id: offer.productId,
      currency,
      amount: offer.amount,
      environment: catalog.environment,
      expected_expires_at: expiresAt,
    }),
  );
  const response = await fetch(`${dodoBaseUrl(catalog.environment)}/checkouts`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${getDodoApiKey(catalog.environment)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [{ product_id: offer.productId, quantity: 1 }],
      return_url: new URL("/listeners", process.env.APP_URL || "https://www.someonenear.com").href,
      metadata: {
        userId: actor,
        kind: "extra_call",
        orderId: order.id,
        expiresAt: order.expires_at,
      },
    }),
  });
  if (!response.ok) throw new Error("Checkout could not be opened. Please try again.");
  const checkout = z.object({ checkout_url: z.string().url() }).parse(await response.json());
  return { checkoutUrl: checkout.checkout_url, expiresAt: order.expires_at };
}
export async function applyExtraCallPayment(
  actor: string,
  resource: unknown,
  environment: DodoEnvironment,
) {
  const payment = z
    .object({
      payment_id: z.string().min(1),
      currency: z.enum(["INR", "USD"]),
      total_amount: z.number().int().positive(),
      metadata: z.object({
        kind: z.literal("extra_call"),
        orderId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
      product_cart: z
        .array(z.object({ product_id: z.string().min(1), quantity: z.literal(1) }))
        .length(1),
    })
    .parse(resource);
  if (payment.metadata.userId !== actor) throw new Error("Call purchase owner mismatch.");
  await callCreditCommand(actor, "payment", {
    order_id: payment.metadata.orderId,
    payment_id: payment.payment_id,
    product_id: payment.product_cart[0].product_id,
    amount: payment.total_amount,
    currency: payment.currency,
    environment,
  });
}
