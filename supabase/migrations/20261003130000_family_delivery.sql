BEGIN;
ALTER TABLE public.notifications ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX notifications_dedupe ON public.notifications(user_id,dedupe_key);
CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reminder_push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL REFERENCES public.push_devices(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES public.reminder_occurrences(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','cancelled','failed')),
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_until timestamptz, UNIQUE(device_id,occurrence_id,due_at)
);
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_push_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_devices,public.reminder_push_jobs FROM anon,authenticated;
GRANT SELECT ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices,public.reminder_push_jobs TO service_role;
CREATE POLICY "Read own push devices" ON public.push_devices FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX reminder_push_ready ON public.reminder_push_jobs(next_attempt_at) WHERE state='pending';

CREATE FUNCTION public.push_command(p_actor uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE device public.push_devices%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  IF p_action='subscribe' THEN
    INSERT INTO public.push_devices(user_id,endpoint,p256dh,auth_key) VALUES(p_actor,p_data->>'endpoint',p_data->>'p256dh',p_data->>'auth')
      ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth_key=excluded.auth_key,enabled=true,updated_at=now()
      WHERE push_devices.user_id=p_actor RETURNING * INTO device;
    IF device.id IS NULL THEN RAISE EXCEPTION 'Disable notifications in the previous account before enabling them here.'; END IF;
    RETURN jsonb_build_object('id',device.id);
  ELSIF p_action='disable' THEN
    UPDATE public.push_devices SET enabled=false,updated_at=now() WHERE user_id=p_actor AND endpoint=p_data->>'endpoint';
    DELETE FROM public.reminder_push_jobs WHERE device_id IN(SELECT id FROM public.push_devices WHERE user_id=p_actor AND endpoint=p_data->>'endpoint') AND state='pending';
    RETURN '{"ok":true}';
  ELSIF p_action='status' THEN
    RETURN jsonb_build_object('enabled',EXISTS(SELECT 1 FROM public.push_devices WHERE user_id=p_actor AND endpoint=p_data->>'endpoint' AND enabled));
  END IF;
  RAISE EXCEPTION 'Unsupported notification action.';
END; $$;
REVOKE ALL ON FUNCTION public.push_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_command(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.prepare_reminder_delivery() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE occurrence record; n integer:=0;
BEGIN
  PERFORM public.materialize_reminder_occurrences();
  FOR occurrence IN SELECT o.id,o.due_at,r.for_user_id FROM public.reminder_occurrences o JOIN public.reminders r ON r.id=o.reminder_id
    WHERE o.status IN('pending','snoozed') AND r.status IN('pending','snoozed') AND o.due_at<=now()
      AND o.due_at>now()-interval '1 day' AND o.notified_at IS NULL LIMIT 200 FOR UPDATE OF o SKIP LOCKED
  LOOP
    INSERT INTO public.notifications(user_id,kind,severity,title,body,dedupe_key)
      VALUES(occurrence.for_user_id,'family_reminder','info','A reminder is ready','Open SomeoneNear to review your reminder.',occurrence.id::text||':'||occurrence.due_at::text)
      ON CONFLICT(user_id,dedupe_key) DO NOTHING;
    INSERT INTO public.reminder_push_jobs(device_id,occurrence_id,due_at)
      SELECT id,occurrence.id,occurrence.due_at FROM public.push_devices WHERE user_id=occurrence.for_user_id AND enabled ON CONFLICT DO NOTHING;
    UPDATE public.reminder_occurrences SET notified_at=now() WHERE id=occurrence.id;
    n:=n+1;
  END LOOP;
  RETURN n;
END; $$;
CREATE FUNCTION public.claim_reminder_push() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.reminder_push_jobs%ROWTYPE; result jsonb:='[]'; device public.push_devices%ROWTYPE;
BEGIN
  UPDATE public.reminder_push_jobs j SET state='cancelled' WHERE state='pending' AND (
    due_at<=now()-interval '1 day' OR NOT EXISTS(SELECT 1 FROM public.push_devices d JOIN public.reminder_occurrences o ON o.id=j.occurrence_id
      JOIN public.reminders r ON r.id=o.reminder_id WHERE d.id=j.device_id AND d.enabled AND o.status IN('pending','snoozed') AND o.due_at=j.due_at AND r.status IN('pending','snoozed')));
  FOR job IN SELECT * FROM public.reminder_push_jobs WHERE state='pending' AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO device FROM public.push_devices WHERE id=job.device_id;
    UPDATE public.reminder_push_jobs SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id=job.id RETURNING * INTO job;
    result:=result||jsonb_build_array(jsonb_build_object('id',job.id,'lease_token',job.lease_token,'endpoint',device.endpoint,'p256dh',device.p256dh,'auth',device.auth_key,'tag',job.occurrence_id::text||':'||job.due_at::text,
      'url',CASE WHEN EXISTS(SELECT 1 FROM public.family_members WHERE user_id=device.user_id AND role<>'owner') THEN '/family' ELSE '/reminders?view=everyday' END));
  END LOOP;
  RETURN result;
END; $$;
CREATE FUNCTION public.finish_reminder_push(p_id uuid,p_lease uuid,p_outcome text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.reminder_push_jobs%ROWTYPE;
BEGIN
  SELECT * INTO job FROM public.reminder_push_jobs WHERE id=p_id AND lease_token=p_lease AND state='pending' FOR UPDATE;
  IF job.id IS NULL THEN RETURN; END IF;
  IF p_outcome='gone' THEN UPDATE public.push_devices SET enabled=false WHERE id=job.device_id; END IF;
  UPDATE public.reminder_push_jobs SET state=CASE WHEN p_outcome='sent' THEN 'sent' WHEN p_outcome='gone' OR attempts>=5 THEN 'failed' ELSE 'pending' END,
    next_attempt_at=now()+interval '1 minute'*power(2,attempts),lease_token=NULL,lease_until=NULL WHERE id=job.id;
END; $$;
REVOKE ALL ON FUNCTION public.prepare_reminder_delivery(),public.claim_reminder_push(),public.finish_reminder_push(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_reminder_delivery(),public.claim_reminder_push(),public.finish_reminder_push(uuid,uuid,text) TO service_role;

-- Browser writes can only create a future message or cancel an unchanged draft.
CREATE FUNCTION public.guard_scheduled_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'scheduled' OR NEW.delivered_at IS NOT NULL OR NEW.scheduled_at<=now() THEN RAISE EXCEPTION 'Choose a future delivery time.'; END IF;
    IF NEW.recipient_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.family_members a JOIN public.family_members b ON a.family_id=b.family_id WHERE a.user_id=NEW.user_id AND b.user_id=NEW.recipient_user_id AND a.user_id<>b.user_id) THEN RAISE EXCEPTION 'Choose an active member of your family.'; END IF;
    IF NEW.s3_key IS NOT NULL AND NEW.s3_key NOT LIKE 'send-later/'||NEW.user_id::text||'/%' THEN RAISE EXCEPTION 'Invalid recording owner.'; END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    IF OLD.user_id<>auth.uid() OR OLD.status<>'scheduled' OR NEW.status<>'cancelled'
      OR (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') THEN RAISE EXCEPTION 'Only an unchanged scheduled message can be cancelled.'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER scheduled_message_guard BEFORE INSERT OR UPDATE ON public.scheduled_messages FOR EACH ROW EXECUTE FUNCTION public.guard_scheduled_message();
REVOKE ALL ON FUNCTION public.guard_scheduled_message() FROM PUBLIC,anon,authenticated;
DROP POLICY "Users manage their own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Read own scheduled messages" ON public.scheduled_messages FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Create own scheduled messages" ON public.scheduled_messages FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY "Cancel own scheduled messages" ON public.scheduled_messages FOR UPDATE TO authenticated USING(user_id=auth.uid() AND status='scheduled') WITH CHECK(user_id=auth.uid() AND status='cancelled');
CREATE POLICY "Read released family messages" ON public.scheduled_messages FOR SELECT TO authenticated USING(recipient_user_id=auth.uid() AND status='delivered' AND scheduled_at<=now()
  AND EXISTS(SELECT 1 FROM public.family_members a JOIN public.family_members b ON a.family_id=b.family_id WHERE a.user_id=scheduled_messages.user_id AND b.user_id=auth.uid()));
REVOKE DELETE ON public.scheduled_messages FROM authenticated;
CREATE FUNCTION public.deliver_family_messages() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE message public.scheduled_messages%ROWTYPE; n integer:=0;
BEGIN
  FOR message IN SELECT * FROM public.scheduled_messages WHERE status='scheduled' AND scheduled_at<=now() LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
    IF message.recipient_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.family_members a JOIN public.family_members b ON a.family_id=b.family_id WHERE a.user_id=message.user_id AND b.user_id=message.recipient_user_id) THEN
      UPDATE public.scheduled_messages SET status='cancelled' WHERE id=message.id;
      CONTINUE;
    END IF;
    UPDATE public.scheduled_messages SET status='delivered',delivered_at=now() WHERE id=message.id;
    INSERT INTO public.notifications(user_id,kind,severity,title,body,dedupe_key) VALUES(message.user_id,'send_later','info','Your message was released','Open Send Later to view it.','sent:'||message.id) ON CONFLICT DO NOTHING;
    IF message.recipient_user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,kind,severity,title,body,dedupe_key) VALUES(message.recipient_user_id,'send_later','info','A message is ready','Open Send Later to read or play it.','received:'||message.id) ON CONFLICT DO NOTHING;
    END IF;
    n:=n+1;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.deliver_family_messages() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_family_messages() TO service_role;
COMMIT;
