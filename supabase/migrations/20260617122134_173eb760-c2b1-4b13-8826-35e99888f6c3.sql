CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own sessions"
  ON public.user_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX user_sessions_user_id_idx ON public.user_sessions (user_id, last_seen_at DESC);