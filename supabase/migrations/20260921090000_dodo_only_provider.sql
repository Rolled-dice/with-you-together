-- Payments: Dodo is now the sole payment provider. Stripe and Razorpay code has
-- been removed, so no new 'stripe'/'razorpay' rows can be created. This forward
-- migration narrows the provider CHECK constraints to 'dodo' only.
--
-- IMPORTANT: this does NOT drop the stripe_*/razorpay_* columns or the shared
-- tables (subscriptions, billing_events, stripe_webhook_events) or the
-- sync_care_tier_from_subscription trigger — those remain in use by Dodo.
--
-- Any pre-existing non-Dodo rows would violate the tightened CHECK. Because the
-- app was in test mode with Dodo as the active provider, we retire those rows
-- first. billing_events / stripe_webhook_events are append-only audit ledgers;
-- historical non-Dodo entries are converted to 'dodo' provenance rather than
-- deleted so the audit trail (amounts, tier changes) is preserved.

-- 1. Retire any non-Dodo subscription rows (unreachable now; test data only).
DELETE FROM public.subscriptions WHERE provider <> 'dodo';

-- 2. Preserve audit history: relabel legacy audit/webhook rows to 'dodo'.
UPDATE public.billing_events        SET provider = 'dodo' WHERE provider <> 'dodo';
UPDATE public.stripe_webhook_events SET provider = 'dodo' WHERE provider <> 'dodo';

-- 3. Narrow the provider CHECK constraints to 'dodo' only.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check CHECK (provider = 'dodo');

ALTER TABLE public.billing_events
  DROP CONSTRAINT IF EXISTS billing_events_provider_check;
ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_provider_check CHECK (provider = 'dodo');

ALTER TABLE public.stripe_webhook_events
  DROP CONSTRAINT IF EXISTS stripe_webhook_events_provider_check;
ALTER TABLE public.stripe_webhook_events
  ADD CONSTRAINT stripe_webhook_events_provider_check CHECK (provider = 'dodo');

-- 4. Simplify the provider->id presence guard to Dodo only.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_id_present;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_id_present
  CHECK (provider = 'dodo' AND dodo_subscription_id IS NOT NULL);

-- 5. Default new subscription rows to 'dodo'.
ALTER TABLE public.subscriptions ALTER COLUMN provider SET DEFAULT 'dodo';
ALTER TABLE public.billing_events ALTER COLUMN provider SET DEFAULT 'dodo';
ALTER TABLE public.stripe_webhook_events ALTER COLUMN provider SET DEFAULT 'dodo';

-- Shared privileges/RLS unchanged; no anon grants added.
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
