-- Update the care_tier sync trigger for the new two-plan structure:
--   care       ($49 / ₹3,999)  → profiles.care_tier = 'care'
--   care_plus  ($79 / ₹6,499)  → profiles.care_tier = 'care_plus'
--
-- Critical fix: care_plus price_ids start with 'care_plus', which also matches
-- 'care%'. The WHEN clauses must check 'care_plus%' BEFORE 'care%', otherwise
-- Care Plus subscribers are incorrectly assigned the 'care' tier.
--
-- Also removes the now-defunct together/family upgrade/downgrade branch logic.

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
    -- IMPORTANT: care_plus% must be evaluated before care% because
    -- 'care_plus_monthly_usd' LIKE 'care%' is TRUE.
    new_tier := CASE
      WHEN NEW.price_id LIKE 'care_plus%' THEN 'care_plus'
      WHEN NEW.price_id LIKE 'care%'      THEN 'care'
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
        WHEN old_tier = 'free'      AND new_tier <> 'free'     THEN 'tier.started'
        WHEN new_tier = 'free'                                  THEN 'tier.ended'
        WHEN old_tier = 'care'      AND new_tier = 'care_plus'  THEN 'tier.upgraded'
        WHEN old_tier = 'care_plus' AND new_tier = 'care'       THEN 'tier.downgraded'
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
