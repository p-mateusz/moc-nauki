-- Security fix: Correct get_user_role function and secure user_accounts_public view
-- Fix incorrect id vs user_id usage and prevent data exposure

-- 1. Fix get_user_role function to use user_id instead of id
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_accounts WHERE user_id = uid
$$;

-- 2. Fix user_accounts SELECT policy to use user_id
DROP POLICY IF EXISTS "Users read own account" ON public.user_accounts;
CREATE POLICY "Users read own account"
  ON public.user_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Recreate user_accounts_public view with SECURITY DEFINER and exclude sensitive payment data
DROP VIEW IF EXISTS public.user_accounts_public;
CREATE VIEW public.user_accounts_public
WITH (security_definer = true)
AS SELECT
  id, user_id, name, username, email, role, created_at,
  fee_exempt, subscription_status, subscription_end_date
FROM public.user_accounts;

-- Enable RLS on the view
ALTER VIEW public.user_accounts_public SET (security_barrier = true);

-- Revoke grants to prevent public access
REVOKE SELECT ON public.user_accounts_public FROM anon, authenticated;

-- Add restrictive policy on the view
DROP POLICY IF EXISTS "Restricted access to user_accounts_public" ON public.user_accounts_public;
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

-- 4. Add INSERT/UPDATE/DELETE policies for user_accounts (admin-only for modifications)
CREATE POLICY "Admins manage user accounts"
  ON public.user_accounts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_accounts WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_accounts WHERE user_id = auth.uid() AND role = 'admin'));