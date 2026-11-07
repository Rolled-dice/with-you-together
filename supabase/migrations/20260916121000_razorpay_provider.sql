-- Razorpay support: make the billing tables provider-aware so Razorpay
-- (INR) subscriptions live alongside the existing Stripe (USD) rows, and
-- fix the care_tier sync trigger to map the `care` tier (previously it fell
-- through to `free`).
--
-- The provider column defaults to 'stripe' so all existing rows keep their
-- meaning. Razorpay rows are identified by provider = 'razorpay' and use the
-- razorpay_* id columns; the stripe_* columns become nullable to accommodate
-- them. price_id continues to use the shared scheme (e.g. 'care_monthly_inr')
-- so the care_tier trigger works for both providers.

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('stripe', 'razorpay'));

-- Stripe ids are only present on Stripe rows now.
ALTER TABLE public.subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;

-- The original table declared stripe_subscription_id UNIQUE (a table-level
-- unique constraint). Drop it and replace with partial unique indexes so each
-- provider's id space is unique without forcing NULLs to collide.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_stripe_subscription_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_stripe_sub_id
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_razorpay_sub_id
  ON public.subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- Guard: a row must carry the id for its provider.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_id_present
  CHECK (
    (provider = 'stripe'   AND stripe_subscription_id   IS NOT NULL) OR
    (provider = 'razorpay' AND razorpay_subscription_id IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- billing_events
-- ---------------------------------------------------------------------------

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

-- ---------------------------------------------------------------------------
-- webhook idempotency ledger (reuse the existing stripe_webhook_events table)
-- ---------------------------------------------------------------------------

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

-- Razorpay does not send a globally-unique event id in every payload, so we
-- synthesise one (provider:event:subId:timestamp) and store it in the existing
-- stripe_event_id UNIQUE column. Nothing else to change here.

-- ---------------------------------------------------------------------------
-- care_tier sync trigger: provider-agnostic + fix the missing `care` mapping
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_care_tier_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tier text;
  old_tier text;
  is_active boolean;
BEGIN
  is_active := (NEW.status IN ('active','trialing','past_due')
                AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()))
            OR (NEW.status = 'canceled' AND NEW.current_period_end > now());

  IF is_active THEN
    new_tier := CASE
      WHEN NEW.price_id LIKE 'together%' THEN 'together'
      WHEN NEW.price_id LIKE 'family%'   THEN 'family'
      WHEN NEW.price_id LIKE 'care%'     THEN 'care'
      ELSE 'free'
    END;
  ELSE
    new_tier := 'free';
  END IF;

  SELECT care_tier INTO old_tier FROM public.profiles WHERE id = NEW.user_id;

  UPDATE public.profiles
    SET care_tier = new_tier,
        care_status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
    WHERE id = NEW.user_id;

  IF old_tier IS DISTINCT FROM new_tier THEN
    INSERT INTO public.billing_events (
      user_id, event_type, stripe_subscription_id, razorpay_subscription_id,
      provider, price_id, previous_tier, new_tier, status, environment,
      metadata
    ) VALUES (
      NEW.user_id,
      CASE
        WHEN old_tier = 'free' AND new_tier <> 'free' THEN 'tier.started'
        WHEN new_tier = 'free' THEN 'tier.ended'
        WHEN (old_tier = 'together' AND new_tier IN ('family','care')) THEN 'tier.upgraded'
        WHEN (old_tier = 'family'   AND new_tier = 'care')             THEN 'tier.upgraded'
        WHEN (old_tier = 'care'     AND new_tier IN ('family','together')) THEN 'tier.downgraded'
        WHEN (old_tier = 'family'   AND new_tier = 'together')         THEN 'tier.downgraded'
        ELSE 'tier.changed'
      END,
      NEW.stripe_subscription_id,
      NEW.razorpay_subscription_id,
      NEW.provider,
      NEW.price_id,
      old_tier,
      new_tier,
      NEW.status,
      NEW.environment,
      jsonb_build_object('cancel_at_period_end', NEW.cancel_at_period_end)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_care_tier_from_subscription() FROM PUBLIC, anon, authenticated;

-- No new tables created; existing GRANTs + RLS on subscriptions/billing_events/
-- stripe_webhook_events already cover the added columns (SELECT to authenticated,
-- ALL to service_role, user-scoped SELECT policies remain in force).
