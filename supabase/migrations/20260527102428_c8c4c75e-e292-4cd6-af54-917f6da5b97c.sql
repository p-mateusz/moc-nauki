DROP POLICY IF EXISTS "Users update own account safe fields" ON public.user_accounts;

CREATE POLICY "Users update own account safe fields"
ON public.user_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND email = (SELECT u.email FROM user_accounts u WHERE u.id = auth.uid())
  AND role = (SELECT u.role FROM user_accounts u WHERE u.id = auth.uid())
  AND fee_exempt = (SELECT u.fee_exempt FROM user_accounts u WHERE u.id = auth.uid())
  AND subscription_status = (SELECT u.subscription_status FROM user_accounts u WHERE u.id = auth.uid())
  AND NOT (subscription_end_date IS DISTINCT FROM (SELECT u.subscription_end_date FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (subscription_expires_at IS DISTINCT FROM (SELECT u.subscription_expires_at FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (subscription_plan IS DISTINCT FROM (SELECT u.subscription_plan FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (stripe_customer_id IS DISTINCT FROM (SELECT u.stripe_customer_id FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (stripe_subscription_id IS DISTINCT FROM (SELECT u.stripe_subscription_id FROM user_accounts u WHERE u.id = auth.uid()))
  AND cancel_at_period_end = (SELECT u.cancel_at_period_end FROM user_accounts u WHERE u.id = auth.uid())
  AND NOT (payment_method IS DISTINCT FROM (SELECT u.payment_method FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (payment_date IS DISTINCT FROM (SELECT u.payment_date FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (webhook_suspended_at IS DISTINCT FROM (SELECT u.webhook_suspended_at FROM user_accounts u WHERE u.id = auth.uid()))
  AND NOT (webhook_suspended_reason IS DISTINCT FROM (SELECT u.webhook_suspended_reason FROM user_accounts u WHERE u.id = auth.uid()))
);