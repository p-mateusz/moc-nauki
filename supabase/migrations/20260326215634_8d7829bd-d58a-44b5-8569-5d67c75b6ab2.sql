
-- Eisenhower matrix reminder lists (4 fixed groups per user)
CREATE TABLE public.reminder_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quadrant integer NOT NULL CHECK (quadrant >= 1 AND quadrant <= 4),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quadrant)
);

ALTER TABLE public.reminder_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to reminder_lists" ON public.reminder_lists
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Individual reminders
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.reminder_lists(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  due_date text DEFAULT NULL,
  priority integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to reminders" ON public.reminders
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Function to create default Eisenhower lists for a user
CREATE OR REPLACE FUNCTION public.create_default_reminder_lists(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reminder_lists WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  
  INSERT INTO reminder_lists (user_id, quadrant, name, color) VALUES
    (p_user_id, 1, 'Pilne, ważne', '#f87171'),
    (p_user_id, 2, 'Niepilne, ważne', '#fbbf24'),
    (p_user_id, 3, 'Pilne, nieważne', '#3b82f6'),
    (p_user_id, 4, 'Niepilne, nieważne', '#8b8b8b');
END;
$$;
