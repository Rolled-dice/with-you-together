# Razorpay setup (INR subscriptions)

SomeoneNear bills INR (India) customers through **Razorpay Subscriptions** and
USD customers through Stripe. The code is provider-aware; this doc lists the
infra steps needed for Razorpay to actually work in each environment.

Currency routing: `currencyForCountry` (India → INR → Razorpay, else USD →
Stripe). The checkout route branches on the price key suffix (`_inr` vs `_usd`).

## 1. Server secrets (set in Lovable Cloud, never commit)

Read via `process.env` inside handlers only.

| Env var | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` / `RAZORPAY_TEST_KEY_ID` | Test/sandbox API Key ID (`rzp_test_…`) |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_TEST_KEY_SECRET` | Test/sandbox API Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` / `RAZORPAY_TEST_WEBHOOK_SECRET` | Test webhook secret (you choose it in the dashboard) |
| `RAZORPAY_LIVE_KEY_ID` | Live API Key ID (`rzp_live_…`) — after account activation |
| `RAZORPAY_LIVE_KEY_SECRET` | Live API Key Secret |
| `RAZORPAY_LIVE_WEBHOOK_SECRET` | Live webhook secret |

### Plan IDs (create on the Razorpay dashboard, one per tier)

Razorpay Subscriptions require pre-created **Plan** objects (monthly, INR).
Create three test plans and three live plans, then set:

| Env var | Tier |
| --- | --- |
| `RAZORPAY_PLAN_TOGETHER` (or `RAZORPAY_TEST_PLAN_TOGETHER`) | Together — ₹799/mo |
| `RAZORPAY_PLAN_FAMILY` (or `RAZORPAY_TEST_PLAN_FAMILY`) | Family — ₹1,499/mo |
| `RAZORPAY_PLAN_CARE` (or `RAZORPAY_TEST_PLAN_CARE`) | Care — ₹3,499/mo |
| `RAZORPAY_LIVE_PLAN_TOGETHER` / `_FAMILY` / `_CARE` | Live equivalents |

## 2. Browser env var

Set in `.env.development` (and the build env). This is the **public** Key ID,
not the secret:

```
VITE_RAZORPAY_KEY_ID="rzp_test_…"
```

## 3. Webhook configuration

In the Razorpay dashboard → Settings → Webhooks, add:

- **Test:** `https://<your-domain>/api/public/payments/razorpay-webhook?env=sandbox`
- **Live:** `https://<your-domain>/api/public/payments/razorpay-webhook?env=live`

Set the webhook secret to match `RAZORPAY_*_WEBHOOK_SECRET`. Subscribe to at
least these events:

- `subscription.activated`, `subscription.charged`, `subscription.updated`
- `subscription.pending`, `subscription.halted`
- `subscription.cancelled`, `subscription.completed`

The receiver verifies the `X-Razorpay-Signature` HMAC over the raw body.

## 4. Database migration

Apply `supabase/migrations/20260916121000_razorpay_provider.sql`. It makes the
billing tables provider-aware (adds `provider`, `razorpay_subscription_id`,
`razorpay_customer_id`), relaxes the Stripe NOT NULL/UNIQUE constraints, and
fixes the `care` tier mapping in `sync_care_tier_from_subscription()`.

## 5. Account activation (3 business days)

Live mode requires Razorpay account activation (KYC). Test mode works
immediately with the test keys. Until activation completes, keep the build on
the test Key ID.

## Security note

Rotate any Razorpay secret that has been shared in plain text (chat, email).
Only the public Key ID belongs in `VITE_*`; the Key Secret and webhook secret
are server-only.
