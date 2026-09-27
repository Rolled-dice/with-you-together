-- Ensure pgcrypto lives in the `extensions` schema (never `public`).
--
-- An earlier iteration of this migration moved pgcrypto into `public`, which
-- then blocked `supabase db reset` ("cannot drop function digest ... because
-- extension pgcrypto requires it"). This migration repairs that: if pgcrypto is
-- in public, move it back to extensions. Idempotent.

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'public'
  ) then
    execute 'alter extension pgcrypto set schema extensions';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    execute 'create extension pgcrypto with schema extensions';
  end if;
end
$$;
