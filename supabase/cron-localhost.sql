-- ===========================================================================
-- Reschedule pg_cron jobs to hit YOUR app via a public tunnel (local dev).
-- ===========================================================================
-- Supabase's cloud pg_cron/pg_net cannot reach http://localhost, so the
-- scheduled jobs must call a publicly reachable tunnel that forwards to your
-- dev server (e.g. `ngrok http 8080`).
--
-- HOW TO USE:
--   1. Start `pnpm dev` and your tunnel; copy the https tunnel host.
--   2. Replace <TUNNEL_HOST> with your tunnel hostname (no scheme).
--      Store a random private secret in Vault as someonenear_cron_hook_secret
--      and set the SAME value in the dev server's CRON_HOOK_SECRET.
--   3. Run this whole file in the Supabase SQL editor.
--   4. Re-run it whenever your tunnel host changes (ngrok free rotates hosts).
--
-- Jobs: send-later (*/5), calendar-sync (*/15), call-sla (*/5), family-reminders (*).
-- WhatsApp-reminders is intentionally NOT scheduled (simulation only).
-- ===========================================================================

-- --- send-later: deliver scheduled messages (every 5 min) ------------------
SELECT cron.unschedule('someonenear-send-later-delivery')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-send-later-delivery');

SELECT cron.schedule(
  'someonenear-send-later-delivery',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<TUNNEL_HOST>/api/public/hooks/send-later',
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
    url := 'https://<TUNNEL_HOST>/api/public/hooks/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'someonenear_cron_hook_secret')
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- --- call-sla: SLA ladder warnings/escalations (every 5 min) ----------------
-- (No prior cron migration existed for this; the hook route already exists.)
SELECT cron.unschedule('someonenear-call-sla')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-call-sla');

SELECT cron.schedule(
  'someonenear-call-sla',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<TUNNEL_HOST>/api/public/hooks/call-sla',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'someonenear_cron_hook_secret')
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- --- family reminders (every minute) --------------------------------------
SELECT cron.unschedule('someonenear-family-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-family-reminders');
SELECT cron.schedule('someonenear-family-reminders', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://<TUNNEL_HOST>/api/public/hooks/family-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='someonenear_cron_hook_secret')),
    body := '{"source":"cron"}'::jsonb
  );
$$);

-- Verify what's scheduled:
SELECT jobname, schedule FROM cron.job ORDER BY jobname;
