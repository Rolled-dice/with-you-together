
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_care_tier_from_subscription() FROM PUBLIC, anon, authenticated;
