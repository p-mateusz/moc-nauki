-- Security fix: Completely restrict avatars bucket to authenticated users only
-- Ensures anonymous users cannot upload, update, or delete any files

-- 1. Drop all existing avatar policies
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own avatar" ON storage.objects;

-- 2. SELECT: Allow public read for avatar display
CREATE POLICY "Public read avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 3. INSERT: Only authenticated users can upload to their own folder
CREATE POLICY "Authenticated users upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. UPDATE: Only authenticated users can update their own avatar file
CREATE POLICY "Authenticated users update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. DELETE: Only authenticated users can delete their own avatar file
CREATE POLICY "Authenticated users delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);