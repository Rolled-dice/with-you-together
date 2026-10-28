BEGIN;
CREATE TABLE public.call_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id uuid NOT NULL REFERENCES auth.users(id),
  product_id text NOT NULL, currency text NOT NULL CHECK(currency IN ('INR','USD')),
  amount integer NOT NULL CHECK(amount>0), environment text NOT NULL CHECK(environment IN ('test','live')),
  expires_at timestamptz NOT NULL, payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','review')),
  used integer NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 1), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.call_reservations (
  booking_id uuid PRIMARY KEY REFERENCES public.listener_bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id), payer_id uuid NOT NULL REFERENCES auth.users(id),
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  credit_order_id uuid REFERENCES public.call_credit_orders(id),
  released_at timestamptz
);
ALTER TABLE public.call_credit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_credit_orders,public.call_reservations FROM anon,authenticated;
GRANT SELECT ON public.call_credit_orders,public.call_reservations TO authenticated;
GRANT ALL ON public.call_credit_orders,public.call_reservations TO service_role;
CREATE POLICY "Read own call purchases" ON public.call_credit_orders FOR SELECT TO authenticated USING(payer_id=auth.uid());
CREATE POLICY "Read own call reservations" ON public.call_reservations FOR SELECT TO authenticated USING(user_id=auth.uid() OR payer_id=auth.uid());
REVOKE INSERT,UPDATE,DELETE ON public.family_session_pool,public.family_session_allocations FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.solo_session_usage FROM authenticated;
REVOKE DELETE ON public.listener_bookings FROM authenticated;

CREATE OR REPLACE FUNCTION public.reserve_booking_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  family uuid; payer uuid; tier text; period date:=date_trunc('month',now() AT TIME ZONE 'UTC')::date;
  total integer; allocated integer; used integer; mine integer; mine_used integer; shared_used integer;
  res_limit integer; res_used integer; order_row public.call_credit_orders%ROWTYPE; reservation public.call_reservations%ROWTYPE;
