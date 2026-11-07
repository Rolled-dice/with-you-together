-- Every 15 minutes: reconcile the rolling 7-day window into connected Google Calendars.
-- lovable-cron-fallback-reviewed: 96 runs/day; a 15-minute sweep keeps calendar events
-- within ~15 minutes of any reminder/med change that the on-write path missed.

-- Unschedule any prior version of this job so re-running the migration is idempotent.
SELECT cron.unschedule('someonenear-calendar-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'someonenear-calendar-sync');

SELECT cron.schedule(
  'someonenear-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--7a70b00d-f5ae-4cf2-bb4f-e21f807b83ec-dev.lovable.app/api/public/hooks/calendar-sync',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_rtw5k5fXg1zmQxTozGKFkA_eTvls6Ge"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);
