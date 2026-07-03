
-- custom_roles: restrict read to authenticated
DROP POLICY IF EXISTS "Public read roles" ON public.custom_roles;
CREATE POLICY "Authenticated read roles"
  ON public.custom_roles
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.custom_roles FROM anon;

-- user_profiles: restrict read to authenticated (remove anon)
DROP POLICY IF EXISTS "Public read profiles" ON public.user_profiles;
CREATE POLICY "Authenticated read profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.user_profiles FROM anon;

-- users: ensure only authenticated (recreate cleanly), and ensure anon has no SELECT
DROP POLICY IF EXISTS "Public read users" ON public.users;
CREATE POLICY "Authenticated read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.users FROM anon;
