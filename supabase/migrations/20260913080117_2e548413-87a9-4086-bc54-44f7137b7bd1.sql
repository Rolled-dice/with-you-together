-- lovable-cron-fallback-reviewed: 288 runs/day; scheduled messages must be delivered at their user-chosen moment, so a 5-minute sweep keeps delivery within ~5 minutes of the promised time
SELECT cron.schedule(
  'someonenear-send-later-delivery',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--7a70b00d-f5ae-4cf2-bb4f-e21f807b83ec-dev.lovable.app/api/public/hooks/send-later',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_rtw5k5fXg1zmQxTozGKFkA_eTvls6Ge"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);