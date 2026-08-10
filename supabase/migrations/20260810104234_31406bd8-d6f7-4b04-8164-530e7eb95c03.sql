CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'members', (SELECT count(*) FROM public.profiles),
    'families', (SELECT count(*) FROM public.families),
    'checkins', (
      (SELECT count(*) FROM public.journal_entries)
      + (SELECT count(*) FROM public.messages WHERE role = 'user')
      + (SELECT count(*) FROM public.reminders WHERE status = 'completed')
      + (SELECT count(*) FROM public.dose_logs WHERE status = 'taken')
    ),
    'sessions', (SELECT count(*) FROM public.listener_bookings WHERE call_started_at IS NOT NULL),
    'active_listeners', (SELECT count(*) FROM public.listeners WHERE is_active),
    'avg_rating', (SELECT round(avg(rating)::numeric, 1) FROM public.listener_bookings WHERE rating IS NOT NULL),
    'rating_count', (SELECT count(*) FROM public.listener_bookings WHERE rating IS NOT NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated, service_role;