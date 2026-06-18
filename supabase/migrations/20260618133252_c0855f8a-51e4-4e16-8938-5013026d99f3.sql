
CREATE POLICY "chat-images authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat-images public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'chat-images');

CREATE POLICY "chat-images owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
