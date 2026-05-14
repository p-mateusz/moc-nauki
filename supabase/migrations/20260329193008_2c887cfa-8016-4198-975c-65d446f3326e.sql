-- Update default notebook creation to use requested names and default sections
CREATE OR REPLACE FUNCTION public.create_default_notebooks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nb_id_en uuid;
  nb_id_pl uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.notebooks WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.notebooks (user_id, name, color, subject, sort_order)
  VALUES (p_user_id, 'Angielski', '#3b82f6', 'Angielski', 0)
  RETURNING id INTO nb_id_en;

  INSERT INTO public.notebook_sections (notebook_id, name, sort_order)
  VALUES (nb_id_en, 'Nowa sekcja', 0);

  INSERT INTO public.notebooks (user_id, name, color, subject, sort_order)
  VALUES (p_user_id, 'Polski', '#f87171', 'Język polski', 1)
  RETURNING id INTO nb_id_pl;

  INSERT INTO public.notebook_sections (notebook_id, name, sort_order)
  VALUES (nb_id_pl, 'Nowa sekcja', 0);
END;
$function$;

-- Rename existing default Polish notebook if present
UPDATE public.notebooks
SET name = 'Polski'
WHERE name = 'Język polski';

-- Ensure every notebook has at least one default section
INSERT INTO public.notebook_sections (notebook_id, name, sort_order)
SELECT n.id, 'Nowa sekcja', 0
FROM public.notebooks n
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notebook_sections s
  WHERE s.notebook_id = n.id
);