
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.module_code AS ENUM ('PIT', 'FAC', 'NRC', 'SMT');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code public.module_code NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  members_per_page INT,
  allow_add_member BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_read_auth" ON public.modules FOR SELECT TO authenticated USING (true);

INSERT INTO public.modules (code, name, description, members_per_page, allow_add_member) VALUES
('PIT', 'PIT', 'Unlimited members per template (slot based)', NULL, true),
('FAC', 'FAC', 'Exactly 5 members per page', 5, true),
('NRC', 'NRC', 'Single record', 1, false),
('SMT', 'SMT', 'Single record', 1, false);

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  page_size TEXT NOT NULL DEFAULT 'a4p',
  width INT NOT NULL DEFAULT 794,
  height INT NOT NULL DEFAULT 1123,
  background_url TEXT,
  ai_fields JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  members_per_page INT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_templates TO authenticated;
GRANT ALL ON public.user_templates TO service_role;
ALTER TABLE public.user_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "utemplates_admin_all" ON public.user_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "utemplates_user_read_own" ON public.user_templates FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "templates_admin_all" ON public.templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "templates_user_assigned_read" ON public.templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_templates ut WHERE ut.template_id = templates.id AND ut.user_id = auth.uid()));
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.template_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX template_objects_template_idx ON public.template_objects(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_objects TO authenticated;
GRANT ALL ON public.template_objects TO service_role;
ALTER TABLE public.template_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tobjects_admin_all" ON public.template_objects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tobjects_user_assigned_read" ON public.template_objects FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_templates ut WHERE ut.template_id = template_objects.template_id AND ut.user_id = auth.uid()));

CREATE TABLE public.member_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  slot_index INT NOT NULL,
  slot_name TEXT,
  group_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (template_id, slot_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_slots TO authenticated;
GRANT ALL ON public.member_slots TO service_role;
ALTER TABLE public.member_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mslots_admin_all" ON public.member_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mslots_user_assigned_read" ON public.member_slots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_templates ut WHERE ut.template_id = member_slots.template_id AND ut.user_id = auth.uid()));

CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id),
  entry_no SERIAL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries_admin_all" ON public.entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "entries_user_own" ON public.entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER entries_updated_at BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.entry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  member_no INT NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX entry_members_entry_idx ON public.entry_members(entry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_members TO authenticated;
GRANT ALL ON public.entry_members TO service_role;
ALTER TABLE public.entry_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emembers_admin_all" ON public.entry_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "emembers_user_own" ON public.entry_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_members.entry_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_members.entry_id AND e.user_id = auth.uid()));

CREATE TABLE public.entry_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.entry_members(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_files TO authenticated;
GRANT ALL ON public.entry_files TO service_role;
ALTER TABLE public.entry_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "efiles_admin_all" ON public.entry_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "efiles_user_own" ON public.entry_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_files.entry_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_files.entry_id AND e.user_id = auth.uid()));

CREATE TABLE public.entry_auto_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id),
  entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  images_meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_auto_saves TO authenticated;
GRANT ALL ON public.entry_auto_saves TO service_role;
ALTER TABLE public.entry_auto_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "easaves_user_own" ON public.entry_auto_saves FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER easaves_updated_at BEFORE UPDATE ON public.entry_auto_saves FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  object_key TEXT,
  action_type TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_adjustments TO authenticated;
GRANT ALL ON public.user_adjustments TO service_role;
ALTER TABLE public.user_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uadj_admin_read" ON public.user_adjustments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "uadj_user_own" ON public.user_adjustments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exports TO authenticated;
GRANT ALL ON public.exports TO service_role;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exports_admin_all" ON public.exports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "exports_user_own" ON public.exports FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Drop module dependencies
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_module_id_fkey;
ALTER TABLE public.entries ALTER COLUMN module_id DROP NOT NULL;
ALTER TABLE public.entries DROP COLUMN IF EXISTS module_id;

