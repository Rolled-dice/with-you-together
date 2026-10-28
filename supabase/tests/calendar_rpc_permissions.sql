-- Run after applying 20261002090000_restrict_calendar_rpc.sql.
-- Raises an exception if any calendar mutation is exposed to browser roles.
DO $$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.atomic_calendar_event_update(uuid,jsonb)',
    'public.atomic_calendar_event_cancel(uuid)',
    'public.mark_calendar_event_dispatched(uuid)'
  ] LOOP
    IF has_function_privilege('anon', signature, 'EXECUTE')
       OR has_function_privilege('authenticated', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Browser access still enabled for %', signature;
    END IF;
    IF NOT has_function_privilege('service_role', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Service-role access missing for %', signature;
    END IF;
  END LOOP;
END;
$$;
