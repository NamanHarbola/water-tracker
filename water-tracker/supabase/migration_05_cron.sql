-- Run this in the Supabase SQL editor AFTER deploying the send-reminders
-- edge function (see README "Real push notifications").
--
-- This schedules that function to run every 15 minutes using pg_cron +
-- pg_net, both of which are available on Supabase's free tier — no extra
-- paid service or separate server needed.
--
-- Before running, replace the two placeholders below:
--   YOUR_PROJECT_REF  — from your Supabase project URL, e.g. abcxyzproj
--   YOUR_ANON_KEY     — Project Settings -> API -> anon/public key
-- (the function itself uses the service-role key internally to read/write
-- data; the anon key here is only used for the HTTP call's auth header,
-- same as any other edge function invocation.)

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'send-water-reminders',
    '*/15 * * * *',
    $$
    select net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_ANON_KEY'
      ),
      body := '{}'::jsonb
    );
    $$
  );

-- To check it's running:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
-- To remove it:
--   select cron.unschedule('send-water-reminders');
