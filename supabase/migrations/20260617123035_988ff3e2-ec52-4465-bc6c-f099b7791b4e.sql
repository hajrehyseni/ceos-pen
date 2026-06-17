
-- 1. CEO context (single-row table)
CREATE TABLE public.ceo_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bio TEXT NOT NULL DEFAULT '',
  worldview TEXT NOT NULL DEFAULT '',
  recurring_stories TEXT NOT NULL DEFAULT '',
  forbidden_phrases TEXT NOT NULL DEFAULT '',
  lead_magnet_url TEXT NOT NULL DEFAULT 'https://build.londonra.com',
  auto_first_comment BOOLEAN NOT NULL DEFAULT true,
  hard_cta_ratio NUMERIC NOT NULL DEFAULT 0.4,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceo_context TO authenticated;
GRANT ALL ON public.ceo_context TO service_role;
ALTER TABLE public.ceo_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated dashboard access to ceo_context"
  ON public.ceo_context FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed one editable row with Hajre's defaults
INSERT INTO public.ceo_context (bio, worldview, recurring_stories, forbidden_phrases)
VALUES (
  'Hajre — founder & CEO of London Royal Academy (LRA). Trains operators, founders and defence teams on real-world AI workflows. British, direct, slightly cheeky.',
  'AI is not magic, it is a craft. Most LinkedIn AI talk is performative. Real value comes from boring, repeatable workflows shipped by people who actually use the tools daily. The people winning are the ones building in public.',
  '1) The executive who tried to outsource judgement to ChatGPT and got caught. 2) The defence team that found a 4-hour brief could be a 20-minute one. 3) The founder who realised her "AI strategy" was just three prompts in a Notion page.',
  'In today''s fast-paced world; leverage; unlock; game-changer; revolutionise; harness the power; deep dive; at the end of the day; truly; simply put; let me tell you; ladies and gentlemen; emoji; hashtag; — (em dash)'
);

-- 2. CTA library
CREATE TABLE public.cta_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  copy TEXT NOT NULL,
  cta_type TEXT NOT NULL DEFAULT 'soft', -- 'soft' = first-comment, 'hard' = in-body
  weight NUMERIC NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  times_used INTEGER NOT NULL DEFAULT 0,
  estimated_clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cta_library TO authenticated;
GRANT ALL ON public.cta_library TO service_role;
ALTER TABLE public.cta_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated dashboard access to cta_library"
  ON public.cta_library FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.cta_library (copy, cta_type, weight) VALUES
  ('Built the full playbook at build.londonra.com — go nick it, no email wall.', 'soft', 2),
  ('I''ve been quietly putting the whole thing together at build.londonra.com if you want a look.', 'soft', 2),
  ('The framework lives at build.londonra.com. Take what works, ignore the rest.', 'soft', 1),
  ('Half the operators I work with at build.londonra.com keep asking me the same question. So I wrote it down properly.', 'soft', 1),
  ('Full breakdown at build.londonra.com — proper one, not a teaser.', 'hard', 2),
  ('I''ve put the entire workflow at build.londonra.com. Free. Have at it.', 'hard', 1),
  ('More of this sort of thing at build.londonra.com.', 'hard', 1);

-- 3. Posts table additions
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS verification_evidence JSONB,
  ADD COLUMN IF NOT EXISTS voice_score NUMERIC,
  ADD COLUMN IF NOT EXISTS cta_id UUID REFERENCES public.cta_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_comment_text TEXT,
  ADD COLUMN IF NOT EXISTS first_comment_posted_at TIMESTAMPTZ;
