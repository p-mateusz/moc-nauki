-- Security fix: Restrict test updates to owner only
-- The previous 'Authenticated update tests' policy allowed any authenticated user to modify any test
-- This patch fixes the vulnerability by requiring ownership (auth.uid() = user_id)

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated update tests" ON public.tests;

-- Create restrictive policy: only the test owner can update their test
CREATE POLICY "Owner update tests" ON public.tests
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: If you need other users to modify specific fields (e.g., increment likes/uses),
-- use edge functions or database triggers instead of direct RLS policies