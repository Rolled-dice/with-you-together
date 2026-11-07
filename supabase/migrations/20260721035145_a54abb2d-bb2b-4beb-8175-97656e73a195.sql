CREATE TABLE public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  environment text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_subscription_id text,
  stripe_customer_id text,
  processed boolean NOT NULL DEFAULT false,
  error text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_swe_received_at ON public.stripe_webhook_events(received_at DESC);
CREATE INDEX idx_swe_user_id ON public.stripe_webhook_events(user_id);
CREATE INDEX idx_swe_env ON public.stripe_webhook_events(environment);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook events"
  ON public.stripe_webhook_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages webhook events"
  ON public.stripe_webhook_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TYPE public.feedback_category as enum (
  'feature_request','bug_report','product_feedback','ai_feedback','listener_feedback','support'
);

CREATE TABLE public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category public.feedback_category not null,
  subject text,
  message text not null check (char_length(message) between 4 and 4000),
  email text,
  page text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

grant select, insert on public.feedback_submissions to authenticated;
grant insert on public.feedback_submissions to anon;
grant all on public.feedback_submissions to service_role;

alter table public.feedback_submissions enable row level security;

create policy "Anyone can submit feedback"
  on public.feedback_submissions
  for insert
  to anon, authenticated
  with check (true);

create policy "Users can view their own feedback"
  on public.feedback_submissions
  for select
  to authenticated
  using (user_id = auth.uid());

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