CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_username_unique_ci_idx
ON public.user_accounts (lower(btrim(username)));