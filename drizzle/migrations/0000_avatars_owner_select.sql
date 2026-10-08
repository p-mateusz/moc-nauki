DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);