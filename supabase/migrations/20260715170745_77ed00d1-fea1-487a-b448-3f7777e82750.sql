
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_pillar_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_pillar_check
  CHECK (pillar = ANY (ARRAY['ai_agents','defence_training','academic_research','ceo_journey','curated_commentary','tool_tips']));

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_format_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_format_check
  CHECK (format = ANY (ARRAY['text','carousel','poll','story','meme','tool_tip']));
