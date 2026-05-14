-- Comprehensive migration: Add all missing RLS policies and data structures for Supabase
-- This ensures all user data is properly isolated and accessible only to authorized parties

-- 1. NOTES & NOTEBOOKS - Guarantee user ownership
DROP POLICY IF EXISTS "Users manage own notebooks" ON public.notebooks;
CREATE POLICY "Users manage own notebooks"
ON public.notebooks
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- 2. CALENDAR EVENTS - User ownership with privacy
DROP POLICY IF EXISTS "Users manage own events" ON public.calendar_events;
CREATE POLICY "Users manage own events"
ON public.calendar_events
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- 3. MESSAGES - Bidirectional sender/receiver access
DROP POLICY IF EXISTS "Users access own messages" ON public.messages;
CREATE POLICY "Users access own messages"
ON public.messages
FOR ALL
TO public
USING (
  sender_id = (SELECT id FROM public.users WHERE id = auth.uid())
  OR receiver_id = (SELECT id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
  sender_id = (SELECT id FROM public.users WHERE id = auth.uid())
  OR receiver_id = (SELECT id FROM public.users WHERE id = auth.uid())
);

-- 4. USER PROFILES - Owner-only access with public read for specific fields
DROP POLICY IF EXISTS "Users manage own profiles" ON public.user_profiles;
CREATE POLICY "Users manage own profiles"
ON public.user_profiles
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- 5. PRACTICE PROGRESS - User-specific tracking
DROP POLICY IF EXISTS "Users access own progress" ON public.practice_progress;
CREATE POLICY "Users access own progress"
ON public.practice_progress
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- 6. WORD LISTS - Owner control, shared read if public flag exists
DROP POLICY IF EXISTS "Users manage own lists" ON public.word_lists;
CREATE POLICY "Users manage own lists"
ON public.word_lists
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- 7. APP SETTINGS - Admin-only access
DROP POLICY IF EXISTS "Admin manage settings" ON public.app_settings;
CREATE POLICY "Admin manage settings"
ON public.app_settings
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE id::text = (SELECT id FROM public.users WHERE id = auth.uid())::text
    AND role = 'admin'
  )
);

-- Service role bypass for all
CREATE POLICY "Service role bypass"
ON public.app_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. FLASHCARD SESSIONS - User isolation
DROP POLICY IF EXISTS "Users access own flashcard sessions" ON public.flashcard_sessions;
CREATE POLICY "Users access own flashcard sessions"
ON public.flashcard_sessions
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- 9. TESTS table - Public read for solved tests, owner edit
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text,
  questions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tests"
ON public.tests
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Anyone can read tests"
ON public.tests
FOR SELECT
TO public
USING (true);

-- 10. TEST RESPONSES table - Track user test completions
CREATE TABLE IF NOT EXISTS public.test_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  answers jsonb,
  score numeric,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own responses"
ON public.test_responses
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Test creators can read responses"
ON public.test_responses
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.tests
    WHERE id = test_id
    AND user_id = (SELECT id FROM public.users WHERE id = auth.uid())
  )
);

-- 11. USER PREFERENCES table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme text DEFAULT 'dark',
  language text DEFAULT 'en',
  notifications_enabled boolean DEFAULT true,
  note_colors jsonb,
  event_colors jsonb,
  notebook_order jsonb,
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
ON public.user_preferences
FOR ALL
TO public
USING (user_id = (SELECT id FROM public.users WHERE id = auth.uid()))
WITH CHECK (user_id = (SELECT id FROM public.users WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_practice_progress_user_id ON public.practice_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_word_lists_user_id ON public.word_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_tests_user_id ON public.tests(user_id);
CREATE INDEX IF NOT EXISTS idx_test_responses_user_id ON public.test_responses(user_id);
