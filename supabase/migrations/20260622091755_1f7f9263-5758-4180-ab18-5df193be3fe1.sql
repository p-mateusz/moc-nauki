CREATE POLICY "chat-images receiver read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
      AND m.image_url ILIKE ('%/' || storage.objects.name || '?%')
  )
);