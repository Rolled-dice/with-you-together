BEGIN;
ALTER TABLE public.reminders ADD COLUMN timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN occurrence_cursor integer NOT NULL DEFAULT 0,
  ADD COLUMN next_occurrence_at timestamptz;
UPDATE public.reminders r SET timezone=CASE WHEN EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p.timezone) THEN p.timezone ELSE 'UTC' END,next_occurrence_at=r.due_at FROM public.profiles p WHERE p.id=r.for_user_id AND r.status IN ('pending','snoozed');
UPDATE public.reminders SET next_occurrence_at=due_at WHERE status IN ('pending','snoozed') AND next_occurrence_at IS NULL;
CREATE TABLE public.reminder_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','snoozed','dismissed')),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  update_text text CHECK (length(update_text)<=2000),
  notified_at timestamptz,
  UNIQUE(reminder_id,scheduled_at)
);
ALTER TABLE public.reminder_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminder_occurrences FROM anon,authenticated;
GRANT SELECT ON public.reminder_occurrences TO authenticated;
GRANT ALL ON public.reminder_occurrences TO service_role;
CREATE POLICY "Read own reminder occurrences" ON public.reminder_occurrences FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.reminders r WHERE r.id=reminder_id AND r.for_user_id=auth.uid()));
DROP POLICY "View reminders in family" ON public.reminders;
DROP POLICY "Create reminders in family" ON public.reminders;
DROP POLICY "Update reminders in family" ON public.reminders;
DROP POLICY "Delete reminders in family" ON public.reminders;
CREATE POLICY "Read own reminders" ON public.reminders FOR SELECT TO authenticated USING (for_user_id=auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.reminders FROM authenticated;
CREATE INDEX reminder_occurrences_due ON public.reminder_occurrences(due_at) WHERE status IN ('pending','snoozed');

CREATE OR REPLACE FUNCTION public.materialize_reminder_occurrences(p_only uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reminders%ROWTYPE; t timestamptz; cursor_value integer; step interval; n integer:=0; guard integer;
BEGIN
  FOR r IN SELECT * FROM public.reminders WHERE status IN ('pending','snoozed')
    AND next_occurrence_at<=now()+interval '1 day' AND (p_only IS NULL OR id=p_only)
    ORDER BY next_occurrence_at LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    t:=r.next_occurrence_at; cursor_value:=r.occurrence_cursor; guard:=0;
    step:=CASE r.recurrence WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '1 week'
      WHEN 'monthly' THEN interval '1 month' WHEN 'yearly' THEN interval '1 year' ELSE NULL END;
    WHILE t<=now()+interval '1 day' AND guard<5000 LOOP
      IF step IS NULL OR t>=now()-interval '7 days' THEN
        INSERT INTO public.reminder_occurrences(reminder_id,scheduled_at,due_at) VALUES(r.id,t,t) ON CONFLICT DO NOTHING;
        n:=n+1;
      END IF;
      IF step IS NULL THEN t:=NULL; EXIT; END IF;
      cursor_value:=cursor_value+1; guard:=guard+1;
      -- Anchor to the original local time: DST and month-end do not accumulate drift.
      t:=((r.due_at AT TIME ZONE r.timezone)+step*cursor_value) AT TIME ZONE r.timezone;
    END LOOP;
    UPDATE public.reminders SET next_occurrence_at=t,occurrence_cursor=cursor_value WHERE id=r.id;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.materialize_reminder_occurrences(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_reminder_occurrences(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.family_reminder_command(p_actor uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reminders%ROWTYPE; o public.reminder_occurrences%ROWTYPE; subject uuid; result jsonb; tz text; action_time timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  IF p_action IN ('list','today') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.due_at),'[]'::jsonb) INTO result FROM (
      SELECT oc.id,rm.id AS reminder_id,rm.for_user_id,rm.created_by,rm.title,rm.description,rm.category,rm.recurrence,rm.timezone,
        CASE WHEN public.family_can_access(p_actor,rm.for_user_id,'updates') THEN oc.due_at ELSE oc.scheduled_at END AS due_at,
        CASE WHEN public.family_can_access(p_actor,rm.for_user_id,'updates') THEN oc.status ELSE 'no_update' END AS status,
        CASE WHEN public.family_can_access(p_actor,rm.for_user_id,'updates') THEN oc.update_text END AS update_text,
        CASE WHEN public.family_can_access(p_actor,rm.for_user_id,'updates') THEN oc.completed_at END AS completed_at,
        rm.for_user_id=p_actor AS can_complete
      FROM public.reminder_occurrences oc JOIN public.reminders rm ON rm.id=oc.reminder_id
      WHERE (rm.for_user_id=p_actor OR p_action='today' AND (
        public.family_can_access(p_actor,rm.for_user_id,'updates') OR
        rm.created_by=p_actor AND public.family_can_access(p_actor,rm.for_user_id,'reminders')))
        AND rm.status<>'dismissed' AND (p_action='today' OR oc.status IN ('pending','snoozed'))
        AND (oc.status IN ('pending','snoozed') OR oc.completed_at>now()-interval '7 days')
      ORDER BY oc.due_at LIMIT 200
    ) x;
    RETURN result;
  ELSIF p_action='create' THEN
    subject:=(p_data->>'for_user_id')::uuid;
    IF subject<>p_actor THEN
      PERFORM 1 FROM public.families f JOIN public.family_members m ON m.family_id=f.id
        WHERE m.user_id=subject AND f.owner_id=p_actor FOR UPDATE OF f;
    END IF;
    IF NOT public.family_can_access(p_actor,subject,'reminders') THEN RAISE EXCEPTION 'This person has not enabled reminders from you.'; END IF;
    SELECT COALESCE(NULLIF(p_data->>'timezone',''),timezone,'UTC') INTO tz FROM public.profiles WHERE id=subject;
    IF tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=tz) THEN RAISE EXCEPTION 'Choose a valid timezone.'; END IF;
    action_time:=(p_data->>'due_at')::timestamptz;
    IF action_time<=now() OR action_time>now()+interval '5 years' THEN RAISE EXCEPTION 'Choose a future reminder time within five years.'; END IF;
    INSERT INTO public.reminders(for_user_id,created_by,title,description,category,due_at,recurrence,timezone,next_occurrence_at)
      VALUES(subject,p_actor,p_data->>'title',p_data->>'description',COALESCE(p_data->>'category','general'),action_time,
        COALESCE(p_data->>'recurrence','none'),tz,action_time) RETURNING * INTO r;
    -- Always show the first occurrence, even when it is beyond tomorrow.
    INSERT INTO public.reminder_occurrences(reminder_id,scheduled_at,due_at) VALUES(r.id,action_time,action_time);
    RETURN jsonb_build_object('id',r.id);
  END IF;
  SELECT * INTO o FROM public.reminder_occurrences WHERE id=(p_data->>'id')::uuid;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Reminder not found. Refresh and try again.'; END IF;
  -- Match the scheduler's lock order: reminder first, then its occurrence.
  SELECT * INTO r FROM public.reminders WHERE id=o.reminder_id FOR UPDATE;
  SELECT * INTO o FROM public.reminder_occurrences WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF r.id IS NULL OR o.id IS NULL THEN RAISE EXCEPTION 'Reminder not found. Refresh and try again.'; END IF;
  IF p_action='delete' THEN
    IF r.for_user_id<>p_actor AND NOT (r.created_by=p_actor AND public.family_can_access(p_actor,r.for_user_id,'reminders')) THEN RAISE EXCEPTION 'You cannot cancel this reminder.'; END IF;
    UPDATE public.reminders SET status='dismissed',next_occurrence_at=NULL WHERE id=r.id;
    UPDATE public.reminder_occurrences SET status='dismissed' WHERE reminder_id=r.id AND status IN ('pending','snoozed');
  ELSE
    IF r.for_user_id<>p_actor OR r.status='dismissed' THEN RAISE EXCEPTION 'Only the recipient can update this reminder.'; END IF;
    IF p_action='complete' THEN
      UPDATE public.reminder_occurrences SET status='done',completed_at=COALESCE(completed_at,now()),completed_by=p_actor WHERE id=o.id;
      IF r.recurrence='none' THEN UPDATE public.reminders SET status='done',completed_at=now(),next_occurrence_at=NULL WHERE id=r.id; END IF;
    ELSIF p_action='snooze' THEN
      IF o.status NOT IN ('pending','snoozed') THEN RAISE EXCEPTION 'This reminder is already complete.'; END IF;
      action_time:=(p_data->>'due_at')::timestamptz;
      IF action_time<=now() OR action_time>now()+interval '30 days' THEN RAISE EXCEPTION 'Choose a reminder time within 30 days.'; END IF;
      UPDATE public.reminder_occurrences SET status='snoozed',due_at=action_time,notified_at=NULL WHERE id=o.id;
    ELSIF p_action='update' THEN
      UPDATE public.reminder_occurrences SET update_text=p_data->>'update_text' WHERE id=o.id;
    ELSE RAISE EXCEPTION 'Unsupported reminder action.';
    END IF;
  END IF;
  RETURN '{"ok":true}';
END; $$;
REVOKE ALL ON FUNCTION public.family_reminder_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.family_reminder_command(uuid,text,jsonb) TO service_role;
SELECT public.materialize_reminder_occurrences();
COMMIT;
