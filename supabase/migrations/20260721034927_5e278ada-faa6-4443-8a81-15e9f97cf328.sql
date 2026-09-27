CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own conversations select" ON public.conversations;
CREATE POLICY "own conversations select" ON public.conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own conversations insert" ON public.conversations;
CREATE POLICY "own conversations insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own conversations update" ON public.conversations;
CREATE POLICY "own conversations update" ON public.conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own conversations delete" ON public.conversations;
CREATE POLICY "own conversations delete" ON public.conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS conversations_set_updated_at ON public.conversations;
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx
  ON public.messages (conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own messages select" ON public.messages;
CREATE POLICY "own messages select" ON public.messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own messages insert" ON public.messages;
CREATE POLICY "own messages insert" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own messages delete" ON public.messages;
CREATE POLICY "own messages delete" ON public.messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood smallint,
  title text,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own journal entries" ON public.journal_entries;
CREATE POLICY "Users manage own journal entries" ON public.journal_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS journal_entries_set_updated ON public.journal_entries;
CREATE TRIGGER journal_entries_set_updated
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS journal_entries_user_created_idx
  ON public.journal_entries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.listeners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  headline text NOT NULL,
  bio text NOT NULL DEFAULT '',
  focus_areas text[] NOT NULL DEFAULT '{}',
  timezone text,
  hourly_rate_cents integer NOT NULL DEFAULT 0,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listeners TO authenticated;
GRANT ALL ON public.listeners TO service_role;
ALTER TABLE public.listeners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in members can view active listeners" ON public.listeners;
CREATE POLICY "Signed-in members can view active listeners" ON public.listeners
  FOR SELECT TO authenticated
  USING (is_active = true);
DROP TRIGGER IF EXISTS listeners_set_updated ON public.listeners;
CREATE TRIGGER listeners_set_updated
  BEFORE UPDATE ON public.listeners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.listeners (name, headline, bio, focus_areas, timezone, hourly_rate_cents) VALUES
('Amara Okafor', 'Trained peer listener, softly held space',
 'Amara has spent six years holding space for people navigating grief, burnout, and life transitions. She listens without agenda.',
 ARRAY['Grief','Burnout','Life transitions'], 'America/New_York', 4500),
('Kenji Watanabe', 'Calm presence for anxious minds',
 'Kenji works with folks who feel overwhelmed by the everyday. He is quiet, patient, and gentle with silences.',
 ARRAY['Anxiety','Overwhelm','Sleep'], 'America/Los_Angeles', 4000),
('Priya Menon', 'Family and caregiving conversations',
 'Priya supports adults navigating aging parents, family friction, and the tender parts of caregiving.',
 ARRAY['Family','Caregiving','Boundaries'], 'Europe/London', 5000)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.listener_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listener_id uuid NOT NULL REFERENCES public.listeners(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listener_bookings TO authenticated;
GRANT ALL ON public.listener_bookings TO service_role;
ALTER TABLE public.listener_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage own bookings" ON public.listener_bookings;
CREATE POLICY "Members manage own bookings" ON public.listener_bookings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS listener_bookings_set_updated ON public.listener_bookings;
CREATE TRIGGER listener_bookings_set_updated
  BEFORE UPDATE ON public.listener_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS listener_bookings_user_idx
  ON public.listener_bookings (user_id, requested_at DESC);