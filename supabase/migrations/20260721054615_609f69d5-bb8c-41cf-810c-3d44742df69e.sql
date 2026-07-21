
-- 1) Remove privilege-escalation-prone INSERT policy on family_members.
--    Family membership creation goes through server functions using the
--    service role (createFamily / acceptFamilyInvite), which bypasses RLS.
DROP POLICY IF EXISTS "owner inserts self" ON public.family_members;

-- 2) Replace overly permissive INSERT WITH CHECK (true) on feedback_submissions
--    with a rule that ties the row to the caller when authenticated.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback_submissions;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
);

-- 3) Drop redundant always-true policy on stripe_webhook_events; the
--    service_role bypasses RLS, so the policy adds no protection and trips
--    the "policy always true" linter.
DROP POLICY IF EXISTS "Service role manages webhook events" ON public.stripe_webhook_events;

-- 4) Restrict SECURITY DEFINER helper that signed-in users don't need to call
--    directly. `has_active_subscription` is only consumed server-side.
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;
