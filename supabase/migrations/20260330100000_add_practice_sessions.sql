-- Add practice_sessions table to track user progress during practice mode
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  user_id uuid NOT NULL,
  list_id uuid NOT NULL,
  current_word_index integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  incorrect_count integer NOT NULL DEFAULT 0,
  session_data text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, list_id),
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  FOREIGN KEY (list_id) REFERENCES public.word_lists(id) ON DELETE CASCADE
);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own practice sessions
CREATE POLICY "Users access own practice sessions"
ON public.practice_sessions
FOR ALL
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Service role can access all
CREATE POLICY "Service role access practice sessions"
ON public.practice_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_list
ON public.practice_sessions(user_id, list_id);
