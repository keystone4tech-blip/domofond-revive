
ALTER TABLE public.news_automation_settings 
  ADD COLUMN IF NOT EXISTS schedule_time TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  ADD COLUMN IF NOT EXISTS auto_publish_without_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freshness_days INTEGER NOT NULL DEFAULT 30;

-- Снимаем старый ежедневный cron (если есть) и ставим почасовой; функция сама решит запускать ли по schedule_time/schedule_days
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'news-auto-generate-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'news-auto-generate-hourly';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'news-auto-generate-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jjaeybwuhnokrcprgait.supabase.co/functions/v1/news-generate',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('triggered_by','cron')
  ) AS request_id;
  $$
);
