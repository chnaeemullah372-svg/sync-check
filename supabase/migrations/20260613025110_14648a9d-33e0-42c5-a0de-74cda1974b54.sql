
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
