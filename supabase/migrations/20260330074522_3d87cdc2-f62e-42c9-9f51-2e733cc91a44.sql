
-- Table to cache generated sentences per word (so they don't need regeneration)
CREATE TABLE public.generated_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id uuid NOT NULL,
  list_id uuid NOT NULL,
  sentence text NOT NULL,
  hint text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_gs_word FOREIGN KEY (word_id) REFERENCES public.words(id) ON DELETE CASCADE,
  CONSTRAINT fk_gs_list FOREIGN KEY (list_id) REFERENCES public.word_lists(id) ON DELETE CASCADE
);

CREATE INDEX idx_generated_sentences_list ON public.generated_sentences(list_id);
CREATE INDEX idx_generated_sentences_word ON public.generated_sentences(word_id);

ALTER TABLE public.generated_sentences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access generated_sentences" ON public.generated_sentences FOR ALL TO public USING (true) WITH CHECK (true);

-- Table to persist flashcard session state so users can resume
CREATE TABLE public.flashcard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'word-first',
  remaining_word_ids uuid[] NOT NULL DEFAULT '{}',
  current_index int NOT NULL DEFAULT 0,
  learned_count int NOT NULL DEFAULT 0,
  unknown_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_fs_list FOREIGN KEY (list_id) REFERENCES public.word_lists(id) ON DELETE CASCADE,
  CONSTRAINT uq_fs_user_list UNIQUE (user_id, list_id)
);

ALTER TABLE public.flashcard_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access flashcard_sessions" ON public.flashcard_sessions FOR ALL TO public USING (true) WITH CHECK (true);

-- Also add a word column to generated_sentences for easier lookup
ALTER TABLE public.generated_sentences ADD COLUMN word text NOT NULL DEFAULT '';
ALTER TABLE public.generated_sentences ADD COLUMN definition text NOT NULL DEFAULT '';
