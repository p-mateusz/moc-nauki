-- Fix teacher role: rename to nauczyciel and update color

-- First, update all users with 'teacher' role to 'nauczyciel'
UPDATE public.user_accounts 
SET role = 'nauczyciel' 
WHERE role = 'teacher';

-- Update the custom_roles table to change 'teacher' to 'nauczyciel'
DELETE FROM public.custom_roles WHERE name = 'teacher';

-- Ensure nauczyciel role exists with correct settings
INSERT INTO public.custom_roles (name, label, color, is_builtin)
VALUES ('nauczyciel', 'Nauczyciel', '#fbbf24', true)
ON CONFLICT (name) DO UPDATE SET
  label = 'Nauczyciel',
  color = '#fbbf24',
  is_builtin = true;
