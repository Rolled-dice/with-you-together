BEGIN;

ALTER TABLE public.family_invitations
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN contact_phone text,
  ADD COLUMN contact_channel text NOT NULL DEFAULT 'email' CHECK (contact_channel IN ('email','sms')),
  ADD COLUMN invitee_name text NOT NULL DEFAULT 'Family member',
  ADD COLUMN relationship text NOT NULL DEFAULT 'Relative',
  ADD COLUMN recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN call_phone text,
  ADD COLUMN call_window text,
  ADD COLUMN call_timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN adult_confirmed_at timestamptz,
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN sharing_choices jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN delivery_status text NOT NULL DEFAULT 'not_sent' CHECK (delivery_status IN ('not_sent','sending','sent','failed')),
  ADD COLUMN last_sent_at timestamptz;
ALTER TABLE public.family_invitations DROP CONSTRAINT family_invitations_status_check;
ALTER TABLE public.family_invitations ADD CONSTRAINT family_invitations_status_check
  CHECK (status IN ('pending','verification_pending','active','accepted','declined','expired','revoked','verification_closed'));

CREATE TABLE public.family_sharing (
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receive_reminders boolean NOT NULL DEFAULT false,
  share_updates boolean NOT NULL DEFAULT false,
  share_health boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id,user_id)
);
CREATE TABLE public.family_verification_attempts (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES public.family_invitations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES auth.users(id),
  outcome text NOT NULL CHECK (outcome IN ('verified','no_answer','declined','technical_failure','reopened')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.family_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_sharing, public.family_verification_attempts FROM anon, authenticated;
GRANT SELECT ON public.family_sharing TO authenticated;
GRANT ALL ON public.family_sharing, public.family_verification_attempts TO service_role;
REVOKE ALL ON public.family_verification_attempts FROM anon, authenticated;
CREATE POLICY "Read own sharing choices" ON public.family_sharing FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Membership and consent transitions are server-only transactions.
REVOKE INSERT, UPDATE, DELETE ON public.family_members, public.family_invitations, public.families FROM authenticated;
REVOKE ALL ON public.family_members, public.family_invitations, public.families FROM anon;
REVOKE SELECT ON public.family_invitations FROM authenticated;
CREATE OR REPLACE FUNCTION public.is_family_admin(_uid uuid, _family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.families WHERE id = _family AND owner_id = _uid); $$;

CREATE OR REPLACE FUNCTION public.family_can_access(_viewer uuid, _subject uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _viewer = _subject OR EXISTS (
    SELECT 1 FROM public.family_members m
    JOIN public.families f ON f.id = m.family_id
    JOIN public.family_sharing s ON s.family_id = m.family_id AND s.user_id = m.user_id
    WHERE m.user_id = _subject AND f.owner_id = _viewer
      AND CASE _scope WHEN 'reminders' THEN s.receive_reminders
        WHEN 'updates' THEN s.share_updates WHEN 'health' THEN s.share_health ELSE false END
  );
$$;
REVOKE ALL ON FUNCTION public.family_can_access(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_can_access(uuid,uuid,text) TO authenticated, service_role;

-- Existing members keep their membership, but no personal data is shared by default.
DROP POLICY "View meds within family" ON public.medications;
CREATE POLICY "View consented medications" ON public.medications FOR SELECT TO authenticated
  USING (public.family_can_access(auth.uid(), for_user_id, 'health'));
DROP POLICY "Adults add meds for family" ON public.medications;
DROP POLICY "Adults update meds for family" ON public.medications;
DROP POLICY "Adults delete meds for family" ON public.medications;
CREATE POLICY "Add own medications" ON public.medications FOR INSERT TO authenticated
  WITH CHECK (for_user_id = auth.uid() AND added_by = auth.uid());
CREATE POLICY "Update own medications" ON public.medications FOR UPDATE TO authenticated
  USING (for_user_id = auth.uid()) WITH CHECK (for_user_id = auth.uid());
CREATE POLICY "Delete own medications" ON public.medications FOR DELETE TO authenticated
  USING (for_user_id = auth.uid());
DROP POLICY "View schedules via medication" ON public.medication_schedules;
DROP POLICY "Manage schedules via medication" ON public.medication_schedules;
CREATE POLICY "View consented schedules" ON public.medication_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND public.family_can_access(auth.uid(),m.for_user_id,'health')));
CREATE POLICY "Manage own schedules" ON public.medication_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND m.for_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND m.for_user_id = auth.uid()));
DROP POLICY "View dose logs in family" ON public.dose_logs;
DROP POLICY "Insert dose logs in family" ON public.dose_logs;
DROP POLICY "Update dose logs in family" ON public.dose_logs;
CREATE POLICY "View consented doses" ON public.dose_logs FOR SELECT TO authenticated
  USING (public.family_can_access(auth.uid(),for_user_id,'health'));
