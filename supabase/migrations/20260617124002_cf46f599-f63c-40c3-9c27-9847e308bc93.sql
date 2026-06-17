CREATE TABLE public.trend_radar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  angle text,
  counter_take text,
  source_url text,
  source_type text NOT NULL DEFAULT 'search',
  pillar text,
  heat_score int NOT NULL DEFAULT 5,
  used_in_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trend_radar TO authenticated;
GRANT ALL ON public.trend_radar TO service_role;
ALTER TABLE public.trend_radar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to trend_radar" ON public.trend_radar
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX trend_radar_expires_idx ON public.trend_radar(expires_at DESC);
CREATE INDEX trend_radar_pillar_idx ON public.trend_radar(pillar, created_at DESC);

ALTER TABLE public.ceo_context
  ADD COLUMN IF NOT EXISTS competitor_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trend_keywords text[] NOT NULL DEFAULT ARRAY['AI agents enterprise','executive AI training','LLM operator playbooks']::text[];