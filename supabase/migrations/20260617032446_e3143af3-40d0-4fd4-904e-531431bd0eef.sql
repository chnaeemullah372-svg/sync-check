CREATE TABLE public.fonts (
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