CREATE POLICY "Record own doses" ON public.dose_logs FOR ALL TO authenticated
  USING (for_user_id = auth.uid()) WITH CHECK (for_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.medications m WHERE m.id = medication_id AND m.for_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view family prescriptions" ON storage.objects;
-- Drop only prescription SELECT policies; upload and delete ownership stay intact.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND cmd = 'SELECT' AND qual LIKE '%prescriptions%'
  LOOP EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname); END LOOP;
END $$;
CREATE POLICY "Read consented prescription files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR EXISTS (
      SELECT 1 FROM public.medications m WHERE m.prescription_image_path = storage.objects.name
      AND public.family_can_access(auth.uid(),m.for_user_id,'health'))));

CREATE OR REPLACE FUNCTION public.family_command(p_actor uuid, p_action text, p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f public.families%ROWTYPE;
  i public.family_invitations%ROWTYPE;
  u auth.users%ROWTYPE;
  member public.family_members%ROWTYPE;
  target public.family_members%ROWTYPE;
  result jsonb;
  is_staff boolean;
  is_admin boolean;
  n integer;
  contact text;
  outcome text;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = p_actor;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  SELECT * INTO member FROM public.family_members WHERE user_id = p_actor;
  SELECT * INTO f FROM public.families WHERE id = member.family_id;
  is_admin := public.has_role(p_actor,'admin');
  is_staff := is_admin OR EXISTS (SELECT 1 FROM public.call_agents WHERE user_id = p_actor AND is_active);

  IF p_action = 'snapshot' THEN
    RETURN jsonb_build_object(
      'viewer_id',p_actor, 'family',CASE WHEN f.id IS NULL THEN NULL ELSE to_jsonb(f) END,
      'myRole',member.role, 'canInvite',f.owner_id = p_actor AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND care_tier = 'care_plus'),
      'members',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.joined_at) FROM (
        SELECT m.id,m.user_id,m.role,m.joined_at,p.display_name,COALESCE(p.timezone,'Asia/Kolkata') AS timezone,
          COALESCE(s.receive_reminders,false) AS receive_reminders, COALESCE(s.share_updates,false) AS share_updates,
          COALESCE(s.share_health,false) AS share_health
        FROM public.family_members m JOIN public.profiles p ON p.id=m.user_id
        LEFT JOIN public.family_sharing s ON s.family_id=m.family_id AND s.user_id=m.user_id WHERE m.family_id=f.id
      ) x),'[]'::jsonb),
      'invites',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id,invitee_name,relationship,email,contact_phone,contact_channel,
          CASE WHEN status IN ('pending','verification_pending') AND expires_at <= now() THEN 'expired' ELSE status END AS status,
          delivery_status,attempts,call_window,call_timezone,expires_at,created_at
        FROM public.family_invitations WHERE family_id=f.id AND f.owner_id=p_actor ORDER BY created_at DESC LIMIT 50
      ) x),'[]'::jsonb),
      'pending',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'family_name',fam.name,'status',
        CASE WHEN v.expires_at <= now() AND v.status='verification_pending' THEN 'expired' ELSE v.status END,
        'attempts',v.attempts,'call_window',v.call_window)) FROM public.family_invitations v
        JOIN public.families fam ON fam.id=v.family_id WHERE v.recipient_id=p_actor AND v.status IN ('verification_pending','verification_closed')),'[]'::jsonb));
  ELSIF p_action = 'create' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
    IF member.id IS NOT NULL THEN RAISE EXCEPTION 'You already belong to a family.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_actor AND care_tier='care_plus') THEN RAISE EXCEPTION 'Care Plus is required to start a family.'; END IF;
    IF length(trim(p_data->>'name')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Enter a family name.'; END IF;
    INSERT INTO public.families(name,owner_id) VALUES(trim(p_data->>'name'),p_actor) RETURNING * INTO f;
    INSERT INTO public.family_members(family_id,user_id,role) VALUES(f.id,p_actor,'owner');
    RETURN jsonb_build_object('id',f.id);
  ELSIF p_action = 'sharing' THEN
    IF f.id IS NULL THEN RAISE EXCEPTION 'Join a family first.'; END IF;
    PERFORM 1 FROM public.families WHERE id=f.id FOR UPDATE;
    IF NOT EXISTS(SELECT 1 FROM public.family_members WHERE family_id=f.id AND user_id=p_actor) THEN RAISE EXCEPTION 'Join a family first.'; END IF;
    INSERT INTO public.family_sharing(family_id,user_id,receive_reminders,share_updates,share_health)
      VALUES(f.id,p_actor,COALESCE((p_data->>'receive_reminders')::boolean,false),COALESCE((p_data->>'share_updates')::boolean,false),COALESCE((p_data->>'share_health')::boolean,false))
      ON CONFLICT(family_id,user_id) DO UPDATE SET receive_reminders=excluded.receive_reminders,share_updates=excluded.share_updates,share_health=excluded.share_health,updated_at=now();
    RETURN '{"ok":true}';
  ELSIF p_action = 'leave' THEN
    IF member.role='owner' THEN RAISE EXCEPTION 'The owner must close the family instead.'; END IF;
    PERFORM 1 FROM public.families WHERE id=f.id FOR UPDATE;
    DELETE FROM public.family_sharing WHERE family_id=f.id AND user_id=p_actor;
    DELETE FROM public.family_members WHERE id=member.id;
    RETURN '{"ok":true}';
  ELSIF p_action IN ('rename','delete','remove','invite') THEN
    IF f.id IS NULL OR f.owner_id <> p_actor THEN RAISE EXCEPTION 'Only the family owner can do this.'; END IF;
    PERFORM 1 FROM public.families WHERE id=f.id FOR UPDATE;
    IF p_action='rename' THEN
      IF length(trim(p_data->>'name')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Enter a family name.'; END IF;
      UPDATE public.families SET name=trim(p_data->>'name') WHERE id=f.id;
    ELSIF p_action='delete' THEN DELETE FROM public.families WHERE id=f.id;
    ELSIF p_action='remove' THEN
      SELECT * INTO target FROM public.family_members WHERE id=(p_data->>'member_id')::uuid AND family_id=f.id;
      IF target.id IS NULL OR target.role='owner' THEN RAISE EXCEPTION 'This member cannot be removed.'; END IF;
      DELETE FROM public.family_sharing WHERE family_id=f.id AND user_id=target.user_id;
      DELETE FROM public.family_members WHERE id=target.id;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_actor AND care_tier='care_plus') THEN RAISE EXCEPTION 'Care Plus is required to invite someone.'; END IF;
      IF (SELECT count(*) FROM public.family_invitations WHERE invited_by=p_actor AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Please wait before creating more invitations.'; END IF;
      UPDATE public.family_invitations SET status='expired' WHERE family_id=f.id AND status IN ('pending','verification_pending') AND expires_at<=now();
      contact := CASE WHEN p_data->>'contact_channel'='sms' THEN p_data->>'contact_phone' ELSE lower(trim(p_data->>'email')) END;
      IF contact IS NULL OR length(contact)<5 THEN RAISE EXCEPTION 'Enter a valid contact.'; END IF;
      IF EXISTS (SELECT 1 FROM public.family_invitations WHERE family_id=f.id
        AND (email=contact OR contact_phone=contact) AND status IN ('pending','verification_pending','verification_closed','declined')) THEN
        RAISE EXCEPTION 'An invitation already exists. Closed requests must be handled by support.';
      END IF;
      IF EXISTS (SELECT 1 FROM public.family_members m JOIN auth.users a ON a.id=m.user_id
        WHERE m.family_id=f.id AND (lower(a.email)=contact OR '+'||ltrim(a.phone,'+')=contact)) THEN RAISE EXCEPTION 'This person is already a member.'; END IF;
      SELECT (SELECT count(*) FROM public.family_members WHERE family_id=f.id) +
        (SELECT count(*) FROM public.family_invitations WHERE family_id=f.id AND status IN ('pending','verification_pending') AND expires_at>now()) INTO n;
      IF n>=5 THEN RAISE EXCEPTION 'All five family places are occupied or reserved.'; END IF;
      INSERT INTO public.family_invitations(family_id,email,contact_phone,contact_channel,invitee_name,relationship,call_window,call_timezone,role,invited_by)
        VALUES(f.id,CASE WHEN p_data->>'contact_channel'='email' THEN contact END,CASE WHEN p_data->>'contact_channel'='sms' THEN contact END,
          p_data->>'contact_channel',p_data->>'invitee_name',p_data->>'relationship',p_data->>'call_window',p_data->>'call_timezone','adult',p_actor) RETURNING * INTO i;
      RETURN jsonb_build_object('id',i.id);
    END IF;
    RETURN '{"ok":true}';
  ELSIF p_action IN ('lookup','accept','decline') THEN
    SELECT * INTO i FROM public.family_invitations WHERE token=p_data->>'token';
    IF i.id IS NULL THEN RAISE EXCEPTION 'This invitation is not available.'; END IF;
    -- Lock the family before its invitation everywhere, including activation.
    PERFORM 1 FROM public.families WHERE id=i.family_id FOR UPDATE;
    SELECT * INTO i FROM public.family_invitations WHERE id=i.id FOR UPDATE;
    IF NOT ((i.contact_channel='email' AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(i.email)) OR
      (i.contact_channel='sms' AND u.phone_confirmed_at IS NOT NULL AND '+'||ltrim(u.phone,'+')=i.contact_phone)) THEN
      RAISE EXCEPTION 'Sign in with the email or phone number that received this invitation.';
    END IF;
    IF p_action='lookup' THEN
      SELECT name INTO contact FROM public.families WHERE id=i.family_id;
      RETURN (to_jsonb(i)-'token'-'assigned_to'-'sharing_choices') || jsonb_build_object('family_name',contact,'status',
        CASE WHEN i.expires_at<=now() AND i.status IN ('pending','verification_pending') THEN 'expired' ELSE i.status END);
    END IF;
    IF i.status NOT IN ('pending','verification_pending') OR i.expires_at<=now() THEN RAISE EXCEPTION 'This invitation is no longer open.'; END IF;
    IF p_action='decline' THEN
      UPDATE public.family_invitations SET status='declined',recipient_id=p_actor WHERE id=i.id;
      RETURN '{"ok":true}';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
    IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id=p_actor) THEN RAISE EXCEPTION 'You already belong to a family.'; END IF;
    IF EXISTS (SELECT 1 FROM public.family_invitations WHERE recipient_id=p_actor AND status='verification_pending' AND id<>i.id AND expires_at>now()) THEN RAISE EXCEPTION 'You already have a verification in progress.'; END IF;
    IF COALESCE((p_data->>'adult_confirmed')::boolean,false)=false THEN RAISE EXCEPTION 'Confirm that you are at least 18.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'call_timezone') THEN RAISE EXCEPTION 'Choose a valid timezone.'; END IF;
    UPDATE public.family_invitations SET recipient_id=p_actor,status='verification_pending',consent_at=now(),adult_confirmed_at=now(),
      invitee_name=p_data->>'display_name', call_phone=p_data->>'call_phone',call_window=p_data->>'call_window',call_timezone=p_data->>'call_timezone',
      sharing_choices=jsonb_build_object('receive_reminders',COALESCE((p_data->>'receive_reminders')::boolean,false),
        'share_updates',COALESCE((p_data->>'share_updates')::boolean,false),'share_health',COALESCE((p_data->>'share_health')::boolean,false)) WHERE id=i.id;
    RETURN '{"ok":true}';
  ELSIF p_action IN ('revoke','delivery_claim','delivery_result','claim_verification','verify','reopen') THEN
    SELECT * INTO i FROM public.family_invitations WHERE id=(p_data->>'id')::uuid;
    IF i.id IS NULL THEN RAISE EXCEPTION 'Invitation not found.'; END IF;
    SELECT * INTO f FROM public.families WHERE id=i.family_id FOR UPDATE;
    SELECT * INTO i FROM public.family_invitations WHERE id=i.id FOR UPDATE;
    IF p_action IN ('revoke','delivery_claim','delivery_result') THEN
      IF f.owner_id<>p_actor THEN RAISE EXCEPTION 'Only the owner can do this.'; END IF;
      IF p_action<>'delivery_result' AND (i.status NOT IN ('pending','verification_pending') OR i.expires_at<=now()) THEN RAISE EXCEPTION 'This invitation is no longer open.'; END IF;
      IF p_action='revoke' THEN UPDATE public.family_invitations SET status='revoked' WHERE id=i.id;
      ELSIF p_action='delivery_claim' THEN
        IF i.status<>'pending' THEN RAISE EXCEPTION 'The recipient has already responded.'; END IF;
        IF i.last_sent_at>now()-interval '5 minutes' THEN RAISE EXCEPTION 'Wait five minutes before sending again.'; END IF;
        UPDATE public.family_invitations SET delivery_status='sending',last_sent_at=now() WHERE id=i.id;
        RETURN jsonb_build_object('id',i.id,'token',i.token,'email',i.email,'contact_phone',i.contact_phone,'contact_channel',i.contact_channel,'family_name',f.name,'last_sent_at',now());
      ELSE UPDATE public.family_invitations SET delivery_status=CASE WHEN (p_data->>'sent')::boolean THEN 'sent' ELSE 'failed' END WHERE id=i.id;
      END IF;
    ELSE
      IF NOT is_staff THEN RAISE EXCEPTION 'Staff access required.'; END IF;
      IF p_action='reopen' THEN
        IF NOT is_admin OR i.status<>'verification_closed' OR COALESCE((p_data->>'recipient_requested')::boolean,false)=false OR length(trim(p_data->>'note'))<10 THEN RAISE EXCEPTION 'Support must record the recipient request before reopening.'; END IF;
        SELECT (SELECT count(*) FROM public.family_members WHERE family_id=f.id)+(SELECT count(*) FROM public.family_invitations WHERE family_id=f.id AND status IN ('pending','verification_pending') AND expires_at>now()) INTO n;
        IF n>=5 THEN RAISE EXCEPTION 'The family has no available place.'; END IF;
        UPDATE public.family_invitations SET status='verification_pending',attempts=0,expires_at=now()+interval '14 days',assigned_to=NULL WHERE id=i.id;
        INSERT INTO public.family_verification_attempts(id,invitation_id,agent_id,outcome,note) VALUES((p_data->>'attempt_id')::uuid,i.id,p_actor,'reopened',p_data->>'note');
      ELSE
        IF p_action='verify' AND EXISTS(SELECT 1 FROM public.family_verification_attempts WHERE id=(p_data->>'attempt_id')::uuid AND invitation_id=i.id AND agent_id=p_actor) THEN RETURN '{"ok":true}'; END IF;
        IF i.status<>'verification_pending' OR i.expires_at<=now() THEN RAISE EXCEPTION 'This verification is no longer open.'; END IF;
        IF i.assigned_to IS NOT NULL AND i.assigned_to<>p_actor AND NOT is_admin THEN RAISE EXCEPTION 'Another listener is handling this verification.'; END IF;
        IF p_action='claim_verification' THEN UPDATE public.family_invitations SET assigned_to=p_actor WHERE id=i.id;
        ELSE
          IF i.assigned_to IS NULL THEN RAISE EXCEPTION 'Claim this verification first.'; END IF;
          outcome:=p_data->>'outcome';
          IF outcome='verified' THEN
            IF COALESCE((p_data->>'consent_confirmed')::boolean,false)=false OR i.consent_at IS NULL OR i.adult_confirmed_at IS NULL THEN RAISE EXCEPTION 'Confirm identity and consent with the recipient.'; END IF;
            PERFORM pg_advisory_xact_lock(hashtextextended(i.recipient_id::text,0));
            IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id=i.recipient_id) THEN RAISE EXCEPTION 'This person already belongs to a family.'; END IF;
            IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=f.owner_id AND care_tier='care_plus') THEN RAISE EXCEPTION 'The family needs an active Care Plus plan.'; END IF;
            SELECT count(*) INTO n FROM public.family_members WHERE family_id=f.id;
            IF n>=5 THEN RAISE EXCEPTION 'The family is full.'; END IF;
            INSERT INTO public.family_members(family_id,user_id,role) VALUES(f.id,i.recipient_id,'adult');
            INSERT INTO public.family_sharing(family_id,user_id,receive_reminders,share_updates,share_health)
              VALUES(f.id,i.recipient_id,COALESCE((i.sharing_choices->>'receive_reminders')::boolean,false),COALESCE((i.sharing_choices->>'share_updates')::boolean,false),COALESCE((i.sharing_choices->>'share_health')::boolean,false));
            UPDATE public.profiles SET display_name=i.invitee_name,timezone=i.call_timezone WHERE id=i.recipient_id;
            UPDATE public.family_invitations SET status='active' WHERE id=i.id;
          ELSIF outcome='declined' THEN UPDATE public.family_invitations SET status='declined' WHERE id=i.id;
          ELSIF outcome='no_answer' THEN UPDATE public.family_invitations SET attempts=attempts+1,status=CASE WHEN attempts+1>=3 THEN 'verification_closed' ELSE 'verification_pending' END WHERE id=i.id;
          ELSIF outcome<>'technical_failure' THEN RAISE EXCEPTION 'Choose a verification outcome.';
          END IF;
          INSERT INTO public.family_verification_attempts(id,invitation_id,agent_id,outcome,note) VALUES((p_data->>'attempt_id')::uuid,i.id,p_actor,outcome,COALESCE(p_data->>'note',''));
        END IF;
      END IF;
    END IF;
    RETURN '{"ok":true}';
  ELSIF p_action='verification_queue' THEN
    IF NOT is_staff THEN RAISE EXCEPTION 'Staff access required.'; END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at),'[]'::jsonb) INTO result FROM (
      SELECT v.id,v.invitee_name,v.relationship,v.status,v.attempts,v.call_window,v.call_timezone,v.assigned_to,v.created_at,
        CASE WHEN v.assigned_to=p_actor OR is_admin THEN v.call_phone END AS call_phone,
        CASE WHEN v.assigned_to=p_actor OR is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('outcome',a.outcome,'note',a.note,'created_at',a.created_at) ORDER BY a.created_at) FROM public.family_verification_attempts a WHERE a.invitation_id=v.id),'[]'::jsonb) ELSE '[]'::jsonb END AS history
      FROM public.family_invitations v WHERE (v.status='verification_pending' AND v.expires_at>now() OR is_admin AND v.status='verification_closed')
        AND (v.assigned_to IS NULL OR v.assigned_to=p_actor OR is_admin) ORDER BY v.created_at LIMIT 100
    ) x;
    RETURN jsonb_build_object('viewer_id',p_actor,'is_admin',is_admin,'rows',result);
  END IF;
  RAISE EXCEPTION 'Unsupported family action.';
END;
$$;
REVOKE ALL ON FUNCTION public.family_command(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_command(uuid,text,jsonb) TO service_role;

COMMIT;
