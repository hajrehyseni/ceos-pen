
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS prompt_version text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS linkedin_urn text;

CREATE TABLE IF NOT EXISTS public.prompt_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  template text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_registry TO authenticated;
GRANT ALL ON public.prompt_registry TO service_role;
ALTER TABLE public.prompt_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access prompt_registry"
  ON public.prompt_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read prompt_registry"
  ON public.prompt_registry FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.comment_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_urn text UNIQUE,
  author_name text,
  text text NOT NULL,
  sentiment text,
  topic text,
  is_lead_signal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_insights TO authenticated;
GRANT ALL ON public.comment_insights TO service_role;
ALTER TABLE public.comment_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access comment_insights"
  ON public.comment_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read comment_insights"
  ON public.comment_insights FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS comment_insights_post_id_idx ON public.comment_insights(post_id);
CREATE INDEX IF NOT EXISTS posts_linkedin_urn_idx ON public.posts(linkedin_urn) WHERE linkedin_urn IS NOT NULL;
