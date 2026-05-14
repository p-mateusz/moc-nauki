-- Short share slugs for word lists
ALTER TABLE public.word_lists ADD COLUMN IF NOT EXISTS share_slug text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_word_lists_share_slug ON public.word_lists (share_slug);