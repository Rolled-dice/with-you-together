-- FAMILIES
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- FAMILY MEMBERS
CREATE TYPE public.family_role AS ENUM ('owner', 'adult', 'teen');

CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'adult',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id) -- user can only be in one family
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- FAMILY INVITATIONS
CREATE TABLE public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.family_role NOT NULL DEFAULT 'adult',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invitations TO authenticated;
GRANT ALL ON public.family_invitations TO service_role;
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION public.get_user_family_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.family_members WHERE user_id = _uid LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_user_family_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_family_admin(_uid uuid, _family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _uid AND family_id = _family AND role IN ('owner','adult')
  );
$$;
REVOKE ALL ON FUNCTION public.is_family_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_family_admin(uuid, uuid) TO authenticated, service_role;

-- POLICIES: families
CREATE POLICY "members can view their family"
  ON public.families FOR SELECT TO authenticated
  USING (id = public.get_user_family_id(auth.uid()));

CREATE POLICY "authenticated can create family they own"
  ON public.families FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner can update family"
  ON public.families FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner can delete family"
  ON public.families FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- POLICIES: family_members
CREATE POLICY "members view their family roster"
  ON public.family_members FOR SELECT TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

-- Owner inserts self as first member (handled via server fn); admins add others via server fn using service role.
CREATE POLICY "owner inserts self"
  ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "leave family (self)"
  ON public.family_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- POLICIES: invitations
CREATE POLICY "family admins view invites"
  ON public.family_invitations FOR SELECT TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id));

CREATE POLICY "family admins create invites"
  ON public.family_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_family_admin(auth.uid(), family_id) AND invited_by = auth.uid());

CREATE POLICY "family admins revoke invites"
  ON public.family_invitations FOR UPDATE TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id))
  WITH CHECK (public.is_family_admin(auth.uid(), family_id));

-- Trigger: updated_at
CREATE TRIGGER families_set_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  stripe_subscription_id text,
  stripe_invoice_id text,
  price_id text,
  previous_price_id text,
  previous_tier text,
  new_tier text,
  amount_cents integer,
  currency text,
  status text,
  environment text NOT NULL DEFAULT 'sandbox',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_events_user ON public.billing_events(user_id, created_at DESC);
CREATE INDEX idx_billing_events_sub ON public.billing_events(stripe_subscription_id);

GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own billing events"
  ON public.billing_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages billing events"
  ON public.billing_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');