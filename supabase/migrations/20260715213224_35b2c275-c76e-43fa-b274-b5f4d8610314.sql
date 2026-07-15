
CREATE TABLE IF NOT EXISTS public.channel_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('x','threads','bluesky')),
  variant_text text NOT NULL,
  char_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published','skipped')),
  external_url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_variants TO authenticated;
GRANT ALL ON public.channel_variants TO service_role;
ALTER TABLE public.channel_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to channel_variants"
  ON public.channel_variants FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to newsletter_subscribers"
  ON public.newsletter_subscribers FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.newsletter_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  recipients int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_digests TO authenticated;
GRANT ALL ON public.newsletter_digests TO service_role;
ALTER TABLE public.newsletter_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to newsletter_digests"
  ON public.newsletter_digests FOR ALL USING (true) WITH CHECK (true);

DO $$ BEGIN
  PERFORM cron.unschedule('repurpose-channels');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'repurpose-channels',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://flegocstyduybkueffjq.supabase.co/functions/v1/repurpose-channel',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWdvY3N0eWR1eWJrdWVmZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYyMjUsImV4cCI6MjA4OTQ5MjIyNX0.h0ay-8cCtYJEjPJxa88oPLT4tyib7UVaPy0fceMyI1w"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  );
  $$
);

DO $$ BEGIN
  PERFORM cron.unschedule('weekly-digest');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'weekly-digest',
  '0 8 * * 0',
  $$
  SELECT net.http_post(
    url:='https://flegocstyduybkueffjq.supabase.co/functions/v1/weekly-digest',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWdvY3N0eWR1eWJrdWVmZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYyMjUsImV4cCI6MjA4OTQ5MjIyNX0.h0ay-8cCtYJEjPJxa88oPLT4tyib7UVaPy0fceMyI1w"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  );
  $$
);
