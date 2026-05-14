-- Security fix: Restrict avatars bucket policies to prevent unauthorized access
-- Only authenticated users can upload/update/delete their own avatars

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public delete avatars" ON storage.objects;

-- SELECT: Allow public read (avatars are public)
CREATE POLICY "Public read avatars" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- INSERT: Only authenticated users can upload to their own folder
CREATE POLICY "Authenticated upload own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND storage.foldername(name)[1] = auth.uid()::text
);

-- UPDATE: Only authenticated users can update their own avatar
CREATE POLICY "Authenticated update own avatar" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND storage.foldername(name)[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND storage.foldername(name)[1] = auth.uid()::text
);

-- DELETE: Only authenticated users can delete their own avatar
CREATE POLICY "Authenticated delete own avatar" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND storage.foldername(name)[1] = auth.uid()::text
);