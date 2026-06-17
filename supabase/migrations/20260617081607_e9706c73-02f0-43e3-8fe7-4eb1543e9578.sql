
-- 1) New owner-only table for calendar feed tokens
CREATE TABLE IF NOT EXISTS public.user_calendar_feeds (
  user_id uuid PRIMARY KEY,
  token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_feeds TO authenticated;
GRANT ALL ON public.user_calendar_feeds TO service_role;

ALTER TABLE public.user_calendar_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner select calendar feed"
  ON public.user_calendar_feeds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner insert calendar feed"
  ON public.user_calendar_feeds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update calendar feed"
  ON public.user_calendar_feeds FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner delete calendar feed"
  ON public.user_calendar_feeds FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing data
INSERT INTO public.user_calendar_feeds (user_id, token)
SELECT user_id, calendar_feed_token
FROM public.user_profiles
WHERE calendar_feed_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Drop column from publicly-readable table
DROP INDEX IF EXISTS public.user_profiles_calendar_feed_token_key;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS calendar_feed_token;

-- 2) Public read for avatar images (bucket is already public via URL)
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars owner list" ON storage.objects;
