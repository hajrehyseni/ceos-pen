
CREATE TABLE public.visual_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('carousel','infographic','image_post','chart','poll','reply')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('generating','ready','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visual_assets_post_kind_idx ON public.visual_assets(post_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_assets TO authenticated, anon;
GRANT ALL ON public.visual_assets TO service_role;
ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dashboard access to visual_assets" ON public.visual_assets FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.reply_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_text text NOT NULL,
  variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_drafts TO authenticated, anon;
GRANT ALL ON public.reply_drafts TO service_role;
ALTER TABLE public.reply_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dashboard access to reply_drafts" ON public.reply_drafts FOR ALL USING (true) WITH CHECK (true);
