ALTER TABLE public.word_lists ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_word_lists_user_draft ON public.word_lists(user_id, is_draft);