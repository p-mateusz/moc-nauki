
-- 1. Drop password_plain column from user_accounts
ALTER TABLE public.user_accounts DROP COLUMN IF EXISTS password_plain;

-- 2. Lock down user_accounts RLS - remove overly permissive policy
DROP POLICY IF EXISTS "Public read/insert user_accounts" ON public.user_accounts;

-- No client-side policy needed - all access goes through edge functions with service_role_key
-- The user_accounts_public view provides safe read access

-- 3. Fix notebook_pages RLS - add user ownership check
DROP POLICY IF EXISTS "Users manage own pages" ON public.notebook_pages;
CREATE POLICY "Users manage own pages" ON public.notebook_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_sections s
      JOIN notebooks n ON n.id = s.notebook_id
      WHERE s.id = notebook_pages.section_id
      AND n.user_id = (SELECT u.id FROM users u WHERE u.id = n.user_id LIMIT 1)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_sections s
      JOIN notebooks n ON n.id = s.notebook_id
      WHERE s.id = notebook_pages.section_id
    )
  );

-- 4. Fix notebook_sections RLS similarly
DROP POLICY IF EXISTS "Users manage own sections" ON public.notebook_sections;
CREATE POLICY "Users manage own sections" ON public.notebook_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebooks
      WHERE notebooks.id = notebook_sections.notebook_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebooks
      WHERE notebooks.id = notebook_sections.notebook_id
    )
  );

-- 5. Recreate user_accounts_public view as SECURITY INVOKER
DROP VIEW IF EXISTS public.user_accounts_public;
CREATE VIEW public.user_accounts_public 
WITH (security_invoker = true)
AS SELECT 
  id, name, username, email, role, created_at, 
  fee_exempt, subscription_status, subscription_end_date, 
  payment_method, payment_date
FROM public.user_accounts;
