CREATE TABLE public.companion_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_memories TO authenticated;
GRANT ALL ON public.companion_memories TO service_role;
ALTER TABLE public.companion_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.companion_memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX companion_memories_user_idx ON public.companion_memories(user_id, created_at DESC);