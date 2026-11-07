-- WhatsApp contacts: maps a phone number to an app user
CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text,
  opted_in boolean NOT NULL DEFAULT true,
  link_code text,
  link_code_expires_at timestamptz,
  verified_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_contacts TO authenticated;
GRANT ALL ON public.whatsapp_contacts TO service_role;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view their own whatsapp contact"
  ON public.whatsapp_contacts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER whatsapp_contacts_set_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX whatsapp_contacts_user_idx ON public.whatsapp_contacts(user_id);

-- Conversation state machine, one row per phone number
CREATE TABLE public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  flow text NOT NULL DEFAULT 'idle',
  step text NOT NULL DEFAULT 'start',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_sessions TO service_role;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view whatsapp sessions"
  ON public.whatsapp_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER whatsapp_sessions_set_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.whatsapp_sessions TO authenticated;

-- Full message log
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body text,
  media_url text,
  media_type text,
  flow text,
  step text,
  provider text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX whatsapp_messages_phone_created_idx ON public.whatsapp_messages(phone, created_at DESC);

-- Outbound queue (provider-agnostic; drained once a provider is connected)
CREATE TABLE public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'reply',
  booking_id uuid REFERENCES public.listener_bookings(id) ON DELETE SET NULL,
  dose_id uuid REFERENCES public.dose_logs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_outbox TO authenticated;
GRANT ALL ON public.whatsapp_outbox TO service_role;
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view whatsapp outbox"
  ON public.whatsapp_outbox FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER whatsapp_outbox_set_updated_at
  BEFORE UPDATE ON public.whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX whatsapp_outbox_status_idx ON public.whatsapp_outbox(status, created_at);