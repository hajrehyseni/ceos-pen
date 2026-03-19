CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to settings" ON public.settings
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES
  ('linkedin_access_token', ''),
  ('auto_publish_enabled', 'false')
ON CONFLICT (key) DO NOTHING;