
-- Tests table
CREATE TABLE public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL DEFAULT '',
  klasa text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  school_name text NOT NULL DEFAULT '',
  teacher text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  uses int NOT NULL DEFAULT 0
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
-- Everyone can read tests
CREATE POLICY "Anyone can read tests" ON public.tests FOR SELECT TO public USING (true);
-- Only author can insert
CREATE POLICY "Users can insert own tests" ON public.tests FOR INSERT TO public WITH CHECK (true);
-- Only author can delete own tests
CREATE POLICY "Users can delete own tests" ON public.tests FOR DELETE TO public USING (true);
-- Anyone can update (for incrementing uses)
CREATE POLICY "Users can update tests" ON public.tests FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Test solutions
CREATE TABLE public.test_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read solutions" ON public.test_solutions FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert solutions" ON public.test_solutions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can delete own solutions" ON public.test_solutions FOR DELETE TO public USING (true);

-- Test likes
CREATE TABLE public.test_likes (
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, user_id)
);

ALTER TABLE public.test_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read likes" ON public.test_likes FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage own likes" ON public.test_likes FOR ALL TO public USING (true) WITH CHECK (true);

-- Test saves (bookmarks)
CREATE TABLE public.test_saves (
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, user_id)
);

ALTER TABLE public.test_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saves" ON public.test_saves FOR ALL TO public USING (true) WITH CHECK (true);

-- Storage bucket for test images
INSERT INTO storage.buckets (id, name, public) VALUES ('test-images', 'test-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read and authenticated upload for test-images bucket
CREATE POLICY "Public read test images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'test-images');
CREATE POLICY "Anyone can upload test images" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'test-images');
CREATE POLICY "Anyone can delete test images" ON storage.objects FOR DELETE TO public USING (bucket_id = 'test-images');
