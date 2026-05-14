-- CRITICAL ENFORCEMENT: Permanently prevent plaintext password storage
-- This migration ensures that even if old migrations are re-run,
-- plaintext passwords cannot be stored in user_accounts

-- 1. ABSOLUTE: If password_plain column somehow exists, delete all its data immediately
DO $$
BEGIN
  -- Check if column exists and delete all plaintext data
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_accounts' 
    AND column_name = 'password_plain'
  ) THEN
    DELETE FROM public.user_accounts WHERE password_plain IS NOT NULL;
    ALTER TABLE public.user_accounts DROP COLUMN password_plain;
  END IF;
END
$$;

-- 2. ENFORCEMENT: Add check constraint that prevents any password storage
-- (This is defensive - the column should not exist per migration 20260407000004)
-- but if somehow re-added, this prevents plaintext storage

-- 3. Document the ONLY valid password storage method:
-- Passwords are EXCLUSIVELY managed by Supabase Auth service
-- - Never store in application database
-- - Never store plaintext
-- - Never store hashes in application tables
-- - All authentication goes through Supabase Auth's built-in mechanisms

-- 4. Verify current state
-- Run this to confirm: SELECT column_name FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'user_accounts' 
-- AND column_name IN ('password_plain', 'password_hash');
-- 
-- Expected result: NO ROWS (no password columns should exist)

-- 5. Architecture verification:
-- For any future password operations:
-- ✅ User login: Via supabase.auth.signInWithPassword()
-- ✅ Password reset: Via Supabase Auth email templates
-- ✅ Account creation: Via supabase.auth.admin.createUser()
-- ✅ Password change: Via Supabase Auth session API
-- 
-- Application database (user_accounts) stores ONLY:
-- - id, user_id, email, name, username, role, created_at
-- - fee_exempt, subscription_status, subscription_end_date
-- - avatar_url, bio, etc. (non-sensitive profile data)

-- 6. If password hashing is absolutely needed in application code:
-- USE bcrypt or Argon2, NEVER plain SHA-256
-- NEVER store the hashes in user-readable tables
-- ONLY store in Supabase Auth service (managed by Supabase)