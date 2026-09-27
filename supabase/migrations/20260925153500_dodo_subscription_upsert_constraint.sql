-- Allow PostgREST/Supabase upserts to target dodo_subscription_id.
--
-- The original Dodo migration created a partial unique index
-- (WHERE dodo_subscription_id IS NOT NULL). PostgreSQL cannot infer that
-- partial index for `ON CONFLICT (dodo_subscription_id)`, which caused
-- checkout and webhook subscription upserts to fail.
--
-- A normal nullable UNIQUE constraint preserves the intended behaviour:
-- PostgreSQL permits multiple NULL values while guaranteeing each actual
-- Dodo subscription ID is unique.

DROP INDEX IF EXISTS public.uq_subscriptions_dodo_sub_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND conname = 'subscriptions_dodo_subscription_id_key'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_dodo_subscription_id_key
      UNIQUE (dodo_subscription_id);
  END IF;
END;
$$;