-- Replace single ALL policy with explicit per-command owner-scoped policies
DROP POLICY IF EXISTS "Owner manage calendars" ON public.user_calendars;

CREATE POLICY "Owner select calendars"
  ON public.user_calendars FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner insert calendars"
  ON public.user_calendars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update calendars"
  ON public.user_calendars FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner delete calendars"
  ON public.user_calendars FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);