ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS exception_dates TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS calendar_events_series_id_idx ON public.calendar_events(series_id);