ALTER TABLE public.entry_auto_saves DROP CONSTRAINT IF EXISTS entry_auto_saves_module_id_fkey;
ALTER TABLE public.entry_auto_saves DROP COLUMN IF EXISTS module_id;

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_module_id_fkey;
ALTER TABLE public.templates ALTER COLUMN module_id DROP NOT NULL;
ALTER TABLE public.templates DROP COLUMN IF EXISTS module_id;

-- Add template metadata
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS templates_archived_idx ON public.templates(archived_at);

-- Drop modules table (no longer used)
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TYPE IF EXISTS module_code;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
-- Users can read/write only inside a top-level folder named after their user id
CREATE POLICY "entry_uploads_user_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'entry-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "entry_uploads_user_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'entry-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "entry_uploads_user_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'entry-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'entry-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "entry_uploads_user_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'entry-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins: full access
CREATE POLICY "entry_uploads_admin_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'entry-uploads' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'entry-uploads' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS ai_instructions text;
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

CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  provider TEXT PRIMARY KEY CHECK (provider IN ('openai','gemini','claude')),
  api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_keys TO authenticated;
GRANT ALL ON public.ai_provider_keys TO service_role;

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_keys_admin_all"
  ON public.ai_provider_keys
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Restrict ai_usage_logs insert: entry_id (when set) must belong to the user; template_id is free-form (templates may be shared/admin-owned).
DROP POLICY IF EXISTS "user inserts own usage" ON public.ai_usage_logs;
CREATE POLICY "user inserts own usage"
ON public.ai_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    entry_id IS NULL
    OR EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_id AND e.user_id = auth.uid())
  )
);

-- Trigger function is invoked by the auth trigger only; revoke direct execute from clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  page_size TEXT NOT NULL DEFAULT 'a4p',
  width INT NOT NULL DEFAULT 794,
  height INT NOT NULL DEFAULT 1123,
  background_url TEXT,
  ai_fields JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  members_per_page INT,
  category TEXT,
  archived_at TIMESTAMPTZ,
  ai_instructions TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_templates TO authenticated;
GRANT ALL ON public.user_templates TO service_role;
ALTER TABLE public.user_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.template_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX template_objects_template_idx ON public.template_objects(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_objects TO authenticated;
GRANT ALL ON public.template_objects TO service_role;
ALTER TABLE public.template_objects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.member_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  slot_index INT NOT NULL,
  slot_name TEXT,
  group_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (template_id, slot_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_slots TO authenticated;
GRANT ALL ON public.member_slots TO service_role;
ALTER TABLE public.member_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  entry_no BIGINT GENERATED BY DEFAULT AS IDENTITY,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.entry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  member_no INT NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX entry_members_entry_idx ON public.entry_members(entry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_members TO authenticated;
GRANT ALL ON public.entry_members TO service_role;
ALTER TABLE public.entry_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.entry_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.entry_members(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_files TO authenticated;
GRANT ALL ON public.entry_files TO service_role;
ALTER TABLE public.entry_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.entry_auto_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  images_meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_auto_saves TO authenticated;
GRANT ALL ON public.entry_auto_saves TO service_role;
ALTER TABLE public.entry_auto_saves ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  object_key TEXT,
  action_type TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_adjustments TO authenticated;
GRANT ALL ON public.user_adjustments TO service_role;
ALTER TABLE public.user_adjustments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exports TO authenticated;
GRANT ALL ON public.exports TO service_role;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'standard' CHECK (mode IN ('disabled','standard','advanced')),
  provider TEXT CHECK (provider IN ('openai','gemini','claude')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_ai_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access TEXT NOT NULL DEFAULT 'standard' CHECK (access IN ('disabled','standard','advanced','both')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_ai_access TO authenticated;
GRANT ALL ON public.user_ai_access TO service_role;
ALTER TABLE public.user_ai_access ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE public.ai_provider_keys (
  provider TEXT PRIMARY KEY CHECK (provider IN ('openai','gemini','claude')),
  api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_keys TO authenticated;
GRANT ALL ON public.ai_provider_keys TO service_role;
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY utemplates_admin_all ON public.user_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY utemplates_user_read_own ON public.user_templates FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY templates_admin_all ON public.templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY templates_user_assigned_read ON public.templates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_templates ut WHERE ut.template_id = templates.id AND ut.user_id = auth.uid()));
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY tobjects_admin_all ON public.template_objects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY tobjects_user_assigned_read ON public.template_objects FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_templates ut WHERE ut.template_id = template_objects.template_id AND ut.user_id = auth.uid()));

CREATE POLICY mslots_admin_all ON public.member_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY mslots_user_assigned_read ON public.member_slots FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_templates ut WHERE ut.template_id = member_slots.template_id AND ut.user_id = auth.uid()));

CREATE POLICY entries_admin_all ON public.entries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY entries_user_own ON public.entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER entries_updated_at BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY emembers_admin_all ON public.entry_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY emembers_user_own ON public.entry_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_members.entry_id AND e.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_members.entry_id AND e.user_id = auth.uid()));

