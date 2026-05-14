
-- 1) Drop unused password_hash column (passwords managed by Supabase Auth)
ALTER TABLE public.user_accounts DROP COLUMN IF EXISTS password_hash;

-- 2) Tighten user_accounts: prevent role escalation
-- Allow users to update non-sensitive fields on their own row, block role/billing changes
DROP POLICY IF EXISTS "Users update own account safe fields" ON public.user_accounts;
CREATE POLICY "Users update own account safe fields"
ON public.user_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.user_accounts WHERE id = auth.uid())
  AND fee_exempt = (SELECT fee_exempt FROM public.user_accounts WHERE id = auth.uid())
  AND subscription_status = (SELECT subscription_status FROM public.user_accounts WHERE id = auth.uid())
  AND subscription_end_date IS NOT DISTINCT FROM (SELECT subscription_end_date FROM public.user_accounts WHERE id = auth.uid())
  AND payment_method IS NOT DISTINCT FROM (SELECT payment_method FROM public.user_accounts WHERE id = auth.uid())
  AND payment_date IS NOT DISTINCT FROM (SELECT payment_date FROM public.user_accounts WHERE id = auth.uid())
);

-- Explicitly DO NOT add INSERT/DELETE policies for non-admins; service role can still insert via edge functions

-- 3) Fix friendships INSERT policy: only requester can create
DROP POLICY IF EXISTS "Participants access friendships" ON public.friendships;

CREATE POLICY "View own friendships"
ON public.friendships
FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Requester creates friendship"
ON public.friendships
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Participants update friendship status"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Participants delete friendship"
ON public.friendships
FOR DELETE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 4) Restrict tests to authenticated users (hide solutions from anonymous)
DROP POLICY IF EXISTS "Public read tests" ON public.tests;
CREATE POLICY "Authenticated read tests"
ON public.tests
FOR SELECT
TO authenticated
USING (true);

-- 5) Restrict word_lists, words, generated_sentences reads to authenticated users
DROP POLICY IF EXISTS "Public read word_lists" ON public.word_lists;
CREATE POLICY "Authenticated read word_lists"
ON public.word_lists
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Public read words" ON public.words;
CREATE POLICY "Authenticated read words"
ON public.words
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Public read generated_sentences" ON public.generated_sentences;
CREATE POLICY "Authenticated read generated_sentences"
ON public.generated_sentences
FOR SELECT
TO authenticated
USING (true);

-- 6) Restrict avatars bucket listing — keep public read of specific files but no listing
-- Drop overly broad SELECT policies on storage.objects for avatars
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%avatars%' OR with_check ILIKE '%avatars%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow public read of specific objects in avatars (by exact path/URL), no listing
CREATE POLICY "Avatars public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Restrict insert/update/delete to file owner (folder = user id)
CREATE POLICY "Avatars owner insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
