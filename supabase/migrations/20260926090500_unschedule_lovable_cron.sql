-- Detach cron from the old Lovable preview origin.
--
-- The earlier cron migrations (20260810132616, 20260913080117, 20260916120500)
-- scheduled pg_cron jobs whose net.http_post targets a hardcoded Lovable dev
-- preview URL and an inline Lovable publishable apikey. On a self-owned project
-- those calls would fire at a dead/foreign origin, so we unschedule them here.
--
-- Reschedule them to point at YOUR reachable app origin (a public tunnel in
-- local dev) using supabase/cron-localhost.sql, which parameterizes the tunnel
-- host and your project's publishable/anon key. The WhatsApp-reminders job stays
-- unscheduled on purpose (WhatsApp remains in simulation for now).

SELECT cron.unschedule('besideu-whatsapp-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'besideu-whatsapp-reminders');

SELECT cron.unschedule('someonenear-send-later-delivery')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-send-later-delivery');

SELECT cron.unschedule('someonenear-calendar-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-calendar-sync');

SELECT cron.unschedule('someonenear-call-sla')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-call-sla');
