
DO $$
BEGIN
  PERFORM cron.unschedule('collect-reddit-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('collect-arxiv-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('collect-competitors-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-brief-sunday');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'collect-reddit-daily',
  '30 5 * * *',
  $$
  SELECT net.http_post(
    url:='https://flegocstyduybkueffjq.supabase.co/functions/v1/collect-reddit',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWdvY3N0eWR1eWJrdWVmZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYyMjUsImV4cCI6MjA4OTQ5MjIyNX0.h0ay-8cCtYJEjPJxa88oPLT4tyib7UVaPy0fceMyI1w"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'collect-arxiv-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://flegocstyduybkueffjq.supabase.co/functions/v1/collect-arxiv',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWdvY3N0eWR1eWJrdWVmZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYyMjUsImV4cCI6MjA4OTQ5MjIyNX0.h0ay-8cCtYJEjPJxa88oPLT4tyib7UVaPy0fceMyI1w"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'collect-competitors-daily',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://flegocstyduybkueffjq.supabase.co/functions/v1/collect-competitors',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWdvY3N0eWR1eWJrdWVmZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYyMjUsImV4cCI6MjA4OTQ5MjIyNX0.h0ay-8cCtYJEjPJxa88oPLT4tyib7UVaPy0fceMyI1w"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'weekly-brief-sunday',
  '0 21 * * 0',
  $$
  SELECT net.http_post(
    url:='https://flegocstyduybkueffjq.supabase.co/functions/v1/weekly-brief',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWdvY3N0eWR1eWJrdWVmZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYyMjUsImV4cCI6MjA4OTQ5MjIyNX0.h0ay-8cCtYJEjPJxa88oPLT4tyib7UVaPy0fceMyI1w"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);
