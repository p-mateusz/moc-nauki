
ALTER TABLE public.user_accounts 
  ADD COLUMN IF NOT EXISTS fee_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone DEFAULT NULL;

-- Teachers are auto fee-exempt, set existing teachers
UPDATE public.user_accounts SET fee_exempt = true WHERE role = 'teacher';

-- Set trial end date for existing non-exempt users (2 weeks from created_at)
UPDATE public.user_accounts SET subscription_end_date = created_at + interval '14 days' WHERE fee_exempt = false AND subscription_end_date IS NULL;

-- Create custom_roles table for admin-defined roles
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#60a5fa',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to custom_roles" ON public.custom_roles FOR ALL TO public USING (true) WITH CHECK (true);
