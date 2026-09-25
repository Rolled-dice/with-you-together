# Dodo Payments setup

SomeoneNear uses Dodo Payments as its sole payment provider. The app starts in **test mode** and is designed so that a future live rollout is a reviewed deployment configuration change, not a code rewrite.

The implementation uses raw `fetch` and Web Crypto only, which is compatible with the Cloudflare Worker runtime.

Official documentation verified for this integration:

- [Dodo subscription integration guide](https://docs.dodopayments.com/developer-resources/subscription-integration-guide)
- [Dodo checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session)
- [Dodo webhooks](https://docs.dodopayments.com/developer-resources/webhooks)
- [Dodo API introduction](https://docs.dodopayments.com/api-reference/introduction)

## Payment environments

The server is the source of truth for payment mode. The browser never submits an environment or chooses test versus live.

| Mode | API base URL                    | Server selector          | Browser display flag  |
| ---- | ------------------------------- | ------------------------ | --------------------- |
| Test | `https://test.dodopayments.com` | `DODO_PAYMENTS_ENV=test` | `VITE_DODO_MODE=test` |
| Live | `https://live.dodopayments.com` | `DODO_PAYMENTS_ENV=live` | `VITE_DODO_MODE=live` |

`DODO_PAYMENTS_ENV` defaults to `test` if absent. Any other value causes the payment operation to fail closed.

> Keep `DODO_PAYMENTS_ENV` and `VITE_DODO_MODE` aligned on each deployment. The public `VITE_` flag controls only the sandbox banner and displayed billing history. Checkout, cancellation, subscription lookup, API keys, products, and webhook verification always use the server selector.

## 1. Create four Dodo products per environment

Create one recurring monthly subscription product for every plan and currency combination in the Dodo environment being configured.

| Internal `price_id`     | Product                  | Variable suffix         |
| ----------------------- | ------------------------ | ----------------------- |
| `care_monthly_usd`      | Care — $49/month         | `PRODUCT_CARE_USD`      |
| `care_plus_monthly_usd` | Care Plus — $79/month    | `PRODUCT_CARE_PLUS_USD` |
| `care_monthly_inr`      | Care — ₹3,999/month      | `PRODUCT_CARE_INR`      |
| `care_plus_monthly_inr` | Care Plus — ₹6,499/month | `PRODUCT_CARE_PLUS_INR` |

Use `DODO_TEST_` for sandbox products and `DODO_LIVE_` for production products, for example `DODO_TEST_PRODUCT_CARE_USD`.

> **Critical entitlement rule:** A Dodo product ID belongs in `subscriptions.product_id`. The application’s internal key, such as `care_plus_monthly_usd`, must be stored in `subscriptions.price_id`. The `sync_care_tier_from_subscription()` trigger tests `care_plus%` before `care%`; storing a Dodo ID in `price_id` would leave the member on the free tier.

## 2. Configure server-only secrets

Put actual secrets in the local [`.env.local`](../.env.local) file or Lovable Cloud secrets. Never commit them and never use a `VITE_` prefix.

```dotenv
# Phase A default
DODO_PAYMENTS_ENV="test"
VITE_DODO_MODE="test"

DODO_TEST_API_KEY=""
DODO_TEST_WEBHOOK_SECRET=""
DODO_TEST_PRODUCT_CARE_USD=""
DODO_TEST_PRODUCT_CARE_PLUS_USD=""
DODO_TEST_PRODUCT_CARE_INR=""
DODO_TEST_PRODUCT_CARE_PLUS_INR=""

# Reserve these for the approved live rollout; leave them unset in test deployments.
DODO_LIVE_API_KEY=""
DODO_LIVE_WEBHOOK_SECRET=""
DODO_LIVE_PRODUCT_CARE_USD=""
DODO_LIVE_PRODUCT_CARE_PLUS_USD=""
DODO_LIVE_PRODUCT_CARE_INR=""
DODO_LIVE_PRODUCT_CARE_PLUS_INR=""
```

The webhook secret is the Standard Webhooks secret from Dodo, usually beginning with `whsec_`.

## 3. Apply the billing migrations

Apply [`20260920123000_dodo_test_provider.sql`](../supabase/migrations/20260920123000_dodo_test_provider.sql) and [`20260921090000_dodo_only_provider.sql`](../supabase/migrations/20260921090000_dodo_only_provider.sql).

They add Dodo provider IDs, preserve the Dodo subscription unique index, and keep the existing RLS/privilege model. Regenerate Supabase TypeScript types through the standard Lovable/Supabase workflow after schema changes. Do not manually modify generated files in [`src/integrations/supabase/`](../src/integrations/supabase/).

## 4. Register a webhook for the active environment

Create a Dodo webhook endpoint for the deployment mode:

```text
https://<your-domain>/api/public/payments/dodo-webhook?env=test
```

Later, production uses the same route with `?env=live`.

Subscribe to:

- `subscription.active`
- `subscription.renewed`
- `subscription.updated`
- `subscription.on_hold`
- `subscription.failed`
- `subscription.cancelled`
- `payment.succeeded`
- `payment.failed`

The route verifies `webhook-id`, `webhook-timestamp`, and `webhook-signature` against the untouched raw request body before parsing JSON. It uses the signing secret for the configured mode and ignores deliveries whose URL mode differs from the active server mode. It rejects invalid signatures and timestamps older than five minutes with `400`, and uses `webhook-id` for database idempotency.

## 5. Test-mode acceptance checklist

1. Set `DODO_PAYMENTS_ENV=test` and `VITE_DODO_MODE=test`.
2. Create all four Dodo test products and add their IDs as server-only test variables.
3. Register the test webhook and add its signing secret as `DODO_TEST_WEBHOOK_SECRET`.
4. Use Dodo Dashboard → Developer → Webhooks → Testing to send signed examples for each subscribed event.
5. Complete a hosted Dodo test checkout for every plan/currency combination.
6. Verify the subscription row has `provider = 'dodo'`, the Dodo product ID in `product_id`, and the expected internal `price_id`.
7. Confirm the subscription trigger changes `profiles.care_tier` to `care` or `care_plus`.
8. Replay the same signed webhook and confirm the endpoint returns `duplicate: true` without another subscription or billing-event write.
9. Send a request with a bad signature and confirm it returns `400` without a database write.
10. Cancel a test subscription and confirm the Dodo cancel-at-period-end state is reflected by the next signed subscription event.

## Live rollout prerequisite

Do not set `DODO_PAYMENTS_ENV=live` until live products, `DODO_LIVE_API_KEY`, `DODO_LIVE_WEBHOOK_SECRET`, and the live webhook endpoint are all configured and verified with dashboard example events. The live environment must use a separate Dodo API key, webhook secret, and product IDs from test mode.
