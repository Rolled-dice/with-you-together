-- =========================================================
-- CALENDAR EVENT DISPATCH TRACKING
-- Adds dispatched_sequence to track which version of an event was last emailed.
-- Prevents duplicate emails when nothing has changed.
-- =========================================================

-- Add dispatched_sequence column: tracks the sequence number at which the event was last emailed.
-- NULL means never dispatched. Only send email when dispatched_sequence IS NULL or dispatched_sequence < sequence.
ALTER TABLE public.syncable_calendar_events
  ADD COLUMN IF NOT EXISTS dispatched_sequence integer DEFAULT NULL;

-- Update the atomic_calendar_event_update function to also accept dispatched_sequence
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

-- Function to mark an event as dispatched at its current sequence
CREATE OR REPLACE FUNCTION public.mark_calendar_event_dispatched(event_id uuid)
RETURNS public.syncable_calendar_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_row public.syncable_calendar_events;
BEGIN
  UPDATE public.syncable_calendar_events
  SET
    dispatched_sequence = sequence,
    updated_at = now()
  WHERE id = event_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;
