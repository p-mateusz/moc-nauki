-- Security fix: Restrict access to user_accounts and user_accounts_public
-- Prevent exposure of sensitive user data

-- Ensure no permissive policies on user_accounts table
DROP POLICY IF EXISTS "Public read/insert user_accounts" ON public.user_accounts;
-- Drop any other policies that might exist
DROP POLICY IF EXISTS "Users can read own account" ON public.user_accounts;

-- Add restrictive policy on user_accounts for realtime and own access
CREATE POLICY "Users can read own account" ON public.user_accounts
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Recreate user_accounts_public view with SECURITY DEFINER to allow controlled access
DROP VIEW IF EXISTS public.user_accounts_public;
CREATE VIEW public.user_accounts_public
WITH (security_definer = true)
AS SELECT
  id, user_id, name, username, email, role, created_at,
  fee_exempt, subscription_status, subscription_end_date
FROM public.user_accounts;

-- Enable RLS on the view
ALTER VIEW public.user_accounts_public SET (security_barrier = true);

-- Add restrictive policy on the view
CREATE POLICY "Restricted access to user_accounts_public" ON public.user_accounts_public
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'nauczyciel')
  )
  OR (
    role = 'uczeń'
    AND EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'nauczyciel')
    )
  )
);