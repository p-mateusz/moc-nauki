GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_feeds TO authenticated;
GRANT ALL ON public.user_calendar_feeds TO service_role;

DROP POLICY IF EXISTS "Owner select calendar feed" ON public.user_calendar_feeds;
DROP POLICY IF EXISTS "Owner insert calendar feed" ON public.user_calendar_feeds;
DROP POLICY IF EXISTS "Owner update calendar feed" ON public.user_calendar_feeds;
DROP POLICY IF EXISTS "Owner delete calendar feed" ON public.user_calendar_feeds;

DROP POLICY IF EXISTS "Users select own feed" ON public.user_calendar_feeds;
DROP POLICY IF EXISTS "Users insert own feed" ON public.user_calendar_feeds;
DROP POLICY IF EXISTS "Users update own feed" ON public.user_calendar_feeds;
DROP POLICY IF EXISTS "Users delete own feed" ON public.user_calendar_feeds;

CREATE POLICY "Users can view own calendar feed"
ON public.user_calendar_feeds
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own calendar feed"
ON public.user_calendar_feeds
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar feed"
ON public.user_calendar_feeds
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar feed"
ON public.user_calendar_feeds
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';