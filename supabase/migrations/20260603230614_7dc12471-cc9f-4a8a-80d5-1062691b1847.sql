ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS virality_score numeric,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb;