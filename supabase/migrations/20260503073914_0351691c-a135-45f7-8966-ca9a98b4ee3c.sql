-- Friendships: restrict status updates to addressee only
DROP POLICY IF EXISTS "Participants update friendship status" ON public.friendships;
CREATE POLICY "Addressee updates friendship status" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted','rejected','blocked'));

-- Messages: remove sender update privilege (content immutable)
DROP POLICY IF EXISTS "Sender update own messages" ON public.messages;

-- Replace get_user_role() RLS usage with inline EXISTS so we can revoke EXECUTE
DROP POLICY IF EXISTS "Admin delete settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin read all settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin update settings" ON public.app_settings;
CREATE POLICY "Admin delete settings" ON public.app_settings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin read all settings" ON public.app_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin delete roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Admin insert roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Admin update roles" ON public.custom_roles;
CREATE POLICY "Admin delete roles" ON public.custom_roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin insert roles" ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin update roles" ON public.custom_roles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin or owner delete tips" ON public.tips;
DROP POLICY IF EXISTS "Admin or owner update tips" ON public.tips;
CREATE POLICY "Admin or owner delete tips" ON public.tips FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin or owner update tips" ON public.tips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins read all webhook usage" ON public.webhook_usage;
CREATE POLICY "Admins read all webhook usage" ON public.webhook_usage FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin'));

-- Lock down the helper function
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, public;