BEGIN
  SELECT m.family_id,f.owner_id INTO family,payer FROM public.family_members m JOIN public.families f ON f.id=m.family_id WHERE m.user_id=NEW.user_id;
  payer:=COALESCE(payer,NEW.user_id);
  IF TG_OP='UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN RAISE EXCEPTION 'Booking ownership and duration cannot change.'; END IF;
    SELECT * INTO reservation FROM public.call_reservations WHERE booking_id=NEW.id;
    payer:=COALESCE(reservation.payer_id,payer);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('call-credit:'||payer::text,0));
  SELECT care_tier INTO tier FROM public.profiles WHERE id=payer;
  total:=CASE tier WHEN 'care_plus' THEN 30 WHEN 'care' THEN 18 ELSE 0 END;
  res_limit:=CASE tier WHEN 'care_plus' THEN 20 WHEN 'care' THEN 12 ELSE 0 END;
  IF TG_OP='INSERT' THEN
    IF NEW.duration_minutes<>15 THEN RAISE EXCEPTION 'Each call session is 15 minutes.'; END IF;
    IF NEW.requested_at<now()+interval '2 hours' AND COALESCE(NEW.note,'') NOT LIKE '[EMERGENCY_CALLBACK]%' THEN RAISE EXCEPTION 'Book at least two hours ahead.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND phone IS NOT NULL AND phone_verified) THEN RAISE EXCEPTION 'Verify your phone number before booking.'; END IF;
    IF EXISTS (SELECT 1 FROM public.listener_bookings WHERE id<>NEW.id AND user_id=NEW.user_id AND requested_at=NEW.requested_at AND status IN ('requested','confirmed')) THEN RAISE EXCEPTION 'You already have a booking at this time.'; END IF;
    IF family IS NULL THEN
      INSERT INTO public.solo_session_usage(user_id,period_start) VALUES(NEW.user_id,period) ON CONFLICT DO NOTHING;
      SELECT sessions_used,reschedules_used INTO used,res_used FROM public.solo_session_usage WHERE user_id=NEW.user_id AND period_start=period FOR UPDATE;
      mine:=total; mine_used:=used; allocated:=total; shared_used:=0;
    ELSE
      INSERT INTO public.family_session_pool(family_id,period_start,total_sessions,reschedules_total) VALUES(family,period,total,res_limit) ON CONFLICT DO NOTHING;
      SELECT COALESCE(sum(a.used),0),COALESCE(sum(a.allocated),0),COALESCE(sum(greatest(a.used-a.allocated,0)),0),
        COALESCE(max(a.allocated) FILTER(WHERE a.member_user_id=NEW.user_id),0),COALESCE(max(a.used) FILTER(WHERE a.member_user_id=NEW.user_id),0)
        INTO used,allocated,shared_used,mine,mine_used FROM public.family_session_allocations a WHERE a.family_id=family AND a.period_start=period;
    END IF;
    IF least(total-used,greatest(mine-mine_used,0)+greatest(total-allocated-shared_used,0))>0 THEN
      IF family IS NULL THEN UPDATE public.solo_session_usage SET sessions_used=sessions_used+1 WHERE user_id=NEW.user_id AND period_start=period;
      ELSE INSERT INTO public.family_session_allocations(family_id,member_user_id,period_start,allocated,used) VALUES(family,NEW.user_id,period,0,1)
        ON CONFLICT(family_id,member_user_id,period_start) DO UPDATE SET used=family_session_allocations.used+1;
      END IF;
    ELSE
      SELECT * INTO order_row FROM public.call_credit_orders purchase WHERE payer_id=payer AND status='paid' AND purchase.used=0
        AND expires_at>now() AND expires_at>=NEW.requested_at+interval '15 minutes' ORDER BY expires_at,created_at LIMIT 1 FOR UPDATE;
      IF order_row.id IS NULL THEN RAISE EXCEPTION 'No call sessions are available for this time.'; END IF;
      UPDATE public.call_credit_orders SET used=1 WHERE id=order_row.id;
    END IF;
    INSERT INTO public.call_reservations(booking_id,user_id,payer_id,family_id,period_start,credit_order_id)
      VALUES(NEW.id,NEW.user_id,payer,family,period,order_row.id);
  ELSE
    SELECT * INTO reservation FROM public.call_reservations WHERE booking_id=NEW.id FOR UPDATE;
    IF NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
      IF EXISTS(SELECT 1 FROM public.listener_bookings WHERE id<>NEW.id AND user_id=NEW.user_id AND requested_at=NEW.requested_at AND status IN('requested','confirmed')) THEN RAISE EXCEPTION 'You already have a booking at this time.'; END IF;
      IF OLD.status NOT IN ('requested','confirmed') OR OLD.requested_at<now()+interval '2 hours' OR NEW.requested_at<now()+interval '2 hours' THEN RAISE EXCEPTION 'Reschedule at least two hours before both call times.'; END IF;
      IF reservation.credit_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.call_credit_orders WHERE id=reservation.credit_order_id AND expires_at>=NEW.requested_at+interval '15 minutes' AND expires_at>now()) THEN RAISE EXCEPTION 'This purchased session expires before the new call time.'; END IF;
      IF family IS NULL THEN
        INSERT INTO public.solo_session_usage(user_id,period_start) VALUES(NEW.user_id,period) ON CONFLICT DO NOTHING;
        UPDATE public.solo_session_usage SET reschedules_used=reschedules_used+1 WHERE user_id=NEW.user_id AND period_start=period AND reschedules_used<res_limit;
      ELSE
        INSERT INTO public.family_session_pool(family_id,period_start,total_sessions,reschedules_total) VALUES(family,period,total,res_limit) ON CONFLICT DO NOTHING;
        UPDATE public.family_session_pool SET reschedules_used=reschedules_used+1 WHERE family_id=family AND period_start=period AND reschedules_used<res_limit;
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'Your reschedule allowance is used up.'; END IF;
    END IF;
    IF NEW.status='cancelled' AND OLD.status IN ('requested','confirmed') AND reservation.booking_id IS NOT NULL AND reservation.released_at IS NULL AND OLD.requested_at>=now()+interval '2 hours' THEN
      IF reservation.credit_order_id IS NOT NULL THEN UPDATE public.call_credit_orders SET used=0 WHERE id=reservation.credit_order_id;
      ELSIF reservation.family_id IS NOT NULL THEN UPDATE public.family_session_allocations a SET used=greatest(a.used-1,0) WHERE a.family_id=reservation.family_id AND a.member_user_id=reservation.user_id AND a.period_start=reservation.period_start;
      ELSE UPDATE public.solo_session_usage SET sessions_used=greatest(sessions_used-1,0) WHERE user_id=reservation.user_id AND period_start=reservation.period_start;
      END IF;
      UPDATE public.call_reservations SET released_at=now() WHERE booking_id=NEW.id;
    END IF;
    IF OLD.status='cancelled' AND NEW.status<>'cancelled' THEN RAISE EXCEPTION 'Cancelled bookings cannot be reopened.'; END IF;
  END IF;
  RETURN NEW;
