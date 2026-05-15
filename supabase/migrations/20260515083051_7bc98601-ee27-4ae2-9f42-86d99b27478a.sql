-- Remove trial subscription status: only exempt / active / canceled / inactive remain.
-- Default for new accounts becomes 'inactive' (unpaid).
ALTER TABLE public.user_accounts
  ALTER COLUMN subscription_status SET DEFAULT 'inactive';

-- Migrate any existing 'trial' rows to 'inactive' and drop the trial end date.
UPDATE public.user_accounts
SET subscription_status = 'inactive',
    subscription_end_date = NULL
WHERE subscription_status = 'trial';