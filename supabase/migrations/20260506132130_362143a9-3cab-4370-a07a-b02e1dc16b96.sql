ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_plan text,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS user_accounts_stripe_customer_idx ON public.user_accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_accounts_stripe_subscription_idx ON public.user_accounts(stripe_subscription_id);

-- Tighten the user self-update policy: prevent users from changing Stripe/billing fields directly.
DROP POLICY IF EXISTS "Users update own account safe fields" ON public.user_accounts;

CREATE POLICY "Users update own account safe fields"
ON public.user_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT u.role FROM public.user_accounts u WHERE u.id = auth.uid())
  AND fee_exempt = (SELECT u.fee_exempt FROM public.user_accounts u WHERE u.id = auth.uid())
  AND subscription_status = (SELECT u.subscription_status FROM public.user_accounts u WHERE u.id = auth.uid())
  AND NOT (subscription_end_date IS DISTINCT FROM (SELECT u.subscription_end_date FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (subscription_expires_at IS DISTINCT FROM (SELECT u.subscription_expires_at FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (subscription_plan IS DISTINCT FROM (SELECT u.subscription_plan FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (stripe_customer_id IS DISTINCT FROM (SELECT u.stripe_customer_id FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (stripe_subscription_id IS DISTINCT FROM (SELECT u.stripe_subscription_id FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND cancel_at_period_end = (SELECT u.cancel_at_period_end FROM public.user_accounts u WHERE u.id = auth.uid())
  AND NOT (payment_method IS DISTINCT FROM (SELECT u.payment_method FROM public.user_accounts u WHERE u.id = auth.uid()))
  AND NOT (payment_date IS DISTINCT FROM (SELECT u.payment_date FROM public.user_accounts u WHERE u.id = auth.uid())))
;