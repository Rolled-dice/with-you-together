
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Feedback triage columns
CREATE TYPE public.feedback_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.feedback_status AS ENUM ('new', 'in_review', 'planned', 'resolved', 'archived');

ALTER TABLE public.feedback_submissions
  ADD COLUMN priority public.feedback_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN triage_status public.feedback_status NOT NULL DEFAULT 'new',
  ADD COLUMN admin_notes text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER feedback_submissions_set_updated_at
  BEFORE UPDATE ON public.feedback_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin read + update policies
CREATE POLICY "Admins can view all feedback"
  ON public.feedback_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback"
  ON public.feedback_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX feedback_submissions_triage_idx
  ON public.feedback_submissions (triage_status, priority, created_at DESC);
