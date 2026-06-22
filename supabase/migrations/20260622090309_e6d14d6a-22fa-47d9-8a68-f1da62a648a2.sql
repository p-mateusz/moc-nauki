ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text NULL,
  ADD COLUMN IF NOT EXISTS deleted_for text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile_private TO authenticated;
GRANT ALL ON public.user_profile_private TO service_role;

DROP POLICY IF EXISTS "Owner read private" ON public.user_profile_private;
DROP POLICY IF EXISTS "Owner insert private" ON public.user_profile_private;
DROP POLICY IF EXISTS "Owner update private" ON public.user_profile_private;
DROP POLICY IF EXISTS "Owner delete private" ON public.user_profile_private;

CREATE POLICY "Owner read private"
  ON public.user_profile_private FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owner insert private"
  ON public.user_profile_private FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update private"
  ON public.user_profile_private FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete private"
  ON public.user_profile_private FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own message metadata" ON public.messages;
CREATE POLICY "Users update own message metadata"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "chat-images authenticated upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "chat-images public read" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner read" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner update" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner delete" ON storage.objects;

CREATE POLICY "chat-images authenticated upload own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat-images owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat-images owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat-images owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);