END; $$;
-- AFTER keeps the reservation FK valid; exceptions roll the booking back too.
CREATE TRIGGER listener_booking_credit AFTER INSERT OR UPDATE ON public.listener_bookings FOR EACH ROW EXECUTE FUNCTION public.reserve_booking_credit();
REVOKE ALL ON FUNCTION public.reserve_booking_credit() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.call_credit_command(p_actor uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payer uuid; family uuid; ending timestamptz; ord public.call_credit_orders%ROWTYPE; item jsonb; total integer; period date:=date_trunc('month',now() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT m.family_id,f.owner_id INTO family,payer FROM public.family_members m JOIN public.families f ON f.id=m.family_id WHERE m.user_id=p_actor;
  payer:=COALESCE(payer,p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended('call-credit:'||payer::text,0));
  IF p_action='pool' THEN
    IF family IS NULL THEN RETURN 'null'::jsonb; END IF;
    SELECT CASE care_tier WHEN 'care_plus' THEN 30 WHEN 'care' THEN 18 ELSE 0 END INTO total FROM public.profiles WHERE id=payer;
    RETURN jsonb_build_object('familyId',family,'role',(SELECT role FROM public.family_members WHERE user_id=p_actor),
      'totalSessions',total,'totalUsed',(SELECT COALESCE(sum(used),0) FROM public.family_session_allocations WHERE family_id=family AND period_start=period),
      'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',COALESCE(p.display_name,'Family member'),
        'allocated',COALESCE(a.allocated,0),'used',COALESCE(a.used,0))) FROM public.family_members m JOIN public.profiles p ON p.id=m.user_id
        LEFT JOIN public.family_session_allocations a ON a.family_id=m.family_id AND a.member_user_id=m.user_id AND a.period_start=period WHERE m.family_id=family),'[]'::jsonb));
  END IF;
  IF p_action='balance' THEN RETURN jsonb_build_object('can_buy',payer=p_actor,'available',
    (SELECT count(*) FROM public.call_credit_orders WHERE payer_id=payer AND status='paid' AND used=0 AND expires_at>now()),
    'expires_at',(SELECT min(expires_at) FROM public.call_credit_orders WHERE payer_id=payer AND status='paid' AND used=0 AND expires_at>now()),
    'purchase_expires_at',(SELECT max(current_period_end) FROM public.subscriptions WHERE user_id=payer AND status IN ('active','trialing') AND current_period_end>now()+interval '135 minutes'));
  ELSIF p_action='allocate' THEN
    IF family IS NULL OR payer<>p_actor THEN RAISE EXCEPTION 'Only the family owner can allocate calls.'; END IF;
    SELECT CASE care_tier WHEN 'care_plus' THEN 30 WHEN 'care' THEN 18 ELSE 0 END INTO total FROM public.profiles WHERE id=payer;
    IF (SELECT COALESCE(sum((x->>'allocated')::integer),0) FROM jsonb_array_elements(p_data->'allocations') x)>total THEN RAISE EXCEPTION 'Allocations exceed your monthly calls.'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_data->'allocations')) <> (SELECT count(DISTINCT x->>'member_user_id') FROM jsonb_array_elements(p_data->'allocations') x) THEN RAISE EXCEPTION 'Each member must appear once.'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_data->'allocations')) <> (SELECT count(*) FROM public.family_members WHERE family_id=family) THEN RAISE EXCEPTION 'Refresh the family list and try again.'; END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(p_data->'allocations') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.family_members WHERE family_id=family AND user_id=(item->>'member_user_id')::uuid) OR (item->>'allocated')::integer<0 THEN RAISE EXCEPTION 'Invalid member allocation.'; END IF;
      IF (item->>'allocated')::integer < COALESCE((SELECT used FROM public.family_session_allocations WHERE family_id=family AND member_user_id=(item->>'member_user_id')::uuid AND period_start=period),0) THEN RAISE EXCEPTION 'Allocations cannot be lower than calls already used.'; END IF;
      INSERT INTO public.family_session_allocations(family_id,member_user_id,period_start,allocated) VALUES(family,(item->>'member_user_id')::uuid,period,(item->>'allocated')::integer)
      ON CONFLICT(family_id,member_user_id,period_start) DO UPDATE SET allocated=excluded.allocated;
    END LOOP;
    RETURN '{"ok":true}';
  ELSIF p_action='order' THEN
    IF payer<>p_actor THEN RAISE EXCEPTION 'Ask your family owner to purchase extra calls.'; END IF;
    SELECT current_period_end INTO ending FROM public.subscriptions WHERE user_id=payer AND status IN ('active','trialing') AND current_period_end>now()+interval '135 minutes' ORDER BY current_period_end DESC LIMIT 1;
    IF ending IS NULL THEN RAISE EXCEPTION 'An active billing period with time to book a call is required.'; END IF;
    IF p_data->>'expected_expires_at' IS NOT NULL AND ending<>(p_data->>'expected_expires_at')::timestamptz THEN RAISE EXCEPTION 'Your billing period changed. Refresh to review the new expiry.'; END IF;
    INSERT INTO public.call_credit_orders(payer_id,product_id,currency,amount,environment,expires_at)
      VALUES(payer,p_data->>'product_id',p_data->>'currency',(p_data->>'amount')::integer,p_data->>'environment',ending) RETURNING * INTO ord;
    RETURN to_jsonb(ord);
  ELSIF p_action='payment' THEN
    SELECT * INTO ord FROM public.call_credit_orders WHERE id=(p_data->>'order_id')::uuid AND payer_id=p_actor FOR UPDATE;
    IF ord.id IS NULL OR ord.product_id<>p_data->>'product_id' OR ord.environment<>p_data->>'environment' OR ord.currency<>p_data->>'currency' OR (p_data->>'amount')::integer<ord.amount THEN RAISE EXCEPTION 'Call purchase does not match the payment.'; END IF;
    IF ord.payment_id IS NOT NULL THEN
      IF ord.payment_id<>p_data->>'payment_id' THEN RAISE EXCEPTION 'This order has already been paid.'; END IF;
      RETURN '{"ok":true}';
    END IF;
    UPDATE public.call_credit_orders SET payment_id=p_data->>'payment_id',status=CASE WHEN expires_at<=now() THEN 'review' ELSE 'paid' END WHERE id=ord.id;
    RETURN '{"ok":true}';
  END IF;
  RAISE EXCEPTION 'Unsupported call-credit action.';
END; $$;
REVOKE ALL ON FUNCTION public.call_credit_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.call_credit_command(uuid,text,jsonb) TO service_role;
COMMIT;
