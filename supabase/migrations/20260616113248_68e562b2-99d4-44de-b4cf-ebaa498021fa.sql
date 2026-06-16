DROP POLICY IF EXISTS "Send messages" ON public.messages;

CREATE POLICY "Send messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
      public.get_user_role(auth.uid()) = 'uczeń'
      AND public.get_user_role(receiver_id) IN ('nauczyciel', 'admin')
    )
    OR (
      public.get_user_role(auth.uid()) = 'nauczyciel'
      AND public.get_user_role(receiver_id) IN ('uczeń', 'admin')
    )
  )
);