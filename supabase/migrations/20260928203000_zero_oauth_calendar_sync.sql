-- =========================================================
-- ZERO-OAUTH CALENDAR SYNCHRONIZATION ENGINE
-- Replaces Google Calendar API & OAuth tokens with RFC 5545 / RFC 5546 / RFC 6047 (iMIP)
-- =========================================================

-- 1. Table for tracking syncable calendar events with monotonic sequence versioning
CREATE TABLE IF NOT EXISTS public.syncable_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('MEDICATION', 'LISTENER_SESSION', 'CHECKIN')),
  external_uid text NOT NULL UNIQUE,
  sequence integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  rrule text,
  alarm_minutes_before integer NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  source_type text CHECK (source_type IN ('dose', 'reminder', 'listener_session', 'checkin')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS & Grants
ALTER TABLE public.syncable_calendar_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syncable_calendar_events TO authenticated;
GRANT ALL ON public.syncable_calendar_events TO service_role;

-- Policies
DROP POLICY IF EXISTS "Users read own syncable calendar events" ON public.syncable_calendar_events;
CREATE POLICY "Users read own syncable calendar events"
  ON public.syncable_calendar_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users update own syncable calendar events" ON public.syncable_calendar_events;
CREATE POLICY "Users update own syncable calendar events"
  ON public.syncable_calendar_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_syncable_calendar_events_user ON public.syncable_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_syncable_calendar_events_uid ON public.syncable_calendar_events(external_uid);
CREATE INDEX IF NOT EXISTS idx_syncable_calendar_events_source ON public.syncable_calendar_events(source_type, source_id);

-- 2. Atomic update with sequence increment (eliminates read-modify-write race conditions)
CREATE OR REPLACE FUNCTION public.atomic_calendar_event_update(event_id uuid, payload jsonb)
RETURNS public.syncable_calendar_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_row public.syncable_calendar_events;
BEGIN
  UPDATE public.syncable_calendar_events
  SET
    sequence = sequence + 1,
    title = COALESCE(payload->>'title', title),
    description = COALESCE(payload->>'description', description),
    location = COALESCE(payload->>'location', location),
    start_time = COALESCE((payload->>'start_time')::timestamptz, start_time),
    end_time = COALESCE((payload->>'end_time')::timestamptz, end_time),
    timezone = COALESCE(payload->>'timezone', timezone),
    rrule = CASE WHEN payload ? 'rrule' THEN payload->>'rrule' ELSE rrule END,
    alarm_minutes_before = COALESCE((payload->>'alarm_minutes_before')::integer, alarm_minutes_before),
    status = COALESCE(payload->>'status', status),
    updated_at = now()
  WHERE id = event_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

-- 3. Atomic cancel function
CREATE OR REPLACE FUNCTION public.atomic_calendar_event_cancel(event_id uuid)
RETURNS public.syncable_calendar_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_row public.syncable_calendar_events;
BEGIN
  UPDATE public.syncable_calendar_events
  SET
    sequence = sequence + 1,
    status = 'CANCELLED',
    updated_at = now()
  WHERE id = event_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

-- 4. Clean up legacy Google OAuth tables and triggers (safe even if they don't exist)
DO $$ BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS google_calendar_credentials_set_updated_at ON public.google_calendar_credentials';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS calendar_event_links_set_updated_at ON public.calendar_event_links';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DROP TABLE IF EXISTS public.calendar_event_links CASCADE;
DROP TABLE IF EXISTS public.google_calendar_credentials CASCADE;
