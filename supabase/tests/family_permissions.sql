-- Run after all five 20261003 family migrations. Read-only; exceptions mean failure.
DO $$
DECLARE signature text; table_name text; role_name text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.family_command(uuid,text,jsonb)',
    'public.family_reminder_command(uuid,text,jsonb)',
    'public.call_credit_command(uuid,text,jsonb)',
    'public.push_command(uuid,text,jsonb)',
    'public.materialize_reminder_occurrences(uuid)',
    'public.prepare_reminder_delivery()',
    'public.claim_reminder_push()',
    'public.finish_reminder_push(uuid,uuid,text)',
    'public.deliver_family_messages()',
    'public.cancel_unconsented_family_reminders(uuid)'
  ] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(role_name,signature,'EXECUTE') THEN
        RAISE EXCEPTION '% must not execute %',role_name,signature;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
      RAISE EXCEPTION 'service_role must execute %',signature;
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'families','family_members','family_invitations','family_sharing',
    'family_verification_attempts','reminders','reminder_occurrences',
    'call_credit_orders','call_reservations','family_session_pool',
    'family_session_allocations','solo_session_usage','push_devices','reminder_push_jobs'
  ] LOOP
    IF has_table_privilege('authenticated','public.'||table_name,'INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Browser mutation access remains on %',table_name;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.family_invitations','SELECT') THEN
    RAISE EXCEPTION 'Invitation tokens must not be readable by browser roles';
  END IF;
  IF has_table_privilege('authenticated','public.profiles','INSERT') THEN
    RAISE EXCEPTION 'Profile creation must remain controlled by Auth';
  END IF;
  IF has_table_privilege('authenticated','public.listener_bookings','DELETE') THEN
    RAISE EXCEPTION 'Bookings must be cancelled, not deleted';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'family_sharing','family_verification_attempts','reminder_occurrences',
    'call_credit_orders','call_reservations','push_devices','reminder_push_jobs'
  ] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||table_name)::regclass) THEN
      RAISE EXCEPTION 'RLS is not enabled on %',table_name;
    END IF;
    IF has_table_privilege('anon','public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Anonymous table access remains on %',table_name;
    END IF;
    IF NOT has_table_privilege('service_role','public.'||table_name,'SELECT')
      OR NOT has_table_privilege('service_role','public.'||table_name,'INSERT')
      OR NOT has_table_privilege('service_role','public.'||table_name,'UPDATE')
      OR NOT has_table_privilege('service_role','public.'||table_name,'DELETE') THEN
      RAISE EXCEPTION 'Service grants are incomplete on %',table_name;
    END IF;
  END LOOP;
END;
$$;
SELECT 'Family permissions verified' AS result;
