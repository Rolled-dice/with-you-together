-- Sync the live schema and generated types with the Razorpay provider columns.
-- All statements are idempotent (IF NOT EXISTS / DROP IF EXISTS) so they are
-- safe to re-run.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text;

ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_stripe_subscription_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_stripe_sub_id
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_razorpay_sub_id
  ON public.subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;