CREATE TABLE IF NOT EXISTS public.companion_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_memories TO authenticated;
GRANT ALL ON public.companion_memories TO service_role;
ALTER TABLE public.companion_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own memories" ON public.companion_memories;
CREATE POLICY "own memories" ON public.companion_memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS companion_memories_user_idx ON public.companion_memories(user_id, created_at DESC);

ALTER TABLE public.listener_bookings
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS ready_user BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_listener BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_consent_user BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_consent_listener BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_ended_at TIMESTAMPTZ;

ALTER TABLE public.listener_bookings
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feedback_note TEXT,
  ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_wanted BOOLEAN NOT NULL DEFAULT false;