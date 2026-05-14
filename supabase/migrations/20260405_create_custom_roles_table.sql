-- Create custom_roles table from scratch
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#60a5fa',
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Insert built-in roles
INSERT INTO public.custom_roles (name, label, color, is_builtin)
VALUES
  ('admin', 'Admin', '#f87171', true),
  ('uczeń', 'Uczeń', '#60a5fa', true),
  ('nauczyciel', 'Nauczyciel', '#fbbf24', true)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  is_builtin = EXCLUDED.is_builtin;

-- Update RLS policy to allow reading all roles
DROP POLICY IF EXISTS "Public access to custom_roles" ON public.custom_roles;
CREATE POLICY "Public access to custom_roles" ON public.custom_roles
  FOR SELECT
  TO public
  USING (true);

-- Only admins can insert/update/delete roles
DROP POLICY IF EXISTS "Only admins can modify custom_roles" ON public.custom_roles;
CREATE POLICY "Only admins can modify custom_roles" ON public.custom_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can update custom_roles" ON public.custom_roles;
CREATE POLICY "Only admins can update custom_roles" ON public.custom_roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can delete custom_roles" ON public.custom_roles;
CREATE POLICY "Only admins can delete custom_roles" ON public.custom_roles
  FOR DELETE
  USING (
    is_builtin = false AND
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
      AND role = 'admin'
    )
  );</content>
<parameter name="filePath">/workspaces/palabra-amiga/supabase/migrations/20260405_create_custom_roles_table.sql