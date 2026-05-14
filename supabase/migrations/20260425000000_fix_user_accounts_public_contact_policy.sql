-- Fix student contact browsing for teacher/admin view and normalize legacy teacher role handling
DROP POLICY IF EXISTS "Restricted access to user_accounts_public" ON public.user_accounts_public;
CREATE POLICY "Restricted access to user_accounts_public" ON public.user_accounts_public
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'nauczyciel', 'teacher')
  )
  OR (
    role IN ('admin', 'nauczyciel', 'teacher')
    AND EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE user_id = auth.uid()
        AND role IN ('uczeń', 'student')
    )
  )
);
