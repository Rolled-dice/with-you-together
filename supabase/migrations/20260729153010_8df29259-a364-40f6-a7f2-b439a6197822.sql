REVOKE ALL ON FUNCTION public.same_family_as(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_family_adult_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.same_family_as(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_family_adult_of(uuid) TO authenticated, service_role;