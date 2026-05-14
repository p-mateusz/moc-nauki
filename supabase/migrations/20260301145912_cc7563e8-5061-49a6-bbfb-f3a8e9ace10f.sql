
-- Users table (identified by name only)
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Word lists table
CREATE TABLE public.word_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  special_instructions TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.word_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to word_lists" ON public.word_lists FOR ALL USING (true) WITH CHECK (true);

-- Words table
CREATE TABLE public.words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.word_lists(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  definition TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to words" ON public.words FOR ALL USING (true) WITH CHECK (true);

-- Practice progress table
CREATE TABLE public.practice_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.word_lists(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  mastered BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, word_id)
);

ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to practice_progress" ON public.practice_progress FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_practice_progress_updated_at
  BEFORE UPDATE ON public.practice_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
