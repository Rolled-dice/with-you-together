BEGIN;
REVOKE INSERT ON public.profiles FROM authenticated;
CREATE FUNCTION public.guard_profile_entitlements() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_setting('role',true) IN ('authenticated','anon') THEN
    IF NEW.care_tier IS DISTINCT FROM OLD.care_tier OR NEW.care_status IS DISTINCT FROM OLD.care_status OR NEW.care_since IS DISTINCT FROM OLD.care_since THEN
      RAISE EXCEPTION 'Membership is managed by billing.';
    END IF;
    IF NEW.phone_verified AND (NOT OLD.phone_verified OR NEW.phone IS DISTINCT FROM OLD.phone) THEN RAISE EXCEPTION 'Verify your phone number first.'; END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN NEW.phone_verified:=false; END IF;
  END IF;
  IF NEW.timezone IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Choose a valid timezone.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profile_entitlement_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_entitlements();
REVOKE ALL ON FUNCTION public.guard_profile_entitlements() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sync_auth_phone_confirmation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles SET phone='+'||ltrim(NEW.phone,'+'),phone_verified=true WHERE id=NEW.id;
  ELSIF OLD.phone IS DISTINCT FROM NEW.phone THEN
    UPDATE public.profiles SET phone_verified=false WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER sync_confirmed_auth_phone AFTER UPDATE OF phone,phone_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_auth_phone_confirmation();
REVOKE ALL ON FUNCTION public.sync_auth_phone_confirmation() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.guard_prescription_reference() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.prescription_image_path IS NOT NULL AND (TG_OP='INSERT' OR NEW.prescription_image_path IS DISTINCT FROM OLD.prescription_image_path)
    AND NEW.prescription_image_path NOT LIKE NEW.for_user_id::text||'/%' THEN RAISE EXCEPTION 'Choose a prescription uploaded to your own account.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER prescription_reference_guard BEFORE INSERT OR UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.guard_prescription_reference();
REVOKE ALL ON FUNCTION public.guard_prescription_reference() FROM PUBLIC,anon,authenticated;

-- Notify both parties after membership progress changes; no clinical details are included.
CREATE FUNCTION public.notify_family_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid; label text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN('verification_pending','active','declined','verification_closed','revoked') THEN RETURN NEW; END IF;
  SELECT owner_id INTO owner FROM public.families WHERE id=NEW.family_id;
  IF owner IS NULL THEN RETURN NEW; END IF;
  label:=CASE NEW.status WHEN 'verification_pending' THEN 'A welcome call has been requested' WHEN 'active' THEN 'Your family connection is active'
    WHEN 'declined' THEN 'A family invitation was declined' WHEN 'verification_closed' THEN 'A welcome call request has closed' ELSE 'A family invitation was revoked' END;
  INSERT INTO public.notifications(user_id,kind,severity,title,body,dedupe_key) VALUES(owner,'family_progress','info',label,'Open Family to review the invitation.',NEW.id||':'||NEW.status||':'||NEW.attempts) ON CONFLICT DO NOTHING;
  IF NEW.recipient_id IS NOT NULL AND NEW.recipient_id<>owner THEN
    INSERT INTO public.notifications(user_id,kind,severity,title,body,dedupe_key) VALUES(NEW.recipient_id,'family_progress','info',label,'Open Family to review your connection.',NEW.id||':'||NEW.status||':'||NEW.attempts) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER family_progress_notification AFTER UPDATE OF status ON public.family_invitations FOR EACH ROW EXECUTE FUNCTION public.notify_family_progress();
REVOKE ALL ON FUNCTION public.notify_family_progress() FROM PUBLIC,anon,authenticated;

-- Consent withdrawal cancels future family-created reminders, not personal ones.
CREATE FUNCTION public.cancel_unconsented_family_reminders(p_subject uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.reminders SET status='dismissed',next_occurrence_at=NULL
    WHERE for_user_id=p_subject AND created_by<>for_user_id AND status IN('pending','snoozed')
      AND NOT public.family_can_access(created_by,for_user_id,'reminders');
  UPDATE public.reminder_occurrences o SET status='dismissed' FROM public.reminders r
    WHERE r.id=o.reminder_id AND r.for_user_id=p_subject AND r.created_by<>r.for_user_id
      AND r.status='dismissed' AND o.status IN('pending','snoozed');
  UPDATE public.reminder_push_jobs j SET state='cancelled',lease_token=NULL,lease_until=NULL
    FROM public.reminder_occurrences o JOIN public.reminders r ON r.id=o.reminder_id
    WHERE j.occurrence_id=o.id AND r.for_user_id=p_subject AND o.status='dismissed' AND j.state='pending';
END; $$;
REVOKE ALL ON FUNCTION public.cancel_unconsented_family_reminders(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_unconsented_family_reminders(uuid) TO service_role;

CREATE FUNCTION public.guard_family_reminder_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE subject uuid;
BEGIN
  subject:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  PERFORM public.cancel_unconsented_family_reminders(subject);
  RETURN NULL;
END; $$;
CREATE TRIGGER family_reminder_consent_guard AFTER INSERT OR UPDATE OR DELETE ON public.family_sharing
  FOR EACH ROW EXECUTE FUNCTION public.guard_family_reminder_consent();
REVOKE ALL ON FUNCTION public.guard_family_reminder_consent() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.close_removed_family_connection() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.family_invitations SET status='revoked'
    WHERE family_id=OLD.family_id AND recipient_id=OLD.user_id AND status='active';
  PERFORM public.cancel_unconsented_family_reminders(OLD.user_id);
  RETURN OLD;
END; $$;
CREATE TRIGGER removed_family_connection AFTER DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.close_removed_family_connection();
REVOKE ALL ON FUNCTION public.close_removed_family_connection() FROM PUBLIC,anon,authenticated;

-- Preserve historical records, while leaving sharing off for existing members.
SELECT public.cancel_unconsented_family_reminders(for_user_id) FROM public.reminders
  WHERE created_by<>for_user_id GROUP BY for_user_id;
COMMIT;
