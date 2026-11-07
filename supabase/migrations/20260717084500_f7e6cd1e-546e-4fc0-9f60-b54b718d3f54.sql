
CREATE OR REPLACE FUNCTION public.sync_care_tier_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tier text;
  is_active boolean;
BEGIN
  is_active := (NEW.status IN ('active','trialing','past_due')
                AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()))
            OR (NEW.status = 'canceled' AND NEW.current_period_end > now());

  IF is_active THEN
    new_tier := CASE
      WHEN NEW.price_id LIKE 'together%' THEN 'together'
      WHEN NEW.price_id LIKE 'family%' THEN 'family'
      ELSE 'free'
    END;
  ELSE
    new_tier := 'free';
  END IF;

  UPDATE public.profiles
    SET care_tier = new_tier,
        care_status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
    WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_care_tier_from_subscription() FROM PUBLIC, anon, authenticated;
