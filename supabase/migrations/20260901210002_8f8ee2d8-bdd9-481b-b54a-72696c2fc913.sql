DROP POLICY IF EXISTS "Public read registration flag" ON public.app_settings;
CREATE POLICY "Public read registration flag"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('registration_enabled', 'lock_community_tabs', 'all_fee_exempt'));