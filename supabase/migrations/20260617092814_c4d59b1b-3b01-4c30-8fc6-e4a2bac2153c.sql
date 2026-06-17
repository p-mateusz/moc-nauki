
-- Move 'preferences' to its own owner-only table
CREATE TABLE IF NOT EXISTS public.user_profile_private (
  user_id uuid PRIMARY KEY,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile_private TO authenticated;
GRANT ALL ON public.user_profile_private TO service_role;

ALTER TABLE public.user_profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read private"
  ON public.user_profile_private FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owner insert private"
  ON public.user_profile_private FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update private"
  ON public.user_profile_private FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete private"
  ON public.user_profile_private FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Backfill from existing user_profiles.preferences
INSERT INTO public.user_profile_private (user_id, preferences)
SELECT user_id, COALESCE(preferences, '{}'::jsonb)
FROM public.user_profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Drop the public view & restore public read on user_profiles (without preferences col)
DROP VIEW IF EXISTS public.user_profiles_public;

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS preferences;

DROP POLICY IF EXISTS "Owner read profile" ON public.user_profiles;
CREATE POLICY "Public read profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated, anon
  USING (true);
