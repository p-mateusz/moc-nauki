
DROP VIEW IF EXISTS public.user_accounts_public;

CREATE VIEW public.user_accounts_public AS
  SELECT id, name, username, email, role, fee_exempt, subscription_status, 
         subscription_end_date, payment_method, payment_date, created_at
  FROM public.user_accounts;

GRANT SELECT ON public.user_accounts_public TO anon, authenticated;
