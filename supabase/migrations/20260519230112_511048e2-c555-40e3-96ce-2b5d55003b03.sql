
-- 1) Fix tips UPDATE policy: prevent owners from modifying already-approved tips
DROP POLICY IF EXISTS "Admin or owner update tips" ON public.tips;

CREATE POLICY "Admin or owner update tips"
ON public.tips
FOR UPDATE
TO authenticated
USING (
  ((auth.uid() = user_id) AND (approved = false))
  OR EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE user_accounts.id = auth.uid() AND user_accounts.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE user_accounts.id = auth.uid() AND user_accounts.role = 'admin'
  )
  OR ((auth.uid() = user_id) AND (approved = false))
);

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from anon/public
REVOKE EXECUTE ON FUNCTION public.create_default_calendars(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_default_reminder_lists(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_default_notebooks(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_test_solution(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_test_solution(uuid, text, text, text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.toggle_test_like(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_test_uses(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_default_calendars(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_reminder_lists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_notebooks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_test_solution(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_test_solution(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_test_like(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_test_uses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
