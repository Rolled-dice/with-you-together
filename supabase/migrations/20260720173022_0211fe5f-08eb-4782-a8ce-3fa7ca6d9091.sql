
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
