BEGIN;

-- These mutations are used only by the server's service-role repository.
REVOKE ALL ON FUNCTION public.atomic_calendar_event_update(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atomic_calendar_event_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_calendar_event_dispatched(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_calendar_event_update(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_calendar_event_cancel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_calendar_event_dispatched(uuid) TO service_role;
ALTER FUNCTION public.atomic_calendar_event_update(uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.atomic_calendar_event_cancel(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_calendar_event_dispatched(uuid) SET search_path = public, pg_temp;

COMMIT;
