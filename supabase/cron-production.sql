-- ===========================================================================
-- Reschedule pg_cron jobs to hit PRODUCTION (https://www.someonenear.com).
-- ===========================================================================
-- Production replacement for cron-localhost.sql: the jobs call the live
-- Cloudflare Worker instead of a dev tunnel. Run this in the Supabase SQL
-- editor for the project that backs production.
--
-- HOW TO USE:
--   1. Store a random private secret in Supabase Vault named
--      someonenear_cron_hook_secret and configure the SAME value as the
--      Worker secret CRON_HOOK_SECRET. Never use a publishable/anon key.
--   2. Run this whole file once. It is idempotent (unschedule-then-schedule),
--      so re-running it is safe and simply refreshes the jobs.
--
-- Host is fixed to www.someonenear.com (no tunnel, no trailing slash).
-- Jobs: send-later (*/5), calendar-sync (*/15), call-sla (*/5), family-reminders (*).
-- WhatsApp-reminders is intentionally NOT scheduled (simulation only) — add it
-- below only once a real WhatsApp provider is configured.
-- ===========================================================================

-- --- send-later: deliver scheduled messages (every 5 min) ------------------
SELECT cron.unschedule('someonenear-send-later-delivery')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-send-later-delivery');

SELECT cron.schedule(
  'someonenear-send-later-delivery',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.someonenear.com/api/public/hooks/send-later',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'someonenear_cron_hook_secret')
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- --- calendar-sync: reconcile 7-day window into Google Calendar (every 15 min)
SELECT cron.unschedule('someonenear-calendar-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-calendar-sync');

SELECT cron.schedule(
  'someonenear-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.someonenear.com/api/public/hooks/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'someonenear_cron_hook_secret')
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- --- call-sla: SLA ladder warnings/escalations (every 5 min) ----------------
SELECT cron.unschedule('someonenear-call-sla')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-call-sla');

SELECT cron.schedule(
  'someonenear-call-sla',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.someonenear.com/api/public/hooks/call-sla',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'someonenear_cron_hook_secret')
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- --- medication reminders (every 10 min) — OPTIONAL --------------------------
-- Uncomment once a real WhatsApp provider (Twilio/Plivo) is configured; until
-- then the outbox drains in simulation only and this just adds noise.
-- SELECT cron.unschedule('someonenear-whatsapp-reminders')
-- WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-whatsapp-reminders');
--
-- SELECT cron.schedule(
--   'someonenear-whatsapp-reminders',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://www.someonenear.com/api/public/hooks/whatsapp-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'someonenear_cron_hook_secret')
--     ),
--     body := '{"source": "cron"}'::jsonb
--   );
--   $$
-- );

-- --- family reminder inbox + background delivery (every minute) ------------
SELECT cron.unschedule('someonenear-family-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-family-reminders');
SELECT cron.schedule('someonenear-family-reminders', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://www.someonenear.com/api/public/hooks/family-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='someonenear_cron_hook_secret')),
    body := '{"source":"cron"}'::jsonb
  );
$$);

-- Verify what's scheduled:
SELECT jobname, schedule FROM cron.job ORDER BY jobname;
