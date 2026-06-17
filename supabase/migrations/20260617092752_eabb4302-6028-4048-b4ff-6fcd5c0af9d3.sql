
-- 1) Restrict user_profiles direct SELECT to owner only
DROP POLICY IF EXISTS "Public read profiles" ON public.user_profiles;
CREATE POLICY "Owner read profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) Public view of profiles that excludes private 'preferences' jsonb
DROP VIEW IF EXISTS public.user_profiles_public;
CREATE VIEW public.user_profiles_public
WITH (security_invoker = off) AS
SELECT id, user_id, bio, location, website, interests,
       avatar_color, banner_color, avatar_url, created_at, updated_at
FROM public.user_profiles;

GRANT SELECT ON public.user_profiles_public TO authenticated, anon;

-- 3) Avatars bucket: remove broad listing policy.
-- Public bucket URLs (/storage/v1/object/public/...) still work without this policy,
-- so avatar images remain viewable while bucket listing is no longer allowed.
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
