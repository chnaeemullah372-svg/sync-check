CREATE POLICY "entry_uploads_user_own_select" ON storage.objects
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
  WITH CHECK (bucket_id = 'entry-uploads' AND public.has_role(auth.uid(), 'admin'));