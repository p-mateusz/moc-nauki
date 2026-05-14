CREATE POLICY "Owner update generated_sentences"
ON public.generated_sentences
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = generated_sentences.list_id AND word_lists.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM word_lists WHERE word_lists.id = generated_sentences.list_id AND word_lists.user_id = auth.uid()));