CREATE POLICY "Anon read shared word_lists"
ON public.word_lists
FOR SELECT
TO anon
USING (share_slug IS NOT NULL);

CREATE POLICY "Anon read shared words"
ON public.words
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.word_lists wl
    WHERE wl.id = words.list_id AND wl.share_slug IS NOT NULL
  )
);

CREATE POLICY "Anon read shared generated_sentences"
ON public.generated_sentences
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.word_lists wl
    WHERE wl.id = generated_sentences.list_id AND wl.share_slug IS NOT NULL
  )
);