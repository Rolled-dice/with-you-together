-- Enable pgcrypto so later migrations can use gen_random_bytes()/digest()/etc.
-- (e.g. invitation-token defaults like encode(gen_random_bytes(24), 'hex')).
--
-- On Lovable Cloud this extension was enabled from the dashboard, so no
-- migration created it. Replaying into a fresh self-owned project would fail
-- with "function gen_random_bytes(integer) does not exist".
--
-- Install into the standard `extensions` schema (NOT public — installing into
-- public makes `db reset` unable to drop the public schema later). To let the
-- unqualified gen_random_bytes(...) calls in later migrations resolve, we add
-- the `extensions` schema to the database + role search_path below.

create extension if not exists pgcrypto with schema extensions;

-- Make extensions functions resolvable from unqualified calls in this and
-- future sessions (migration runner uses the postgres role).
do $$
declare
  db text := current_database();
begin
  execute format('alter database %I set search_path to "$user", public, extensions', db);
end $$;

alter role postgres set search_path to "$user", public, extensions;

-- Also set it for the current session so the very next migration in this same
-- connection can resolve gen_random_bytes without reconnecting.
set search_path to "$user", public, extensions;
