CREATE TABLE IF NOT EXISTS public.user_calendar_feeds (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_feeds TO authenticated;
GRANT ALL ON public.user_calendar_feeds TO service_role;
ALTER TABLE public.user_calendar_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own feed" ON public.user_calendar_feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own feed" ON public.user_calendar_feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own feed" ON public.user_calendar_feeds FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own feed" ON public.user_calendar_feeds FOR DELETE USING (auth.uid() = user_id);