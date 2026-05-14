-- Security fix: Ensure plaintext passwords are completely removed
-- The password_plain column stores raw user passwords and must never be present

-- 1. Clear any plaintext password data that may have been stored via seed migrations
-- This prevents plaintext passwords from being exposed even if migration order changes
DELETE FROM public.user_accounts
WHERE password_plain IS NOT NULL;

-- 2. Ensure password_plain column is dropped (redundant safety check)
ALTER TABLE public.user_accounts DROP COLUMN IF EXISTS password_plain;

-- 3. Verify user_accounts only has necessary columns (no plaintext passwords)
-- Columns that should exist: id, user_id, email, name, username, created_at, role, 
-- fee_exempt, subscription_status, subscription_end_date
-- password_hash should NOT exist (already removed in earlier migration)
-- password_plain should NOT exist (removed by this migration)

-- 4. Documentation: Authentication is handled exclusively by Supabase Auth
-- User passwords are:
-- - Created via supabase.auth.admin.createUser() with email + password
-- - Verified by Supabase Auth service (auth-login edge function)
-- - Never stored in user_accounts table
-- - Never transmitted to client layer
-- - Password hashes were removed from user_accounts in migration 20260407000000

-- Note: Seed data migration (20260329194126) attempted to insert password_plain values.
-- This was a security mistake. Passwords should only be stored in Supabase Auth service.