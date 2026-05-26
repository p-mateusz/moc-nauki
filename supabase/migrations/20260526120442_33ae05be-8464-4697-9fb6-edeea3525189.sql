DROP POLICY IF EXISTS "Users list own note images" ON storage.objects;
CREATE POLICY "Users list own note images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'note-images' AND (auth.uid())::text = (storage.foldername(name))[1]);