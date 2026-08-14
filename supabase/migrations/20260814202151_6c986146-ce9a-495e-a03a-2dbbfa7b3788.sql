DROP POLICY IF EXISTS "Owner access test_saves" ON public.test_saves;

ALTER TABLE public.test_saves ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

CREATE POLICY "Owner access test_saves" ON public.test_saves
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');