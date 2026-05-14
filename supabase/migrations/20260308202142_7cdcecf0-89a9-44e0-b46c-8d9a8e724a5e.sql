
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read/insert user_accounts"
ON public.user_accounts
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
