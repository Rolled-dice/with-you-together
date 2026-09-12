-- Helper: is the current user the agent on this booking?
CREATE OR REPLACE FUNCTION public.is_agent_of_booking(_booking uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listener_bookings b
    JOIN public.call_agents a ON a.id = b.agent_id
    WHERE b.id = _booking AND a.user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.is_agent_of_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agent_of_booking(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owns_booking(_booking uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listener_bookings b
    WHERE b.id = _booking AND b.user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.owns_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_booking(uuid) TO authenticated, service_role;

-- 1. call_legs
CREATE TABLE public.call_legs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.listener_bookings(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'telnyx',
  leg_role text NOT NULL DEFAULT 'member',
  direction text NOT NULL DEFAULT 'outbound',
  call_control_id text,
  call_session_id text,
  call_leg_id text,
  phone text,
  state text NOT NULL DEFAULT 'created',
  hangup_cause text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_legs_booking_idx ON public.call_legs(booking_id);
CREATE UNIQUE INDEX call_legs_control_idx ON public.call_legs(call_control_id) WHERE call_control_id IS NOT NULL;

GRANT SELECT ON public.call_legs TO authenticated;
GRANT ALL ON public.call_legs TO service_role;
ALTER TABLE public.call_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage call legs" ON public.call_legs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents view their call legs" ON public.call_legs
  FOR SELECT TO authenticated
  USING (public.is_agent_of_booking(booking_id));
CREATE POLICY "Members view their call legs" ON public.call_legs
  FOR SELECT TO authenticated
  USING (public.owns_booking(booking_id));

CREATE TRIGGER call_legs_updated_at BEFORE UPDATE ON public.call_legs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. call_recordings
CREATE TABLE public.call_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.listener_bookings(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'telnyx',
  recording_id text,
  channels text,
  format text,
  url text,
  duration_seconds integer,
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_recordings_booking_idx ON public.call_recordings(booking_id);

GRANT SELECT ON public.call_recordings TO authenticated;
GRANT ALL ON public.call_recordings TO service_role;
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recordings" ON public.call_recordings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents view their recordings" ON public.call_recordings
  FOR SELECT TO authenticated
  USING (public.is_agent_of_booking(booking_id));
CREATE POLICY "Members view their recordings" ON public.call_recordings
  FOR SELECT TO authenticated
  USING (public.owns_booking(booking_id));

CREATE TRIGGER call_recordings_updated_at BEFORE UPDATE ON public.call_recordings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. agent_presence
CREATE TABLE public.agent_presence (
  agent_id uuid NOT NULL PRIMARY KEY REFERENCES public.call_agents(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'offline',
  active_booking_id uuid REFERENCES public.listener_bookings(id) ON DELETE SET NULL,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agent_presence TO authenticated;
GRANT ALL ON public.agent_presence TO service_role;
ALTER TABLE public.agent_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage presence" ON public.agent_presence
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents read presence" ON public.agent_presence
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.call_agents a WHERE a.user_id = auth.uid()));
CREATE POLICY "Agents set own presence" ON public.agent_presence
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.call_agents a WHERE a.id = agent_id AND a.user_id = auth.uid()));
CREATE POLICY "Agents update own presence" ON public.agent_presence
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.call_agents a WHERE a.id = agent_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.call_agents a WHERE a.id = agent_id AND a.user_id = auth.uid()));

CREATE TRIGGER agent_presence_updated_at BEFORE UPDATE ON public.agent_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. call_dispositions
CREATE TABLE public.call_dispositions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.listener_bookings(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.call_agents(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  follow_up_needed boolean NOT NULL DEFAULT false,
  safety_concern boolean NOT NULL DEFAULT false,
  notes text,
  wrap_up_seconds integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_dispositions_booking_idx ON public.call_dispositions(booking_id);

GRANT SELECT, INSERT, UPDATE ON public.call_dispositions TO authenticated;
GRANT ALL ON public.call_dispositions TO service_role;
ALTER TABLE public.call_dispositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dispositions" ON public.call_dispositions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents view their dispositions" ON public.call_dispositions
  FOR SELECT TO authenticated
  USING (public.is_agent_of_booking(booking_id));
CREATE POLICY "Agents add dispositions" ON public.call_dispositions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_agent_of_booking(booking_id) AND created_by = auth.uid());
CREATE POLICY "Agents edit their dispositions" ON public.call_dispositions
  FOR UPDATE TO authenticated
  USING (public.is_agent_of_booking(booking_id) AND created_by = auth.uid())
  WITH CHECK (public.is_agent_of_booking(booking_id) AND created_by = auth.uid());

CREATE TRIGGER call_dispositions_updated_at BEFORE UPDATE ON public.call_dispositions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. routing_rules
CREATE TABLE public.routing_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Default routing',
  is_active boolean NOT NULL DEFAULT true,
  require_skill_match boolean NOT NULL DEFAULT false,
  timezone_tolerance_hours integer NOT NULL DEFAULT 3,
  enforce_working_hours boolean NOT NULL DEFAULT true,
  max_concurrent_override integer,
  fairness_weight integer NOT NULL DEFAULT 20,
  skill_weight integer NOT NULL DEFAULT 40,
  load_weight integer NOT NULL DEFAULT 25,
  timezone_weight integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.routing_rules TO authenticated;
GRANT ALL ON public.routing_rules TO service_role;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage routing rules" ON public.routing_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER routing_rules_updated_at BEFORE UPDATE ON public.routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.routing_rules (name) VALUES ('Default routing');