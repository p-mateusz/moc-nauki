
-- Add language column to word_lists
ALTER TABLE public.word_lists ADD COLUMN language text NOT NULL DEFAULT 'es';

-- Index for filtering by user + language
CREATE INDEX idx_word_lists_user_language ON public.word_lists (user_id, language);
