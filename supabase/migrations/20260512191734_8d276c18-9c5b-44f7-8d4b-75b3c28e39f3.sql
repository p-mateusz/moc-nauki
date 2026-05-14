DROP POLICY IF EXISTS "Admin or owner update tips" ON public.tips;

CREATE POLICY "Admin or owner update tips"
ON public.tips
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id) OR (EXISTS (
    SELECT 1 FROM user_accounts
    WHERE user_accounts.id = auth.uid() AND user_accounts.role = 'admin'
  ))
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM user_accounts
    WHERE user_accounts.id = auth.uid() AND user_accounts.role = 'admin'
  ))
  OR (auth.uid() = user_id AND approved = false)
);