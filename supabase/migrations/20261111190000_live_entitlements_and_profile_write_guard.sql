-- A browser session must never be able to grant itself a plan or a verified phone.
-- All user profile edits now pass through the authenticated server function.
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (id) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_care_tier_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_tier text;
  new_tier text;
  active_price_id text;
BEGIN
  -- Sandbox subscriptions must not unlock production membership.
  IF NEW.provider <> 'dodo' OR NEW.environment <> 'live' THEN
    RETURN NEW;
  END IF;

  SELECT p.care_tier INTO old_tier FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT
    CASE
      WHEN s.price_id LIKE 'care_plus%' THEN 'care_plus'
      WHEN s.price_id LIKE 'care%' THEN 'care'
      ELSE 'free'
    END,
    s.price_id
  INTO new_tier, active_price_id
  FROM public.subscriptions s
  WHERE s.user_id = NEW.user_id
    AND s.provider = 'dodo'
    AND s.environment = 'live'
    AND (
      (s.status IN ('active', 'trialing', 'past_due')
        AND (s.current_period_end IS NULL OR s.current_period_end > now()))
      OR (s.status = 'canceled' AND s.current_period_end > now())
    )
  ORDER BY (s.price_id LIKE 'care_plus%') DESC, s.created_at DESC
  LIMIT 1;

  new_tier := COALESCE(new_tier, 'free');
  UPDATE public.profiles
  SET care_tier = new_tier,
      care_status = CASE WHEN new_tier = 'free' THEN 'inactive' ELSE 'active' END
  WHERE id = NEW.user_id;

  IF old_tier IS DISTINCT FROM new_tier THEN
    INSERT INTO public.billing_events (
      user_id, event_type, stripe_subscription_id, razorpay_subscription_id,
      provider, price_id, previous_tier, new_tier, status, environment, metadata
    ) VALUES (
      NEW.user_id,
      CASE
        WHEN old_tier = 'free' AND new_tier <> 'free' THEN 'tier.started'
        WHEN new_tier = 'free' THEN 'tier.ended'
        WHEN old_tier = 'care' AND new_tier = 'care_plus' THEN 'tier.upgraded'
        WHEN old_tier = 'care_plus' AND new_tier = 'care' THEN 'tier.downgraded'
        ELSE 'tier.changed'
      END,
      NEW.stripe_subscription_id, NEW.razorpay_subscription_id,
      NEW.provider, COALESCE(active_price_id, NEW.price_id),
      old_tier, new_tier, NEW.status, 'live',
      jsonb_build_object('dodo_subscription_id', NEW.dodo_subscription_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_care_tier_from_subscription() FROM PUBLIC, anon, authenticated;

-- Remove stale production entitlements previously granted by test subscriptions.
-- Run after reconciling any verified live subscriptions that were missed by webhooks.
UPDATE public.profiles p
SET care_tier = COALESCE((
      SELECT CASE
        WHEN s.price_id LIKE 'care_plus%' THEN 'care_plus'
        WHEN s.price_id LIKE 'care%' THEN 'care'
        ELSE 'free'
      END
      FROM public.subscriptions s
      WHERE s.user_id = p.id AND s.provider = 'dodo' AND s.environment = 'live'
        AND ((s.status IN ('active', 'trialing', 'past_due')
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
             OR (s.status = 'canceled' AND s.current_period_end > now()))
      ORDER BY (s.price_id LIKE 'care_plus%') DESC, s.created_at DESC
      LIMIT 1
    ), 'free'),
    care_status = CASE WHEN EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = p.id AND s.provider = 'dodo' AND s.environment = 'live'
        AND ((s.status IN ('active', 'trialing', 'past_due')
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
             OR (s.status = 'canceled' AND s.current_period_end > now()))
    ) THEN 'active' ELSE 'inactive' END
WHERE EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id);
