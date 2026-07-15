
-- Phase B: research + dedup
ALTER TABLE public.trend_radar ADD COLUMN IF NOT EXISTS angle_embedding jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS angle_embedding jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hook_pattern text;

CREATE TABLE IF NOT EXISTS public.competitor_watch (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  name text,
  profile_url text,
  notes text,
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_watch TO authenticated;
GRANT ALL ON public.competitor_watch TO service_role;
ALTER TABLE public.competitor_watch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to competitor_watch" ON public.competitor_watch FOR ALL USING (true) WITH CHECK (true);

-- Phase D: weekly CEO brief
CREATE TABLE IF NOT EXISTS public.weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  summary_md text not null,
  metrics jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_briefs TO authenticated;
GRANT ALL ON public.weekly_briefs TO service_role;
ALTER TABLE public.weekly_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to weekly_briefs" ON public.weekly_briefs FOR ALL USING (true) WITH CHECK (true);
