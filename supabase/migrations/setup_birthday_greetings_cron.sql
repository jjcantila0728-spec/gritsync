-- Setup Cron Job for Birthday Greetings
-- This cron job runs daily at 9:00 AM UTC to send birthday greetings

-- First, ensure the pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists
SELECT cron.unschedule('send-birthday-greetings') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-birthday-greetings'
);

-- Create the cron job
-- Note: Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- Note: The service_role_key should be set as a database setting or use environment variable
SELECT cron.schedule(
  'send-birthday-greetings',
  '0 9 * * *', -- Run daily at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-birthday-greetings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Alternative: If you prefer to use a direct URL (replace with your project ref)
-- SELECT cron.schedule(
--   'send-birthday-greetings',
--   '0 9 * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-birthday-greetings',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--       ),
--       body := '{}'::jsonb
--     ) AS request_id;
--   $$
-- );

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-greetings';
