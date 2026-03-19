
-- Create posts table
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('ai_agents', 'defence_training', 'academic_research', 'ceo_journey', 'curated_commentary')),
  format TEXT NOT NULL DEFAULT 'text' CHECK (format IN ('text', 'carousel', 'poll', 'story')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'rejected')),
  engagement_estimate TEXT CHECK (engagement_estimate IN ('low', 'medium', 'high')),
  suggested_time TIME,
  edit_notes TEXT,
  rejection_reason TEXT,
  source_material JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- Create post_metrics table
CREATE TABLE public.post_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create voice_samples table
CREATE TABLE public.voice_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT,
  source TEXT,
  performance_rating INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create news_items table
CREATE TABLE public.news_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  url TEXT,
  source TEXT,
  summary TEXT,
  relevance_score NUMERIC,
  pillar_match TEXT,
  used_in_post UUID REFERENCES public.posts(id),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create agent_log table
CREATE TABLE public.agent_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT,
  details JSONB,
  api_cost_usd NUMERIC DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_log ENABLE ROW LEVEL SECURITY;

-- Since this is a personal tool with password gate (no auth), we allow all operations via service role
-- The edge function will use service role key, and the password gate protects the frontend
CREATE POLICY "Allow all access to posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to post_metrics" ON public.post_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to voice_samples" ON public.voice_samples FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to news_items" ON public.news_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agent_log" ON public.agent_log FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_post_metrics_post_id ON public.post_metrics(post_id);
CREATE INDEX idx_agent_log_created_at ON public.agent_log(created_at DESC);
