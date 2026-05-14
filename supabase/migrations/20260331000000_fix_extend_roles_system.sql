-- Extend custom_roles table with label (translation) and is_builtin flag
ALTER TABLE public.custom_roles 
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT false;

-- Insert built-in roles if they don't exist
INSERT INTO public.custom_roles (name, label, color, is_builtin)
VALUES 
  ('uczeń', 'Uczeń', '#60a5fa', true),
  ('teacher', 'Nauczyciel', '#34d399', true),
  ('admin', 'Admin', '#f87171', true)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  is_builtin = EXCLUDED.is_builtin,
  color = EXCLUDED.color;

-- Update RLS policy to allow reading all roles
DROP POLICY IF EXISTS "Public access to custom_roles" ON public.custom_roles;
CREATE POLICY "Public access to custom_roles" ON public.custom_roles 
  FOR SELECT 
  TO public 
  USING (true);

-- Only admins can insert/update/delete roles
CREATE POLICY "Only admins can modify custom_roles" ON public.custom_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
      AND role = 'admin'
    )
  );

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

CREATE POLICY "Only admins can delete custom_roles" ON public.custom_roles
  FOR DELETE
  USING (
    is_builtin = false AND
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
      AND role = 'admin'
    )
  );
