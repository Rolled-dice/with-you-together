CREATE OR REPLACE FUNCTION public.is_call_agent(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.call_agents
    WHERE user_id = _uid AND is_active = true
  )
$$;

CREATE POLICY "Agents can view their own roster row"
ON public.call_agents FOR SELECT TO authenticated
USING (user_id = auth.uid());