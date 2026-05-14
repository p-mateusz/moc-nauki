
-- Create user_calendars table for multiple sub-calendars per user
CREATE TABLE public.user_calendars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendars"
  ON public.user_calendars FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add new columns to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS repeat_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS repeat_end text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS calendar_id uuid REFERENCES public.user_calendars(id) ON DELETE SET NULL;

-- Create function to create default calendars for a user
CREATE OR REPLACE FUNCTION public.create_default_calendars(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_calendars WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  
  INSERT INTO user_calendars (user_id, name, color, sort_order) VALUES
    (p_user_id, 'Praca', '#6266F1', 0),
    (p_user_id, 'Szkoła', '#3A82F5', 1),
    (p_user_id, 'Ważne', '#F67170', 2),
    (p_user_id, 'Inne', '#FBBE24', 3),
    (p_user_id, 'Sport', '#34D39A', 4);
END;
$$;
