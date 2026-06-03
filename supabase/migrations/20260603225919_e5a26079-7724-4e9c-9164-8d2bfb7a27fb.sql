ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS verification_notes JSONB;