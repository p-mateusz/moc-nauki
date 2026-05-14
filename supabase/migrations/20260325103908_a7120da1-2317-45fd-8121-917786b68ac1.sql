INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "Public upload avatars" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Public update avatars" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'avatars');
CREATE POLICY "Public delete avatars" ON storage.objects FOR DELETE TO public USING (bucket_id = 'avatars');

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;