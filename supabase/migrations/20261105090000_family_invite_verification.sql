-- Extend the production family invitation schema without duplicating its
-- existing status, phone, attempt, and consent fields.
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS verification_decided_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.family_invitations'::regclass
      AND conname = 'family_invite_call_phone_e164'
  ) THEN
    ALTER TABLE public.family_invitations
      ADD CONSTRAINT family_invite_call_phone_e164
      CHECK (call_phone IS NULL OR call_phone ~ '^\+[1-9][0-9]{7,14}$');
  END IF;
END $$;

-- Owners can create only unverified adult invitations and revoke pending ones.
-- Verification and lifecycle changes remain service-role-only.
REVOKE INSERT, UPDATE ON public.family_invitations FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  family_id, email, role, invited_by, contact_phone, contact_channel,
  invitee_name, relationship, call_phone, call_window, call_timezone, status
) ON public.family_invitations TO authenticated;
GRANT UPDATE (status) ON public.family_invitations TO authenticated;

DROP POLICY IF EXISTS "family admins create invites" ON public.family_invitations;
DROP POLICY IF EXISTS "family admins revoke invites" ON public.family_invitations;
DROP POLICY IF EXISTS "family admins view invites" ON public.family_invitations;
DROP POLICY IF EXISTS "family owners view invites" ON public.family_invitations;
CREATE POLICY "family owners view invites"
  ON public.family_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_invitations.family_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );
CREATE POLICY "family owners create invites"
  ON public.family_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_invitations.family_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );
CREATE POLICY "family owners revoke invites"
  ON public.family_invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_invitations.family_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_invitations.family_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

