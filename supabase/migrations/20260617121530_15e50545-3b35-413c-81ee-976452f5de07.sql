-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all access to posts" ON public.posts;
DROP POLICY IF EXISTS "Allow all access to news_items" ON public.news_items;
DROP POLICY IF EXISTS "Allow all access to post_metrics" ON public.post_metrics;
DROP POLICY IF EXISTS "Allow all access to agent_log" ON public.agent_log;
DROP POLICY IF EXISTS "Allow all access to settings" ON public.settings;
DROP POLICY IF EXISTS "Allow all access to voice_samples" ON public.voice_samples;

-- Revoke anon access entirely; authenticated dashboard users only
REVOKE ALL ON public.posts FROM anon;
REVOKE ALL ON public.news_items FROM anon;
REVOKE ALL ON public.post_metrics FROM anon;
REVOKE ALL ON public.agent_log FROM anon;
REVOKE ALL ON public.settings FROM anon;
REVOKE ALL ON public.voice_samples FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_samples TO authenticated;

GRANT ALL ON public.posts TO service_role;
GRANT ALL ON public.news_items TO service_role;
GRANT ALL ON public.post_metrics TO service_role;
GRANT ALL ON public.agent_log TO service_role;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.voice_samples TO service_role;

-- New policies: only signed-in dashboard users
CREATE POLICY "Authenticated dashboard access to posts"
  ON public.posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated dashboard access to news_items"
  ON public.news_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated dashboard access to post_metrics"
  ON public.post_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated dashboard access to agent_log"
  ON public.agent_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated dashboard access to settings"
  ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated dashboard access to voice_samples"
  ON public.voice_samples FOR ALL TO authenticated USING (true) WITH CHECK (true);