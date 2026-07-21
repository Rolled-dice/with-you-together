
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  stripe_subscription_id text,
  stripe_invoice_id text,
  price_id text,
  previous_price_id text,
  previous_tier text,
  new_tier text,
  amount_cents integer,
  currency text,
  status text,
  environment text NOT NULL DEFAULT 'sandbox',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_events_user ON public.billing_events(user_id, created_at DESC);
CREATE INDEX idx_billing_events_sub ON public.billing_events(stripe_subscription_id);

GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own billing events"
  ON public.billing_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages billing events"
  ON public.billing_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Enhance tier sync to log tier changes
CREATE OR REPLACE FUNCTION public.sync_care_tier_from_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHEN NEW.price_id LIKE 'family%' THEN 'family'
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
      user_id, event_type, stripe_subscription_id, price_id,
      previous_tier, new_tier, status, environment,
      metadata
    ) VALUES (
      NEW.user_id,
      CASE
        WHEN old_tier = 'free' AND new_tier <> 'free' THEN 'tier.started'
        WHEN new_tier = 'free' THEN 'tier.ended'
        WHEN (old_tier = 'together' AND new_tier = 'family') THEN 'tier.upgraded'
        WHEN (old_tier = 'family' AND new_tier = 'together') THEN 'tier.downgraded'
        ELSE 'tier.changed'
      END,
      NEW.stripe_subscription_id,
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
$function$;
