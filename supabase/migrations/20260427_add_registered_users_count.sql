-- Add registered_users_count to app_settings and whitelist it in app_settings_public view

-- Insert or update registered_users_count if not exists
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('registered_users_count', '0', now())
ON CONFLICT (key) DO NOTHING;

-- Update the app_settings_public view to include registered_users_count
DROP VIEW IF EXISTS public.app_settings_public;
CREATE VIEW public.app_settings_public WITH (security_definer = true) AS
SELECT key, value, updated_at
FROM public.app_settings
WHERE key IN ('webhook_form', 'registration_enabled', 'registered_users_count');

-- Ensure grants are in place
GRANT SELECT ON public.app_settings_public TO anon, authenticated;
