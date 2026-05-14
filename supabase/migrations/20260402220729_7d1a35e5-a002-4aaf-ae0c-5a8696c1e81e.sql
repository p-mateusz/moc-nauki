
CREATE VIEW public.user_accounts_public
WITH (security_invoker = on) AS
  SELECT id, name, username, email, role, fee_exempt, subscription_status, 
         subscription_end_date, payment_method, payment_date, created_at
  FROM public.user_accounts;

-- Allow anon/authenticated to read the view by adding a SELECT policy on the base table
-- But we need a separate approach: grant select on the view
GRANT SELECT ON public.user_accounts_public TO anon, authenticated;
