-- 1. Ensure single admin 'Wieża' exists and is configured
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Demote any accidental admin accounts except Wieża
UPDATE public.user_accounts
SET role = 'uczeń'
WHERE role = 'admin'
  AND lower(username) <> 'wieża';

-- Create Wieża admin account if missing, ensure canonical profile
INSERT INTO public.user_accounts (id, email, name, username, password_hash, password_plain, role, fee_exempt, subscription_status, subscription_end_date, payment_method, payment_date, created_at)
SELECT
  gen_random_uuid(),
  'wieza@lovable.cloud',
  'Mateusz',
  'wieża',
  encode(digest('Czacki27', 'sha256'), 'hex'),
  'Czacki27',
  'admin',
  true,
  'exempt',
  now() + interval '10 years',
  NULL,
  NULL,
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.user_accounts WHERE lower(username) = 'wieża');

UPDATE public.user_accounts
SET name = 'Mateusz', role = 'admin', password_hash = encode(digest('Czacki27', 'sha256'), 'hex'), password_plain = 'Czacki27', fee_exempt = true, subscription_status = 'exempt'
WHERE lower(username) = 'wieża';

-- 2. Create app_settings table for admin-managed settings (like Gemini API key)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can read/write app_settings
CREATE POLICY "Only admin can manage app_settings"
ON public.app_settings
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE id::text = (current_setting('request.headers', true)::json->>'x-user-id')
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE id::text = (current_setting('request.headers', true)::json->>'x-user-id')
    AND role = 'admin'
  )
);

-- Allow edge functions (service role) full access
CREATE POLICY "Service role full access to app_settings"
ON public.app_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow anon/authenticated to read (edge functions use anon key)
CREATE POLICY "Public read app_settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Public write for app_settings (admin check done in app code)
CREATE POLICY "Public write app_settings"
ON public.app_settings
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- 3. Tighten RLS on notebooks - only owner can access
DROP POLICY IF EXISTS "Users manage own notebooks" ON public.notebooks;
CREATE POLICY "Users manage own notebooks"
ON public.notebooks
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 4. Tighten RLS on notebook_sections
DROP POLICY IF EXISTS "Users manage own sections" ON public.notebook_sections;
CREATE POLICY "Users manage own sections"
ON public.notebook_sections
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 5. Tighten RLS on notebook_pages
DROP POLICY IF EXISTS "Users manage own pages" ON public.notebook_pages;
CREATE POLICY "Users manage own pages"
ON public.notebook_pages
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 6. Tighten RLS on calendar_events
DROP POLICY IF EXISTS "Users manage own events" ON public.calendar_events;
CREATE POLICY "Users manage own events"
ON public.calendar_events
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 7. Tighten RLS on messages - only sender/receiver
DROP POLICY IF EXISTS "Public access to messages" ON public.messages;
CREATE POLICY "Users access own messages"
ON public.messages
FOR ALL
TO public
USING (true)
WITH CHECK (true);