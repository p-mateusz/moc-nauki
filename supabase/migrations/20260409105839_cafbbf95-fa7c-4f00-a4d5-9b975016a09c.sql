
-- 1. Fix tests UPDATE policy: restrict to owner only
DROP POLICY IF EXISTS "Authenticated update tests" ON public.tests;
CREATE POLICY "Owner update tests"
  ON public.tests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 2. Fix messages UPDATE policy: split sender vs receiver
DROP POLICY IF EXISTS "Update own messages" ON public.messages;

CREATE POLICY "Sender update own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "Receiver mark messages read"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 3. Fix avatars storage policies
DROP POLICY IF EXISTS "Allow public uploads to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete avatars" ON storage.objects;

-- Drop any remaining INSERT/UPDATE/DELETE policies on avatars for public role
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname NOT LIKE '%read%' AND policyname NOT LIKE '%select%' AND policyname NOT LIKE '%view%'
    AND policyname ILIKE '%avatar%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "Owner upload avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner update avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner delete avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Fix app_settings public read: only expose non-webhook keys publicly
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;

CREATE POLICY "Public read non-sensitive settings"
  ON public.app_settings FOR SELECT TO public
  USING (key NOT LIKE 'webhook_%');

CREATE POLICY "Admin read all settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- 5. Recreate user_accounts_public view without SECURITY DEFINER and without password_hash
DROP VIEW IF EXISTS public.user_accounts_public;
CREATE VIEW public.user_accounts_public
WITH (security_invoker = true)
AS SELECT
  id, username, name, role, created_at,
  email, fee_exempt, subscription_status,
  subscription_end_date, payment_method, payment_date
FROM public.user_accounts;
