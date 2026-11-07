-- Distinguish a staff-initiated phone call from an SMS invitation.
ALTER TABLE public.family_invitations
  DROP CONSTRAINT IF EXISTS family_invitations_contact_channel_check;

ALTER TABLE public.family_invitations
  ADD CONSTRAINT family_invitations_contact_channel_check
  CHECK (contact_channel = ANY (ARRAY['email'::text, 'sms'::text, 'phone_call'::text]));
