
-- 1) Freeze email field on user_accounts UPDATE to prevent identity hijacking
DROP POLICY IF EXISTS "Users update own account safe fields" ON public.user_accounts;
CREATE POLICY "Users update own account safe fields" ON public.user_accounts
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND email = (SELECT u.email FROM public.user_accounts u WHERE u.id = auth.uid())
  AND role = (SELECT u.role FROM public.user_accounts u WHERE u.id = auth.uid())
  AND fee_exempt = (SELECT u.fee_exempt FROM public.user_accounts u WHERE u.id = auth.uid())
  AND subscription_status = (SELECT u.subscription_status FROM public.user_accounts u WHERE u.id = auth.uid())
  AND NOT (subscription_end_date IS DISTINCT FROM (SELECT u.subscription_end_date FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (subscription_expires_at IS DISTINCT FROM (SELECT u.subscription_expires_at FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (subscription_plan IS DISTINCT FROM (SELECT u.subscription_plan FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (stripe_customer_id IS DISTINCT FROM (SELECT u.stripe_customer_id FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (stripe_subscription_id IS DISTINCT FROM (SELECT u.stripe_subscription_id FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND cancel_at_period_end = (SELECT u.cancel_at_period_end FROM public.user_accounts u WHERE u.id = auth.uid())
  AND NOT (payment_method IS DISTINCT FROM (SELECT u.payment_method FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (payment_date IS DISTINCT FROM (SELECT u.payment_date FROM public.user_accounts u WHERE u.id = auth.uid()))
);

-- 2) Restrict EXECUTE on SECURITY DEFINER functions to authenticated only
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_default_calendars(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_default_reminder_lists(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_default_notebooks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_calendars(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_reminder_lists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_notebooks(uuid) TO authenticated;

-- Add ownership enforcement inside the seeding functions so callers can only seed their own data
CREATE OR REPLACE FUNCTION public.create_default_calendars(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM user_calendars WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO user_calendars (user_id, name, color, sort_order) VALUES
    (p_user_id, 'Osobisty', '#6366f1', 0),
    (p_user_id, 'Szkoła', '#34d399', 1),
    (p_user_id, 'Praca', '#f472b6', 2),
    (p_user_id, 'Święta', '#fbbf24', 3),
    (p_user_id, 'Urodziny', '#e879f9', 4);
END; $$;

CREATE OR REPLACE FUNCTION public.create_default_reminder_lists(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM reminder_lists WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO reminder_lists (user_id, quadrant, name, color) VALUES
    (p_user_id, 1, 'Pilne i ważne', '#f87171'),
    (p_user_id, 2, 'Ważne, niepilne', '#fbbf24'),
    (p_user_id, 3, 'Pilne, nieważne', '#3b82f6'),
    (p_user_id, 4, 'Niepilne, nieważne', '#8b8b8b');
END; $$;

CREATE OR REPLACE FUNCTION public.create_default_notebooks(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  nb_id_pl uuid;
  nb_id_en uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM notebooks WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO notebooks (user_id, name, color, subject) VALUES (p_user_id, 'Język polski', '#f87171', 'Język polski') RETURNING id INTO nb_id_pl;
  INSERT INTO notebook_sections (notebook_id, name) VALUES (nb_id_pl, 'Lekcje');
  INSERT INTO notebooks (user_id, name, color, subject) VALUES (p_user_id, 'Angielski', '#3b82f6', 'Angielski') RETURNING id INTO nb_id_en;
  INSERT INTO notebook_sections (notebook_id, name) VALUES (nb_id_en, 'Lekcje');
END; $$;

-- 3) Tighten avatars storage SELECT policy: restrict listing to authenticated users only.
-- (Public asset display continues to work via the public object URL, which bypasses RLS.)
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars authenticated read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
