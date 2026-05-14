-- Fix 1: Recreate user_accounts_public view without sensitive payment/subscription fields
DROP VIEW IF EXISTS public.user_accounts_public CASCADE;

CREATE VIEW public.user_accounts_public
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  name,
  role,
  created_at
FROM public.user_accounts;

GRANT SELECT ON public.user_accounts_public TO authenticated, anon;

-- Fix 2: Prevent users from inserting tips with approved=true
DROP POLICY IF EXISTS "Users insert own tips" ON public.tips;

CREATE POLICY "Users insert own tips"
ON public.tips
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND approved = false);