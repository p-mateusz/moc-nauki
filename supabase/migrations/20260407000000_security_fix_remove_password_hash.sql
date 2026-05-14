-- Security fix: Remove password_hash from user_accounts and migrate to Supabase Auth
-- Password hashes should never be stored in application tables readable by users

-- 1. Add user_id column linking to Supabase Auth users
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. Remove password_hash column
ALTER TABLE public.user_accounts DROP COLUMN IF EXISTS password_hash;

-- 3. Update user_accounts_public view to exclude sensitive data
DROP VIEW IF EXISTS public.user_accounts_public;
CREATE VIEW public.user_accounts_public 
WITH (security_invoker = true)
AS SELECT 
  id, user_id, name, username, email, role, created_at, 
  fee_exempt, subscription_status, subscription_end_date
FROM public.user_accounts;

-- Note: payment_method and payment_date excluded as they are sensitive payment data
-- If needed for admin purposes, create a separate admin view with proper access control

-- 4. Add RLS policy for user_accounts - allow owners to read their own non-sensitive data
-- But since we use views, and direct table access should be restricted
DROP POLICY IF EXISTS "Users can read own account" ON public.user_accounts;
CREATE POLICY "Users can read own account"
ON public.user_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- But this would allow reading all columns, including if any sensitive remain
-- Better to not have direct access, only through views

-- Actually, drop this policy and ensure no direct access
DROP POLICY IF EXISTS "Users can read own account" ON public.user_accounts;

-- Only service role can access the table directly
-- Clients use the view