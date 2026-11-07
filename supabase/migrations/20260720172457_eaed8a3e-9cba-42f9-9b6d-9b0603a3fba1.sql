
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