CREATE OR REPLACE FUNCTION public.guard_family_invitation_member_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role <> 'adult'
        OR NEW.status <> 'verification_pending'
        OR NEW.attempts <> 0
        OR NEW.assigned_to IS NOT NULL
        OR NEW.recipient_id IS NOT NULL
        OR NEW.adult_confirmed_at IS NOT NULL
        OR NEW.consent_at IS NOT NULL
        OR NEW.sharing_choices <> '{}'::jsonb
        OR NEW.delivery_status <> 'not_sent'
        OR NEW.last_sent_at IS NOT NULL
        OR NEW.call_phone IS NULL
        OR (NEW.contact_channel = 'email' AND coalesce(NEW.email, '') = '') THEN
        RAISE EXCEPTION 'Family invitations must be created as unverified adult invitations';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status IS DISTINCT FROM OLD.status
        AND NOT (OLD.status IN ('pending', 'verification_pending') AND NEW.status = 'revoked') THEN
        RAISE EXCEPTION 'Family members may only revoke pending invitations';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.family_invitations'::regclass
      AND tgname = 'guard_family_invitation_member_writes'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER guard_family_invitation_member_writes
      BEFORE INSERT OR UPDATE ON public.family_invitations
      FOR EACH ROW EXECUTE FUNCTION public.guard_family_invitation_member_writes();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.family_invitation_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.family_invitations(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('connected_yes', 'connected_no', 'no_answer', 'voicemail', 'wrong_number', 'tech_failure')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  attempt_number integer CHECK (attempt_number IS NULL OR attempt_number BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invitation_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS family_invite_verification_queue_idx
  ON public.family_invitations (status, created_at)
  WHERE status = 'verification_pending' AND consent_at IS NULL;

ALTER TABLE public.family_invitation_verification_attempts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.family_invitation_verification_attempts TO service_role;
REVOKE ALL ON public.family_invitation_verification_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_family_invitation_call(
  p_invitation_id uuid,
  p_agent_user_id uuid,
  p_outcome text,
  p_verbal_consent boolean,
  p_notes text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inv public.family_invitations%ROWTYPE;
  attempt_no integer;
  invitee_user_id uuid;
  existing_family uuid;
BEGIN
  IF p_outcome NOT IN ('connected_yes', 'connected_no', 'no_answer', 'voicemail', 'wrong_number', 'tech_failure') THEN
    RAISE EXCEPTION 'Invalid call outcome';
  END IF;
  IF char_length(coalesce(p_notes, '')) > 1000 THEN RAISE EXCEPTION 'Notes are too long'; END IF;
  IF (p_outcome = 'connected_yes' AND p_verbal_consent IS DISTINCT FROM true)
    OR (p_outcome <> 'connected_yes' AND p_verbal_consent IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'Verbal consent must match the call outcome';
  END IF;

  SELECT * INTO inv FROM public.family_invitations
  WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR inv.status <> 'verification_pending' OR inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation is no longer active';
  END IF;
  IF inv.consent_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation verification is already approved';
  END IF;

  attempt_no := inv.attempts;
  IF p_outcome <> 'tech_failure' THEN attempt_no := attempt_no + 1; END IF;
  IF attempt_no > 3 THEN RAISE EXCEPTION 'Three contact attempts have already been recorded'; END IF;

  INSERT INTO public.family_invitation_verification_attempts
    (invitation_id, agent_user_id, outcome, notes, attempt_number)
  VALUES (
    inv.id, p_agent_user_id, p_outcome, coalesce(p_notes, ''),
    CASE WHEN p_outcome = 'tech_failure' THEN NULL ELSE attempt_no END
  );

  IF p_outcome = 'connected_yes' THEN
    SELECT id INTO invitee_user_id FROM auth.users
    WHERE inv.email IS NOT NULL AND lower(email) = lower(inv.email) LIMIT 1;

    UPDATE public.family_invitations
      SET attempts = attempt_no,
          adult_confirmed_at = now(),
          consent_at = now(),
          assigned_to = p_agent_user_id,
          verification_decided_at = now()
      WHERE id = inv.id;

    IF invitee_user_id IS NOT NULL THEN
      SELECT family_id INTO existing_family FROM public.family_members WHERE user_id = invitee_user_id;
      IF existing_family IS NOT NULL AND existing_family <> inv.family_id THEN
        RAISE EXCEPTION 'Invitee already belongs to another family';
      END IF;
      IF existing_family IS NULL THEN
        INSERT INTO public.family_members (family_id, user_id, role)
          VALUES (inv.family_id, invitee_user_id, inv.role);
      END IF;
      UPDATE public.family_invitations
        SET status = 'accepted', recipient_id = invitee_user_id
        WHERE id = inv.id;
    END IF;
    RETURN jsonb_build_object(
      'verification_status', 'approved',
      'member_added', invitee_user_id IS NOT NULL,
      'email', inv.email,
      'token', inv.token
    );
  ELSIF p_outcome = 'connected_no' THEN
    UPDATE public.family_invitations
      SET status = 'declined', attempts = attempt_no,
          assigned_to = p_agent_user_id, verification_decided_at = now()
      WHERE id = inv.id;
    RETURN jsonb_build_object('verification_status', 'declined', 'member_added', false, 'email', inv.email, 'token', inv.token);
  ELSE
    UPDATE public.family_invitations
      SET status = CASE WHEN attempt_no >= 3 THEN 'verification_closed' ELSE 'verification_pending' END,
          attempts = attempt_no,
          assigned_to = p_agent_user_id,
          verification_decided_at = CASE WHEN attempt_no >= 3 THEN now() ELSE NULL END
      WHERE id = inv.id;
    RETURN jsonb_build_object(
      'verification_status', CASE WHEN attempt_no >= 3 THEN 'closed' ELSE 'awaiting_call' END,
      'member_added', false, 'email', inv.email, 'token', inv.token
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_family_invitation_call(uuid, uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_family_invitation_call(uuid, uuid, text, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_approved_family_invitation(
  p_token text,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inv public.family_invitations%ROWTYPE;
  account_email text;
  existing_family uuid;
BEGIN
  SELECT * INTO inv FROM public.family_invitations
  WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR inv.status <> 'verification_pending' OR inv.expires_at <= now()
    OR inv.consent_at IS NULL THEN
    RAISE EXCEPTION 'Approved invitation not found';
  END IF;

  SELECT lower(email) INTO account_email FROM auth.users WHERE id = p_user_id;
  IF account_email IS NULL OR inv.email IS NULL OR account_email <> lower(inv.email) THEN
    RAISE EXCEPTION 'Sign in with the invited email to join';
  END IF;

  SELECT family_id INTO existing_family FROM public.family_members WHERE user_id = p_user_id;
  IF existing_family IS NOT NULL THEN
    IF existing_family = inv.family_id THEN
      UPDATE public.family_invitations SET status = 'accepted', recipient_id = p_user_id WHERE id = inv.id;
      RETURN inv.family_id;
    END IF;
    RAISE EXCEPTION 'This account already belongs to another family';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (inv.family_id, p_user_id, inv.role);
  UPDATE public.family_invitations SET status = 'accepted', recipient_id = p_user_id WHERE id = inv.id;
  RETURN inv.family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_approved_family_invitation(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_approved_family_invitation(text, uuid) TO service_role;
