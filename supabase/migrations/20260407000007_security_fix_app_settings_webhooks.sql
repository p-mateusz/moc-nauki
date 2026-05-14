-- Security fix: Restrict app_settings access to prevent webhook URL exposure
-- The app_settings table contained sensitive n8n webhook URLs that were publicly readable
-- This fix:
-- 1. Restricts main table SELECT to authenticated users only
-- 2. Creates a public view for non-sensitive settings only
-- 3. Restricts INSERT/UPDATE/DELETE to admins only

-- 1. Drop overly permissive policies
DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public write app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin delete settings" ON public.app_settings;

-- 2. Add restrictive policies on main table
CREATE POLICY "Authenticated read app_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin insert app_settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin update app_settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin delete app_settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- 3. Create public view for non-sensitive settings (whitelisted keys only)
-- This view uses SECURITY DEFINER so it can read from app_settings without RLS restrictions
DROP VIEW IF EXISTS public.app_settings_public;
CREATE VIEW public.app_settings_public WITH (security_definer = true) AS
SELECT key, value, updated_at
FROM public.app_settings
WHERE key IN ('webhook_form', 'registration_enabled');

-- Grant SELECT on the view to public role
GRANT SELECT ON public.app_settings_public TO anon, authenticated;