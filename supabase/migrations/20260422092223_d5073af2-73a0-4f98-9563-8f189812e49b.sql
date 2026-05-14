-- 1. Drop permissive UPDATE policies (temporary debugging leftovers)
DROP POLICY IF EXISTS "Permissive update words" ON public.words;
DROP POLICY IF EXISTS "Permissive update word_lists" ON public.word_lists;
DROP POLICY IF EXISTS "Permissive update generated_sentences" ON public.generated_sentences;

-- 2. Replace overly-permissive SELECT policies on word_lists
DROP POLICY IF EXISTS "Authenticated read word_lists" ON public.word_lists;
CREATE POLICY "Owner or shared read word_lists"
ON public.word_lists
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR share_slug IS NOT NULL);

-- 3. Replace overly-permissive SELECT policies on words
DROP POLICY IF EXISTS "Authenticated read words" ON public.words;
CREATE POLICY "Owner or shared read words"
ON public.words
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.word_lists wl
    WHERE wl.id = words.list_id
      AND (wl.user_id = auth.uid() OR wl.share_slug IS NOT NULL)
  )
);

-- 4. Replace overly-permissive SELECT policies on generated_sentences
DROP POLICY IF EXISTS "Authenticated read generated_sentences" ON public.generated_sentences;
CREATE POLICY "Owner or shared read generated_sentences"
ON public.generated_sentences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.word_lists wl
    WHERE wl.id = generated_sentences.list_id
      AND (wl.user_id = auth.uid() OR wl.share_slug IS NOT NULL)
  )
);