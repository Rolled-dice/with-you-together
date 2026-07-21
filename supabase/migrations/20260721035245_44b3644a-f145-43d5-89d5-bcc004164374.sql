-- Lock down SECURITY DEFINER helper functions so they cannot be called by anonymous users.
-- They are still used inside RLS policies, so authenticated users keep EXECUTE.

-- has_role: only authenticated + service_role should execute
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- get_user_family_id: only authenticated + service_role should execute
REVOKE ALL ON FUNCTION public.get_user_family_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_family_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(uuid) TO authenticated, service_role;

-- is_family_admin: only authenticated + service_role should execute
REVOKE ALL ON FUNCTION public.is_family_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_family_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_family_admin(uuid, uuid) TO authenticated, service_role;

-- has_active_subscription: only authenticated + service_role should execute
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;

-- handle_new_user and sync_care_tier_from_subscription are trigger-only and should not be executable by app roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_care_tier_from_subscription() FROM PUBLIC, anon, authenticated;

-- set_updated_at is a trigger helper; do not expose to app roles
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;