-- Dodo Payments support (test mode initially): extend the provider-aware billing
-- schema without changing Stripe/Razorpay behavior or the provider-agnostic tier
-- sync trigger. Dodo rows MUST retain our internal price_id lookup key so that
-- sync_care_tier_from_subscription() can derive care/care_plus correctly.

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dodo_subscription_id text,
  ADD COLUMN IF NOT EXISTS dodo_customer_id text;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('stripe', 'razorpay', 'dodo'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_dodo_sub_id
  ON public.subscriptions (dodo_subscription_id)
  WHERE dodo_subscription_id IS NOT NULL;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_id_present;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_id_present
  CHECK (
    (provider = 'stripe'   AND stripe_subscription_id   IS NOT NULL) OR
    (provider = 'razorpay' AND razorpay_subscription_id IS NOT NULL) OR
    (provider = 'dodo'     AND dodo_subscription_id     IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- billing events and generic webhook idempotency ledger
-- ---------------------------------------------------------------------------

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS dodo_subscription_id text;

ALTER TABLE public.billing_events
  DROP CONSTRAINT IF EXISTS billing_events_provider_check;

ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_provider_check
  CHECK (provider IN ('stripe', 'razorpay', 'dodo'));

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS dodo_subscription_id text;

ALTER TABLE public.stripe_webhook_events
  DROP CONSTRAINT IF EXISTS stripe_webhook_events_provider_check;

ALTER TABLE public.stripe_webhook_events
  ADD CONSTRAINT stripe_webhook_events_provider_check
  CHECK (provider IN ('stripe', 'razorpay', 'dodo'));

-- Existing tables retain their RLS policies. Re-assert table privileges in the
-- same migration; no anon permissions are granted.
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;