-- =========================================================
-- GOOGLE CALENDAR SYNC: per-user OAuth credentials + event links
-- =========================================================

-- ---------- google_calendar_credentials ----------
CREATE TABLE public.google_calendar_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  encrypted_refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.google_calendar_credentials TO authenticated;
GRANT ALL ON public.google_calendar_credentials TO service_role;
ALTER TABLE public.google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- Note: client never INSERTs; the OAuth callback writes via service_role.
-- SELECT is allowed but the client-facing server fn returns only non-secret columns.
CREATE POLICY "Users read their own calendar credential"
  ON public.google_calendar_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update their own calendar credential"
  ON public.google_calendar_credentials FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own calendar credential"
  ON public.google_calendar_credentials FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER google_calendar_credentials_set_updated_at
  BEFORE UPDATE ON public.google_calendar_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- calendar_event_links ----------
CREATE TABLE public.calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('dose','reminder')),
  source_id uuid NOT NULL,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL,
  synced_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_user_id, source_type, source_id)
);

-- Service-managed only: no direct client writes needed.
GRANT ALL ON public.calendar_event_links TO service_role;
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read event links"
  ON public.calendar_event_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER calendar_event_links_set_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_calendar_links_holder ON public.calendar_event_links(holder_user_id);
CREATE INDEX idx_calendar_links_source ON public.calendar_event_links(source_type, source_id);
