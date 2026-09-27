-- Enable pg_cron + pg_net so the cron scheduling migrations that follow can call
-- cron.schedule / cron.unschedule / net.http_post.
--
-- On Lovable Cloud these extensions were enabled from the dashboard, so no
-- migration created them. Replaying migrations into a fresh self-owned project
-- would otherwise fail at the first `cron.unschedule(...)` call. This migration
-- makes the schema self-contained.
--
-- Supabase provisions these into the `extensions` schema but exposes the
-- `cron` and `net` schemas/functions once the extensions are installed.

create extension if not exists pg_cron;
create extension if not exists pg_net;
