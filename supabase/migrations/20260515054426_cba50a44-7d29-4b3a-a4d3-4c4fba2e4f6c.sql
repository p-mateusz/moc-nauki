DROP VIEW IF EXISTS public.app_settings_public;
CREATE VIEW public.app_settings_public WITH (security_invoker = false, security_barrier = true) AS
  SELECT key, value, updated_at
  FROM public.app_settings
  WHERE key IN ('registration_enabled', 'registered_users_count');
ALTER VIEW public.app_settings_public SET (security_invoker = off);
GRANT SELECT ON public.app_settings_public TO anon, authenticated;