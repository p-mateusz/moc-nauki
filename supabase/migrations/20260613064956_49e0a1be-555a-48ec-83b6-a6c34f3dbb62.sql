
CREATE TABLE public.registration_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  email text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_registration_attempts_ip_time ON public.registration_attempts (ip, created_at DESC);
CREATE INDEX idx_registration_attempts_email_time ON public.registration_attempts (email, created_at DESC);
GRANT ALL ON public.registration_attempts TO service_role;
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.registration_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
