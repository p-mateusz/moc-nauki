ALTER TABLE public.user_accounts
ADD COLUMN IF NOT EXISTS webhook_suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS webhook_suspended_reason TEXT;

CREATE TABLE IF NOT EXISTS public.webhook_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.webhook_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own webhook usage" ON public.webhook_usage;
CREATE POLICY "Users read own webhook usage"
ON public.webhook_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all webhook usage" ON public.webhook_usage;
CREATE POLICY "Admins read all webhook usage"
ON public.webhook_usage
FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_webhook_usage_user_date ON public.webhook_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_user_accounts_webhook_suspended_at ON public.user_accounts(webhook_suspended_at);