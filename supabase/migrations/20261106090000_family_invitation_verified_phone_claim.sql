-- Let a caller-approved invitation attach to an existing account only when
-- that account has a verified phone matching the number the agent called.
-- Email-based linking remains available for existing email invitations.

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
  phone_user_id uuid;
  email_user_id uuid;
  invitee_user_id uuid;
  existing_family uuid;
  account_conflict boolean := false;
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
    SELECT id INTO phone_user_id FROM auth.users
      WHERE phone = inv.call_phone AND phone_confirmed_at IS NOT NULL
      LIMIT 1;
    IF inv.email IS NOT NULL THEN
      SELECT id INTO email_user_id FROM auth.users
        WHERE lower(email) = lower(inv.email)
        LIMIT 1;
    END IF;

    -- A verified phone is the strongest match because the agent confirmed
    -- consent with the person at that number. Fall back to the invited email
    -- for existing email-based accounts that have no verified phone on file.
    invitee_user_id := coalesce(phone_user_id, email_user_id);

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
        account_conflict := true;
      ELSE
        IF existing_family IS NULL THEN
          INSERT INTO public.family_members (family_id, user_id, role)
            VALUES (inv.family_id, invitee_user_id, inv.role);
        END IF;
        UPDATE public.family_invitations
          SET status = 'accepted', recipient_id = invitee_user_id
          WHERE id = inv.id;
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'verification_status', 'approved',
      'member_added', invitee_user_id IS NOT NULL AND NOT account_conflict,
      'account_conflict', account_conflict,
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

CREATE OR REPLACE FUNCTION public.claim_approved_family_invitation(
  p_token text,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inv public.family_invitations%ROWTYPE;
  account_email text;
  account_phone text;
  phone_confirmed boolean;
  existing_family uuid;
BEGIN
  SELECT * INTO inv FROM public.family_invitations
  WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR inv.status <> 'verification_pending' OR inv.expires_at <= now()
    OR inv.consent_at IS NULL OR inv.call_phone IS NULL THEN
    RAISE EXCEPTION 'Approved invitation not found';
  END IF;

  SELECT lower(email), phone, phone_confirmed_at IS NOT NULL
    INTO account_email, account_phone, phone_confirmed
    FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND OR NOT (
    (phone_confirmed AND account_phone = inv.call_phone)
    OR (inv.email IS NOT NULL AND account_email = lower(inv.email))
  ) THEN
    RAISE EXCEPTION 'Sign in with the invited, verified phone number or email';
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

REVOKE ALL ON FUNCTION public.record_family_invitation_call(uuid, uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_family_invitation_call(uuid, uuid, text, boolean, text) TO service_role;
REVOKE ALL ON FUNCTION public.claim_approved_family_invitation(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_approved_family_invitation(text, uuid) TO service_role;
