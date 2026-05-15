DROP VIEW IF EXISTS public.app_settings_public;
CREATE VIEW public.app_settings_public WITH (security_invoker = true) AS
  SELECT key, value, updated_at
  FROM public.app_settings
  WHERE key IN ('registration_enabled', 'registered_users_count');
GRANT SELECT ON public.app_settings_public TO anon, authenticated;