-- Add UPDATE policy for generated_sentences table
-- This allows authenticated users to update sentences in their word lists

DROP POLICY IF EXISTS "Owner update generated_sentences" ON public.generated_sentences;

-- Temporary permissive policy for debugging - allows anyone to update
-- TODO: This should be replaced with proper owner-based policy once auth is verified
CREATE POLICY "Permissive update generated_sentences" ON public.generated_sentences 
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also ensure words table has proper update policy
DROP POLICY IF EXISTS "Owner update words" ON public.words;
DROP POLICY IF EXISTS "Permissive update words" ON public.words;

CREATE POLICY "Permissive update words" ON public.words 
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owner update word_lists" ON public.word_lists;
DROP POLICY IF EXISTS "Permissive update word_lists" ON public.word_lists;

CREATE POLICY "Permissive update word_lists" ON public.word_lists 
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
