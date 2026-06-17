CREATE TABLE public.hook_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  shape text NOT NULL,
  text text NOT NULL,
  was_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hook_variants TO authenticated;
GRANT ALL ON public.hook_variants TO service_role;
ALTER TABLE public.hook_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to hook_variants" ON public.hook_variants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX hook_variants_post_id_idx ON public.hook_variants(post_id);

ALTER TABLE public.voice_samples
  ADD COLUMN IF NOT EXISTS auto_harvested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS style_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS repurposed_from_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;