CREATE TABLE public.call_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  timezone text NOT NULL DEFAULT 'UTC',
  skills text[] NOT NULL DEFAULT '{}',
  work_start time NOT NULL DEFAULT '09:00',
  work_end time NOT NULL DEFAULT '21:00',
  max_concurrent integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_agents TO authenticated;
GRANT ALL ON public.call_agents TO service_role;
ALTER TABLE public.call_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage call agents" ON public.call_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER call_agents_updated_at BEFORE UPDATE ON public.call_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.listener_bookings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_events_booking_idx ON public.call_events(booking_id, created_at DESC);
GRANT SELECT, INSERT ON public.call_events TO authenticated;
GRANT ALL ON public.call_events TO service_role;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read call events" ON public.call_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write call events" ON public.call_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.call_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.listener_bookings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'normal',
  note text,
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_flags_open_idx ON public.call_flags(resolved, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.call_flags TO authenticated;
GRANT ALL ON public.call_flags TO service_role;
ALTER TABLE public.call_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage call flags" ON public.call_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER call_flags_updated_at BEFORE UPDATE ON public.call_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.listener_bookings
  ADD COLUMN agent_id uuid REFERENCES public.call_agents(id) ON DELETE SET NULL,
  ADD COLUMN sla_deadline timestamptz,
  ADD COLUMN crm_state text NOT NULL DEFAULT 'requested';
CREATE INDEX listener_bookings_crm_idx ON public.listener_bookings(crm_state, requested_at);