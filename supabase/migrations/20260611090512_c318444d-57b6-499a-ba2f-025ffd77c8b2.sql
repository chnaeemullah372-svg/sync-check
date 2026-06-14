
-- Global AI settings (singleton)
CREATE TABLE public.ai_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'standard' CHECK (mode IN ('disabled','standard','advanced')),
  provider TEXT CHECK (provider IN ('openai','gemini','claude')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
INSERT INTO public.ai_settings (id, mode) VALUES (1, 'standard');
GRANT SELECT ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read ai_settings" ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ai_settings" ON public.ai_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Per-user AI access
CREATE TABLE public.user_ai_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access TEXT NOT NULL DEFAULT 'standard' CHECK (access IN ('disabled','standard','advanced','both')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_ai_access TO authenticated;
GRANT ALL ON public.user_ai_access TO service_role;
ALTER TABLE public.user_ai_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own ai access" ON public.user_ai_access FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages ai access" ON public.user_ai_access FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Usage logs
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID,
  template_id UUID,
  mode TEXT NOT NULL,
  provider TEXT,
  input_type TEXT NOT NULL CHECK (input_type IN ('text','image')),
  estimated_tokens INT NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_logs_user_idx ON public.ai_usage_logs(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own usage" ON public.ai_usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user inserts own usage" ON public.ai_usage_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
