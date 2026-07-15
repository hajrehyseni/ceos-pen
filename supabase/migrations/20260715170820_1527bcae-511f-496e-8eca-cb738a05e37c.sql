
ALTER TABLE public.visual_assets DROP CONSTRAINT IF EXISTS visual_assets_kind_check;
ALTER TABLE public.visual_assets ADD CONSTRAINT visual_assets_kind_check
  CHECK (kind = ANY (ARRAY['carousel','infographic','image_post','chart','poll','reply','meme']));
