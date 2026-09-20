# Dodo Payments setup (test mode only)

SomeoneNear uses Dodo Payments as its **sole** payment provider (test mode). Stripe and Razorpay have been removed. It uses Dodo’s test host:

```text
https://test.dodopayments.com
```

The implementation uses raw `fetch` and Web Crypto only, so it is compatible with the Cloudflare Worker runtime.

Official documentation verified for this integration:

- [Dodo subscription integration guide](https://docs.dodopayments.com/developer-resources/subscription-integration-guide)
- [Dodo checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session)
- [Dodo webhooks](https://docs.dodopayments.com/developer-resources/webhooks)

## 1. Create four Dodo test products

In the Dodo test dashboard, create one recurring monthly subscription product for every plan and currency combination.

| Internal `price_id` | Product | Dodo test environment variable |
| --- | --- | --- |
| `care_monthly_usd` | Care — $49/month | `DODO_TEST_PRODUCT_CARE_USD` |
| `care_plus_monthly_usd` | Care Plus — $79/month | `DODO_TEST_PRODUCT_CARE_PLUS_USD` |
| `care_monthly_inr` | Care — ₹3,999/month | `DODO_TEST_PRODUCT_CARE_INR` |
| `care_plus_monthly_inr` | Care Plus — ₹6,499/month | `DODO_TEST_PRODUCT_CARE_PLUS_INR` |

Copy the Dodo product IDs into the matching server-only variables.

> **Critical entitlement rule:** Dodo’s product ID belongs in `subscriptions.product_id`. The application’s internal key—for example `care_plus_monthly_usd`—must be stored in `subscriptions.price_id`. The `sync_care_tier_from_subscription()` trigger tests `care_plus%` before `care%`; storing a Dodo ID in `price_id` would leave the member on the free tier.

## 2. Configure server secrets

Set these variables in Lovable Cloud and in the local worker/server environment. Do not prefix them with `VITE_`; they are never browser-safe.

```dotenv
DODO_PAYMENTS_API_KEY=""
DODO_PAYMENTS_WEBHOOK_KEY=""
DODO_TEST_PRODUCT_CARE_USD=""
DODO_TEST_PRODUCT_CARE_PLUS_USD=""
DODO_TEST_PRODUCT_CARE_INR=""
DODO_TEST_PRODUCT_CARE_PLUS_INR=""
```

`DODO_PAYMENTS_WEBHOOK_KEY` is the Standard Webhooks secret from Dodo, typically beginning with `whsec_`.

## 3. Apply the billing migration

Apply [`20260920123000_dodo_test_provider.sql`](../supabase/migrations/20260920123000_dodo_test_provider.sql). It adds Dodo provider IDs, extends provider constraints, creates the Dodo subscription partial unique index, and preserves existing RLS with authenticated and service-role privileges only.

After the migration, regenerate Supabase TypeScript types through the normal Lovable/Supabase workflow. Generated files under [`src/integrations/supabase/`](../src/integrations/supabase/) are intentionally not edited manually.

## 4. Register the Dodo test webhook

Create a **test-mode** webhook in the Dodo dashboard:

```text
https://<your-domain>/api/public/payments/dodo-webhook?env=test
```

Subscribe to:

- `subscription.active`
- `subscription.renewed`
- `subscription.updated`
- `subscription.on_hold`
- `subscription.failed`
- `payment.succeeded`
- `payment.failed`

The endpoint verifies `webhook-id`, `webhook-timestamp`, and `webhook-signature` against the untouched raw request body before parsing JSON. It rejects invalid signatures and replay timestamps older than five minutes with `400`, and uses `webhook-id` for database idempotency.

## 5. Test checklist

1. In Settings, select **Dodo Payments (test)** as the checkout provider.
2. Complete the hosted checkout with Dodo’s current test payment method.
3. Verify a Dodo row has the correct internal `price_id`, the Dodo product ID in `product_id`, and `provider = 'dodo'`.
4. Confirm the subscription trigger changes `profiles.care_tier` to `care` or `care_plus`.
5. Replay the same signed webhook and confirm the ledger returns `duplicate: true` without another subscription/event write.
6. Send a request with a bad signature and confirm it returns `400` with no database write.

Dodo live mode is intentionally not enabled by this integration.