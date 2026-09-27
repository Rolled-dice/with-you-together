-- Solo (non-family) listener session + reschedule usage.
--
-- Family members draw from family_session_pool / family_session_allocations.
-- Solo users had no pool and were ungated. This table gives each solo user a
-- per-period (calendar month) counter so their own-tier monthly allowance for
-- Listener sessions and reschedules can be enforced and displayed.
--
-- One row per user per period_start (first day of the month, UTC). The server
-- (service role) increments the counters inside consumeSession /
-- consumeReschedule; the owning user may read their own row for the summary.

CREATE TABLE public.solo_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  sessions_used integer NOT NULL DEFAULT 0,
  reschedules_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

CREATE INDEX solo_session_usage_user_period_idx
  ON public.solo_session_usage (user_id, period_start);

GRANT SELECT ON public.solo_session_usage TO authenticated;
GRANT ALL ON public.solo_session_usage TO service_role;

ALTER TABLE public.solo_session_usage ENABLE ROW LEVEL SECURITY;

-- Read-only for the owning user; writes happen through the service role only.
CREATE POLICY "Users read their own solo usage"
  ON public.solo_session_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER solo_session_usage_set_updated
  BEFORE UPDATE ON public.solo_session_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
