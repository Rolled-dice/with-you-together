-- Run after 20261106090000_family_invitation_verified_phone_claim.sql.
-- This checks that the privileged claim/call RPCs retain their trust boundary
-- and that phone-based linking requires a verified Supabase Auth phone.
DO $$
DECLARE
  record_call regprocedure := to_regprocedure(
    'public.record_family_invitation_call(uuid,uuid,text,boolean,text)'
  );
  claim_invitation regprocedure := to_regprocedure(
    'public.claim_approved_family_invitation(text,uuid)'
  );
  record_definition text;
  claim_definition text;
BEGIN
  IF record_call IS NULL OR claim_invitation IS NULL THEN
    RAISE EXCEPTION 'Family invitation verification RPCs are missing';
  END IF;

  record_definition := pg_get_functiondef(record_call);
  claim_definition := pg_get_functiondef(claim_invitation);
  IF position('phone_confirmed_at' IN record_definition) = 0
    OR position('inv.call_phone' IN record_definition) = 0 THEN
    RAISE EXCEPTION 'Call approval does not require a verified phone match';
  END IF;
  IF position('phone_confirmed_at' IN claim_definition) = 0
    OR position('inv.call_phone' IN claim_definition) = 0 THEN
    RAISE EXCEPTION 'Invitation claim does not verify the invited phone';
  END IF;

  IF has_function_privilege('anon', record_call, 'EXECUTE')
    OR has_function_privilege('authenticated', record_call, 'EXECUTE')
    OR has_function_privilege('anon', claim_invitation, 'EXECUTE')
    OR has_function_privilege('authenticated', claim_invitation, 'EXECUTE') THEN
    RAISE EXCEPTION 'Browser roles must not execute family invitation RPCs';
  END IF;
  IF NOT has_function_privilege('service_role', record_call, 'EXECUTE')
    OR NOT has_function_privilege('service_role', claim_invitation, 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role must retain family invitation RPC execution';
  END IF;
END;
$$;
