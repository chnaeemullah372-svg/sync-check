
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