CREATE POLICY efiles_admin_all ON public.entry_files FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY efiles_user_own ON public.entry_files FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_files.entry_id AND e.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_files.entry_id AND e.user_id = auth.uid()));

CREATE POLICY easaves_user_own ON public.entry_auto_saves FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER easaves_updated_at BEFORE UPDATE ON public.entry_auto_saves FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY uadj_admin_read ON public.user_adjustments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY uadj_user_own ON public.user_adjustments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY exports_admin_all ON public.exports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY exports_user_own ON public.exports FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY all_auth_read_ai_settings ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_manage_ai_settings ON public.ai_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
INSERT INTO public.ai_settings (id, mode) VALUES (1, 'standard');

CREATE POLICY user_reads_own_ai_access ON public.user_ai_access FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY admin_manages_ai_access ON public.user_ai_access FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY user_reads_own_usage ON public.ai_usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY user_inserts_own_usage ON public.ai_usage_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (entry_id IS NULL OR EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_id AND e.user_id = auth.uid())));

CREATE POLICY ai_provider_keys_admin_all ON public.ai_provider_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;CREATE POLICY "entry_uploads_user_own_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'entry-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "entry_uploads_user_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'entry-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "entry_uploads_user_own_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'entry-uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'entry-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "entry_uploads_user_own_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'entry-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "entry_uploads_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'entry-uploads' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'entry-uploads' AND public.has_role(auth.uid(), 'admin'));CREATE TABLE public.fonts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  family text NOT NULL,
  file_path text NOT NULL,
  format text NOT NULL DEFAULT 'truetype',
  aliases text[] NOT NULL DEFAULT '{}',
  language text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fonts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fonts TO authenticated;
GRANT ALL ON public.fonts TO service_role;

ALTER TABLE public.fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fonts_read_all_authenticated"
  ON public.fonts FOR SELECT TO authenticated USING (true);

CREATE POLICY "fonts_admin_insert"
  ON public.fonts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fonts_admin_update"
  ON public.fonts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fonts_admin_delete"
  ON public.fonts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER fonts_updated_at
  BEFORE UPDATE ON public.fonts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for the `fonts` bucket (bucket itself is created via the storage tool)
CREATE POLICY "fonts_storage_read_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'fonts');

CREATE POLICY "fonts_storage_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fonts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fonts_storage_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fonts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fonts_storage_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fonts' AND public.has_role(auth.uid(), 'admin'));
-- 1. Admin ALL policy on entry_auto_saves
CREATE POLICY "easaves_admin_all" ON public.entry_auto_saves
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Defense-in-depth: restrictive policy on user_roles blocking non-admin writes
CREATE POLICY "user_roles_no_self_write" ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_no_self_update" ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_no_self_delete" ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Lock down trigger-only function (triggers run as table owner, not invoker)
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
