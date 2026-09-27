ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_country text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_currency text,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, display_name, full_name, phone, phone_country,
    phone_verified, preferred_language, date_of_birth
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.raw_user_meta_data->>'phone_country',
    (NEW.phone_confirmed_at IS NOT NULL),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    phone_country = COALESCE(EXCLUDED.phone_country, public.profiles.phone_country),
    phone_verified = public.profiles.phone_verified OR EXCLUDED.phone_verified,
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.profiles.date_of_birth);
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Family session pool schema (Step 4 groundwork)
CREATE TABLE IF NOT EXISTS public.family_session_pool (
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  total_sessions int NOT NULL DEFAULT 0,
  reschedules_total int NOT NULL DEFAULT 0,
  reschedules_used int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_session_pool TO authenticated;
GRANT ALL ON public.family_session_pool TO service_role;
ALTER TABLE public.family_session_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family members can view pool" ON public.family_session_pool;
CREATE POLICY "Family members can view pool"
  ON public.family_session_pool FOR SELECT TO authenticated
  USING (public.get_user_family_id(auth.uid()) = family_id);

DROP POLICY IF EXISTS "Family admins can manage pool" ON public.family_session_pool;
CREATE POLICY "Family admins can manage pool"
  ON public.family_session_pool FOR ALL TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id))
  WITH CHECK (public.is_family_admin(auth.uid(), family_id));

CREATE TABLE IF NOT EXISTS public.family_session_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  allocated int NOT NULL DEFAULT 0,
  used int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, member_user_id, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_session_allocations TO authenticated;
GRANT ALL ON public.family_session_allocations TO service_role;
ALTER TABLE public.family_session_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family members can view allocations" ON public.family_session_allocations;
CREATE POLICY "Family members can view allocations"
  ON public.family_session_allocations FOR SELECT TO authenticated
  USING (public.get_user_family_id(auth.uid()) = family_id);

DROP POLICY IF EXISTS "Family admins can manage allocations" ON public.family_session_allocations;
CREATE POLICY "Family admins can manage allocations"
  ON public.family_session_allocations FOR ALL TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id))
  WITH CHECK (public.is_family_admin(auth.uid(), family_id));

DROP TRIGGER IF EXISTS pool_set_updated_at ON public.family_session_pool;
CREATE TRIGGER pool_set_updated_at BEFORE UPDATE ON public.family_session_pool
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS alloc_set_updated_at ON public.family_session_allocations;
CREATE TRIGGER alloc_set_updated_at BEFORE UPDATE ON public.family_session_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Update tier sync trigger for new plan lookup keys
CREATE OR REPLACE FUNCTION public.sync_care_tier_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      WHEN NEW.price_id LIKE 'care%' THEN 'care'
      WHEN NEW.price_id LIKE 'family%' THEN 'family'
      WHEN NEW.price_id LIKE 'together%' THEN 'together'
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
      previous_tier, new_tier, status, environment, metadata
    ) VALUES (
      NEW.user_id,
      CASE
        WHEN old_tier = 'free' AND new_tier <> 'free' THEN 'tier.started'
        WHEN new_tier = 'free' THEN 'tier.ended'
        ELSE 'tier.changed'
      END,
      NEW.stripe_subscription_id, NEW.price_id,
      old_tier, new_tier, NEW.status, NEW.environment,
      jsonb_build_object('cancel_at_period_end', NEW.cancel_at_period_end)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_care_tier_from_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS subscriptions_sync_care_tier ON public.subscriptions;
CREATE TRIGGER subscriptions_sync_care_tier
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_care_tier_from_subscription();

-- Backfill: recompute care_tier for existing subscription rows.
UPDATE public.profiles p
SET
  care_tier = CASE
    WHEN s.is_active AND s.price_id LIKE 'care%' THEN 'care'
    WHEN s.is_active AND s.price_id LIKE 'family%' THEN 'family'
    WHEN s.is_active AND s.price_id LIKE 'together%' THEN 'together'
    ELSE 'free'
  END,
  care_status = CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    price_id,
    ((status IN ('active','trialing','past_due')
      AND (current_period_end IS NULL OR current_period_end > now()))
     OR (status = 'canceled' AND current_period_end > now())) AS is_active
  FROM public.subscriptions
  ORDER BY user_id, created_at DESC
) s
WHERE p.id = s.user_id;