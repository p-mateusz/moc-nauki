REVOKE EXECUTE ON FUNCTION public.create_default_notebooks(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_default_reminder_lists(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_default_calendars(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;