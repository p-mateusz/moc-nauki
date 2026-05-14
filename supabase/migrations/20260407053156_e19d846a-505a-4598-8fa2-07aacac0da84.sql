
-- 1. Helper function to check user role without exposing user_accounts
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_accounts WHERE id = uid
$$;

-- 2. Recreate user_accounts_public view (definer mode, no security_invoker)
DROP VIEW IF EXISTS public.user_accounts_public;
CREATE VIEW public.user_accounts_public AS
  SELECT id, name, username, email, role, created_at, fee_exempt,
         subscription_status, subscription_end_date, payment_date, payment_method
  FROM public.user_accounts;
GRANT SELECT ON public.user_accounts_public TO anon, authenticated;

-- 3. user_accounts: allow own-row SELECT for authenticated
CREATE POLICY "Users read own account"
  ON public.user_accounts FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 4. activity_days: owner-only
DROP POLICY IF EXISTS "Public access to activity_days" ON public.activity_days;
CREATE POLICY "Owner access activity_days"
  ON public.activity_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. calendar_events: owner-only
DROP POLICY IF EXISTS "Users manage own events" ON public.calendar_events;
CREATE POLICY "Owner manage events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. notebooks: owner-only
DROP POLICY IF EXISTS "Users manage own notebooks" ON public.notebooks;
CREATE POLICY "Owner manage notebooks"
  ON public.notebooks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. notebook_sections: via notebook owner
DROP POLICY IF EXISTS "Users manage own sections" ON public.notebook_sections;
CREATE POLICY "Owner manage sections"
  ON public.notebook_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM notebooks WHERE notebooks.id = notebook_sections.notebook_id AND notebooks.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM notebooks WHERE notebooks.id = notebook_sections.notebook_id AND notebooks.user_id = auth.uid()));

-- 8. notebook_pages: via section -> notebook owner
DROP POLICY IF EXISTS "Users manage own pages" ON public.notebook_pages;
CREATE POLICY "Owner manage pages"
  ON public.notebook_pages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM notebook_sections s JOIN notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_pages.section_id AND n.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM notebook_sections s JOIN notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_pages.section_id AND n.user_id = auth.uid()));

-- 9. messages: participants only
DROP POLICY IF EXISTS "Public access to messages" ON public.messages;
CREATE POLICY "Read own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Update own messages" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Delete own messages" ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- 10. friendships: participants only
DROP POLICY IF EXISTS "Public access to friendships" ON public.friendships;
CREATE POLICY "Participants access friendships"
  ON public.friendships FOR ALL TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 11. flashcard_sessions: owner-only
DROP POLICY IF EXISTS "Public access flashcard_sessions" ON public.flashcard_sessions;
CREATE POLICY "Owner access flashcard_sessions"
  ON public.flashcard_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12. practice_progress: owner-only
DROP POLICY IF EXISTS "Public access to practice_progress" ON public.practice_progress;
CREATE POLICY "Owner access practice_progress"
  ON public.practice_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 13. reminder_lists: owner-only
DROP POLICY IF EXISTS "Public access to reminder_lists" ON public.reminder_lists;
CREATE POLICY "Owner access reminder_lists"
  ON public.reminder_lists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 14. reminders: owner-only
DROP POLICY IF EXISTS "Public access to reminders" ON public.reminders;
CREATE POLICY "Owner access reminders"
  ON public.reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 15. user_calendars: owner-only
DROP POLICY IF EXISTS "Users manage own calendars" ON public.user_calendars;
CREATE POLICY "Owner manage calendars"
  ON public.user_calendars FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 16. word_lists: public read (shared links), owner write
DROP POLICY IF EXISTS "Public access to word_lists" ON public.word_lists;
CREATE POLICY "Public read word_lists" ON public.word_lists FOR SELECT USING (true);
CREATE POLICY "Owner insert word_lists" ON public.word_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update word_lists" ON public.word_lists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner delete word_lists" ON public.word_lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 17. words: public read, owner write via word_lists
DROP POLICY IF EXISTS "Public access to words" ON public.words;
CREATE POLICY "Public read words" ON public.words FOR SELECT USING (true);
CREATE POLICY "Owner insert words" ON public.words FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = words.list_id AND word_lists.user_id = auth.uid()));
CREATE POLICY "Owner update words" ON public.words FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = words.list_id AND word_lists.user_id = auth.uid()));
CREATE POLICY "Owner delete words" ON public.words FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = words.list_id AND word_lists.user_id = auth.uid()));

-- 18. generated_sentences: public read, owner write via word_lists
DROP POLICY IF EXISTS "Public access generated_sentences" ON public.generated_sentences;
CREATE POLICY "Public read generated_sentences" ON public.generated_sentences FOR SELECT USING (true);
CREATE POLICY "Owner insert generated_sentences" ON public.generated_sentences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = generated_sentences.list_id AND word_lists.user_id = auth.uid()));
CREATE POLICY "Owner update generated_sentences" ON public.generated_sentences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = generated_sentences.list_id AND word_lists.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = generated_sentences.list_id AND word_lists.user_id = auth.uid()));
CREATE POLICY "Owner delete generated_sentences" ON public.generated_sentences FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = generated_sentences.list_id AND word_lists.user_id = auth.uid()));

-- 19. user_profiles: public read, owner write
DROP POLICY IF EXISTS "Public access to user_profiles" ON public.user_profiles;
CREATE POLICY "Public read profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner delete profile" ON public.user_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 20. users: public read, owner manage
DROP POLICY IF EXISTS "Public access to users" ON public.users;
CREATE POLICY "Public read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert user" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner update user" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 21. tips: read approved + own, owner insert, admin/owner manage
DROP POLICY IF EXISTS "Public read approved tips" ON public.tips;
DROP POLICY IF EXISTS "Anyone can insert tips" ON public.tips;
DROP POLICY IF EXISTS "Anyone can update tips" ON public.tips;
DROP POLICY IF EXISTS "Anyone can delete tips" ON public.tips;
CREATE POLICY "Read approved or own tips" ON public.tips FOR SELECT TO authenticated
  USING (approved = true OR auth.uid() = user_id);
CREATE POLICY "Users insert own tips" ON public.tips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin or owner update tips" ON public.tips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin or owner delete tips" ON public.tips FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');

-- 22. tests: public read, owner insert/delete, authenticated update (for likes)
DROP POLICY IF EXISTS "Public access tests" ON public.tests;
CREATE POLICY "Public read tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Owner insert tests" ON public.tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated update tests" ON public.tests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owner delete tests" ON public.tests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 23. test_saves: owner only (user_id is text type)
DROP POLICY IF EXISTS "Public access test_saves" ON public.test_saves;
CREATE POLICY "Owner access test_saves" ON public.test_saves FOR ALL TO authenticated
  USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- 24. app_settings: public read, admin write
DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public write app_settings" ON public.app_settings;
CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin delete settings" ON public.app_settings FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- 25. custom_roles: public read, admin write
DROP POLICY IF EXISTS "Public access to custom_roles" ON public.custom_roles;
CREATE POLICY "Public read roles" ON public.custom_roles FOR SELECT USING (true);
CREATE POLICY "Admin insert roles" ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin update roles" ON public.custom_roles FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin delete roles" ON public.custom_roles FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');
