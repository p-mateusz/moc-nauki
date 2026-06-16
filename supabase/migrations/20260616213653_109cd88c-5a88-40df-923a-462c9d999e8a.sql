ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calendar_feed_token text;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_calendar_feed_token_key
  ON public.user_profiles(calendar_feed_token)
  WHERE calendar_feed_token IS NOT NULL;