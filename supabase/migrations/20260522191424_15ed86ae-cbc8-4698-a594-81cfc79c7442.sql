ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT false;

UPDATE public.custom_roles SET label = name WHERE label IS NULL;