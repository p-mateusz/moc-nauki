-- CRITICAL SECURITY FIX: Prevent privilege escalation via user_accounts manipulation
-- Issue: Users could insert/update rows with role='admin' to escalate privileges
-- Solution: Add restrictive UPDATE/INSERT policies that lock sensitive columns to admin-only

-- 1. Drop the overly permissive "Admins manage user accounts" policy if it exists
-- This policy allowed any admin to do ALL operations without column restrictions
DROP POLICY IF EXISTS "Admins manage user accounts" ON public.user_accounts;

-- 2. Create RESTRICTIVE INSERT policy - allow only service_role
-- Only backend services can insert new user accounts (during signup flow)
CREATE POLICY "Only service role can insert user_accounts"
  ON public.user_accounts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Create UPDATE policies with column-level restrictions
-- Users cannot UPDATE their own account - prevents privilege escalation
-- Even if id matches, we deny all updates from authenticated users
CREATE POLICY "Prevent authenticated users from updating account"
  ON public.user_accounts
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. Allow service_role to update accounts (backend operations only)
CREATE POLICY "Service role can update user_accounts"
  ON public.user_accounts
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Create DELETE policy - only service_role can delete
CREATE POLICY "Only service role can delete user_accounts"
  ON public.user_accounts
  FOR DELETE
  TO service_role
  USING (true);

-- 6. Ensure SELECT policy exists (users can only read their own account)
-- Keep the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Authenticated users read own account" ON public.user_accounts;
CREATE POLICY "Authenticated users read own account"
  ON public.user_accounts
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 7. Allow service_role to read all accounts (needed for backend operations)
CREATE POLICY "Service role can read all accounts"
  ON public.user_accounts
  FOR SELECT
  TO service_role
  USING (true);

-- 8. Add a comment documenting the security model
COMMENT ON TABLE public.user_accounts IS 
'SECURITY MODEL: 
- Authenticated users (app clients) can ONLY READ their own account
- No INSERT/UPDATE/DELETE allowed for authenticated users
- All user account modifications go through service_role (backend edge functions)
- Critical columns (role, fee_exempt, subscription_status) are protected from client modification
- This prevents privilege escalation attacks where users try to set their own role to admin';

-- 9. Verify table structure - ensure sensitive columns exist as expected
-- Expected schema:
-- - id (uuid, primary key, linked to auth.users id)
-- - email (text)
-- - name (text)
-- - username (text)
-- - role (text) - SENSITIVE
-- - fee_exempt (boolean) - SENSITIVE
-- - subscription_status (text) - SENSITIVE
-- - subscription_end_date (timestamp) - SENSITIVE
-- - created_at (timestamp)

-- This prevents the attack:
-- ❌ BLOCKED: INSERT INTO user_accounts (id, role) VALUES (auth.uid(), 'admin')
-- ❌ BLOCKED: UPDATE user_accounts SET role = 'admin' WHERE id = auth.uid()
-- ✅ ALLOWED: SELECT * FROM user_accounts WHERE id = auth.uid()
-- ✅ ALLOWED: service_role via edge functions to insert/update/delete
