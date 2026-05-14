ALTER TABLE public.notebook_sections DROP CONSTRAINT IF EXISTS notebook_sections_notebook_id_fkey;
ALTER TABLE public.notebook_pages DROP CONSTRAINT IF EXISTS notebook_pages_section_id_fkey;

DELETE FROM public.notebook_sections
WHERE notebook_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_sections.notebook_id);

DELETE FROM public.notebook_pages
WHERE section_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.notebook_sections s WHERE s.id = notebook_pages.section_id);

ALTER TABLE public.notebook_sections
  ADD CONSTRAINT notebook_sections_notebook_id_fkey
  FOREIGN KEY (notebook_id) REFERENCES public.notebooks(id) ON DELETE CASCADE;

ALTER TABLE public.notebook_pages
  ADD CONSTRAINT notebook_pages_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES public.notebook_sections(id) ON DELETE CASCADE;