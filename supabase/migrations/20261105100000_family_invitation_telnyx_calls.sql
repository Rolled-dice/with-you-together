CREATE TABLE IF NOT EXISTS public.family_invitation_call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.family_invitations(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'starting'
    CHECK (status IN ('starting', 'dialing_agent', 'dialing_invitee', 'in_call', 'ended', 'failed')),
  agent_call_control_id text UNIQUE,
  invitee_call_control_id text UNIQUE,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  connected_at timestamptz,
  ended_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS family_invitation_one_active_call_idx
  ON public.family_invitation_call_sessions (invitation_id)
  WHERE status IN ('starting', 'dialing_agent', 'dialing_invitee', 'in_call');

CREATE INDEX IF NOT EXISTS family_invitation_call_sessions_agent_idx
  ON public.family_invitation_call_sessions (agent_user_id, created_at DESC);

ALTER TABLE public.family_invitation_call_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_invitation_call_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.family_invitation_call_sessions TO service_role;
