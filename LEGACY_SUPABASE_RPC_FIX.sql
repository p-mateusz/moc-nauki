-- =====================================================================
-- WAŻNE: Uruchom ten skrypt w SQL Editor STAREGO projektu Supabase:
-- https://supabase.com/dashboard/project/yjlelwsmmrqvlsfcnxru/sql/new
--
-- Tworzy 4 funkcje SECURITY DEFINER, które omijają restrykcyjne RLS
-- na tabeli `tests` i pozwalają każdemu zalogowanemu użytkownikowi:
--   - polubić / odlubić cudzy test
--   - zwiększyć licznik użyć
--   - dodać / usunąć rozwiązanie
-- =====================================================================

-- 1) Polubienia
CREATE OR REPLACE FUNCTION public.toggle_test_like(p_test_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid text;
  cur text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  uid := auth.uid()::text;
  SELECT likes INTO cur FROM tests WHERE id = p_test_id;
  IF cur IS NULL THEN RAISE EXCEPTION 'Test not found'; END IF;
  IF uid = ANY(cur) THEN
    UPDATE tests SET likes = array_remove(cur, uid) WHERE id = p_test_id;
  ELSE
    UPDATE tests SET likes = array_append(cur, uid) WHERE id = p_test_id;
  END IF;
END;
$$;

-- 2) Licznik użyć
CREATE OR REPLACE FUNCTION public.increment_test_uses(p_test_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE tests SET uses = COALESCE(uses,0) + 1 WHERE id = p_test_id;
END;
$$;

-- 3) Dodanie rozwiązania
CREATE OR REPLACE FUNCTION public.add_test_solution(
  p_test_id uuid,
  p_author_name text,
  p_content text,
  p_images text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  cur jsonb;
  new_sol jsonb;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT solutions INTO cur FROM tests WHERE id = p_test_id;
  IF cur IS NULL THEN cur := '[]'::jsonb; END IF;
  new_sol := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'author_id', uid::text,
    'author_name', p_author_name,
    'content', COALESCE(p_content,''),
    'images', COALESCE(to_jsonb(p_images), '[]'::jsonb),
    'confirmed', false,
    'created_at', now()::text,
    'ts', extract(epoch from now()) * 1000
  );
  UPDATE tests SET solutions = cur || jsonb_build_array(new_sol) WHERE id = p_test_id;
END;
$$;

-- 4) Usunięcie rozwiązania (autor rozwiązania lub admin)
CREATE OR REPLACE FUNCTION public.delete_test_solution(
  p_test_id uuid,
  p_solution_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid text;
  cur jsonb;
  new_arr jsonb;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  uid := auth.uid()::text;
  SELECT (role = 'admin') INTO is_admin FROM user_accounts WHERE id = auth.uid();
  SELECT solutions INTO cur FROM tests WHERE id = p_test_id;
  IF cur IS NULL THEN RETURN; END IF;
  SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) INTO new_arr
  FROM jsonb_array_elements(cur) s
  WHERE NOT (
    (s->>'id') = p_solution_id
    AND ((s->>'author_id') = uid OR COALESCE(is_admin,false))
  );
  UPDATE tests SET solutions = new_arr WHERE id = p_test_id;
END;
$$;

-- 5) Uprawnienia EXECUTE dla zalogowanych użytkowników
GRANT EXECUTE ON FUNCTION public.toggle_test_like(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_test_uses(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_test_solution(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_test_solution(uuid, text) TO authenticated;

-- 6) Odśwież cache PostgREST, żeby od razu zobaczył nowe funkcje
NOTIFY pgrst, 'reload schema';
