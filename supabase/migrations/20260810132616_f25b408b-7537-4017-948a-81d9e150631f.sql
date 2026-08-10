SELECT cron.unschedule('besideu-whatsapp-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'besideu-whatsapp-reminders');

SELECT cron.schedule(
  'besideu-whatsapp-reminders',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--7a70b00d-f5ae-4cf2-bb4f-e21f807b83ec-dev.lovable.app/api/public/hooks/whatsapp-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_rtw5k5fXg1zmQxTozGKFkA_eTvls6Ge"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);