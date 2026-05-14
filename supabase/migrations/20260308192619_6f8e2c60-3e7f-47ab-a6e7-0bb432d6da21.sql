
-- Notebooks table
CREATE TABLE public.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  subject text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notebook sections
CREATE TABLE public.notebook_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notebook pages
CREATE TABLE public.notebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.notebook_sections(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nowa strona',
  content text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz NOT NULL DEFAULT now()
);

-- Calendar events
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'inne',
  subject text NOT NULL DEFAULT '',
  date text NOT NULL,
  time text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  source text,
  source_title text,
  auto_added boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Notebooks: user can CRUD own
CREATE POLICY "Users manage own notebooks" ON public.notebooks FOR ALL USING (user_id = (SELECT id FROM public.users WHERE id = user_id)) WITH CHECK (true);

-- Sections: user can CRUD if owns notebook
CREATE POLICY "Users manage own sections" ON public.notebook_sections FOR ALL USING (
  EXISTS (SELECT 1 FROM public.notebooks WHERE notebooks.id = notebook_sections.notebook_id)
) WITH CHECK (true);

-- Pages: user can CRUD if owns section's notebook
CREATE POLICY "Users manage own pages" ON public.notebook_pages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.notebook_sections s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_pages.section_id)
) WITH CHECK (true);

-- Calendar events: user can CRUD own
CREATE POLICY "Users manage own events" ON public.calendar_events FOR ALL USING (user_id = (SELECT id FROM public.users WHERE id = user_id)) WITH CHECK (true);

-- Default notebooks function
CREATE OR REPLACE FUNCTION public.create_default_notebooks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nb_id_pl uuid;
  nb_id_en uuid;
BEGIN
  -- Check if user already has notebooks
  IF EXISTS (SELECT 1 FROM notebooks WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  
  INSERT INTO notebooks (user_id, name, color, subject) VALUES (p_user_id, 'Język polski', '#f87171', 'Język polski') RETURNING id INTO nb_id_pl;
  INSERT INTO notebook_sections (notebook_id, name) VALUES (nb_id_pl, 'Lekcje');
  
  INSERT INTO notebooks (user_id, name, color, subject) VALUES (p_user_id, 'Angielski', '#3b82f6', 'Angielski') RETURNING id INTO nb_id_en;
  INSERT INTO notebook_sections (notebook_id, name) VALUES (nb_id_en, 'Lekcje');
END;
$$;
