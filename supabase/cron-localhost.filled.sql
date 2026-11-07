-- ===========================================================================
-- READY-TO-RUN cron reschedule for the current cloudflared tunnel.
-- Paste this whole file into the Supabase SQL editor (project jflufaxdwzrohslviqeb).
--
-- Tunnel host: diamond-cleanup-east-hereby.trycloudflare.com  (localhost:8080)
-- NOTE: cloudflared quick-tunnel hosts change every time you restart the tunnel.
-- If you restart it, re-generate this file (ask Kiro) and re-run.
--
-- IMPORTANT: the apikey below is SUPABASE_ANON_KEY (the legacy JWT), because the
-- hook routes check the incoming apikey against SUPABASE_ANON_KEY first
-- (?? SUPABASE_PUBLISHABLE_KEY). Using the publishable key here would 401.
--
-- Jobs: send-later (*/5), calendar-sync (*/15), call-sla (*/5).
-- whatsapp-reminders intentionally NOT scheduled (simulation only).
-- ===========================================================================

-- send-later: deliver scheduled messages (every 5 min)
SELECT cron.unschedule('someonenear-send-later-delivery')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-send-later-delivery');
SELECT cron.schedule(
  'someonenear-send-later-delivery',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://diamond-cleanup-east-hereby.trycloudflare.com/api/public/hooks/send-later',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmbHVmYXhkd3pyb2hzbHZpcWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjg5NjUsImV4cCI6MjEwNTc0NDk2NX0.t6abrXQf40GgtkI3n7g_kQ5TkXCLfqMujjPAvAJbcX8"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- calendar-sync: reconcile 7-day window into Google Calendar (every 15 min)
SELECT cron.unschedule('someonenear-calendar-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-calendar-sync');
SELECT cron.schedule(
  'someonenear-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://diamond-cleanup-east-hereby.trycloudflare.com/api/public/hooks/calendar-sync',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmbHVmYXhkd3pyb2hzbHZpcWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjg5NjUsImV4cCI6MjEwNTc0NDk2NX0.t6abrXQf40GgtkI3n7g_kQ5TkXCLfqMujjPAvAJbcX8"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- call-sla: SLA ladder warnings/escalations (every 5 min)
SELECT cron.unschedule('someonenear-call-sla')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-call-sla');
SELECT cron.schedule(
  'someonenear-call-sla',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://diamond-cleanup-east-hereby.trycloudflare.com/api/public/hooks/call-sla',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmbHVmYXhkd3pyb2hzbHZpcWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjg5NjUsImV4cCI6MjEwNTc0NDk2NX0.t6abrXQf40GgtkI3n7g_kQ5TkXCLfqMujjPAvAJbcX8"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Verify:
SELECT jobname, schedule FROM cron.job ORDER BY jobname;
