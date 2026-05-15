-- Restrict public read on app_settings to only known safe keys
DROP POLICY IF EXISTS "Public read non-sensitive settings" ON public.app_settings;

CREATE POLICY "Public read whitelisted settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('registration_enabled', 'registered_users_count'));
