
CREATE TABLE public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved tips" ON public.tips
  FOR SELECT TO public USING (approved = true OR user_id::text = user_id::text);

CREATE POLICY "Anyone can insert tips" ON public.tips
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update tips" ON public.tips
  FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete tips" ON public.tips
  FOR DELETE TO public USING (true);
