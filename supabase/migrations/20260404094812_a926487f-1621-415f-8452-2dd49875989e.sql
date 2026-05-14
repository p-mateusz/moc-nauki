
-- 1. Add sort_order to notebooks
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read app_settings" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "Public write app_settings" ON public.app_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Create flashcard_sessions table
CREATE TABLE IF NOT EXISTS public.flashcard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.word_lists(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'classic',
  remaining_word_ids text[] NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0,
  learned_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, list_id)
);
ALTER TABLE public.flashcard_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access flashcard_sessions" ON public.flashcard_sessions FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Create generated_sentences table
CREATE TABLE IF NOT EXISTS public.generated_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.word_lists(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  word text NOT NULL,
  definition text DEFAULT '',
  sentence text NOT NULL DEFAULT '',
  hint text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.generated_sentences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access generated_sentences" ON public.generated_sentences FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Create tests table
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL DEFAULT '',
  klasa text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  school_name text NOT NULL DEFAULT '',
  teacher text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  questions jsonb NOT NULL DEFAULT '[]',
  author_id text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  likes text[] NOT NULL DEFAULT '{}',
  uses integer NOT NULL DEFAULT 0,
  solutions jsonb NOT NULL DEFAULT '[]',
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access tests" ON public.tests FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Create test_saves table
CREATE TABLE IF NOT EXISTS public.test_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, test_id)
);
ALTER TABLE public.test_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access test_saves" ON public.test_saves FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Create user_accounts_public view (read-only safe view of user_accounts)
CREATE OR REPLACE VIEW public.user_accounts_public AS
  SELECT id, name, username, email, role, created_at, fee_exempt, subscription_status, subscription_end_date, payment_method, payment_date
  FROM public.user_accounts;
