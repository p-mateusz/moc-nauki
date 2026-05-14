-- Add sentences_generating flag to track async sentence generation status
ALTER TABLE public.word_lists ADD COLUMN sentences_generating BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for efficient queries
CREATE INDEX idx_word_lists_sentences_generating ON public.word_lists(sentences_generating) WHERE sentences_generating = true;
