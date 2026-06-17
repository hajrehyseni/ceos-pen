DROP POLICY IF EXISTS "Dashboard access to reply_drafts" ON public.reply_drafts;
CREATE POLICY "Dashboard access to reply_drafts" ON public.reply_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Dashboard access to visual_assets" ON public.visual_assets;
CREATE POLICY "Dashboard access to visual_assets" ON public.visual_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON public.reply_drafts FROM anon;
REVOKE ALL ON public.visual_assets FROM anon;