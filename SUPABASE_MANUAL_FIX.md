# Supabase Manual Fix Required

## Problem
Update operations are blocked because UPDATE policies are missing from RLS-enabled tables:
- `words` table - needs UPDATE policy
- `generated_sentences` table - needs UPDATE policy  
- `word_lists` table - needs UPDATE policy

## Step-by-Step Instructions

### 1. Open Supabase Dashboard
- Go to: https://app.supabase.com
- Sign in with your account

### 2. Find Your Project
- Look for project: `cyvzfdxwkjiguhjmrgdv` (from your .env file)
- Click to open it

### 3. Access SQL Editor
- On the left sidebar, find **SQL Editor** (typically has a terminal/code icon)
- Click on it
- Click **New Query** (or the "+" button)

### 4. Copy-Paste This SQL

```sql
-- Enable UPDATE for words table
DROP POLICY IF EXISTS "Permissive update words" ON public.words;
CREATE POLICY "Permissive update words" ON public.words 
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable UPDATE for word_lists table
DROP POLICY IF EXISTS "Permissive update word_lists" ON public.word_lists;
CREATE POLICY "Permissive update word_lists" ON public.word_lists 
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable UPDATE for generated_sentences table
DROP POLICY IF EXISTS "Permissive update generated_sentences" ON public.generated_sentences;
CREATE POLICY "Permissive update generated_sentences" ON public.generated_sentences 
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
```

### 5. Run Query
- Click the **Run** button (usually blue, with a play icon)
- Wait for success message
- You should see: "Finished successfully in X ms"

### 6. Test in App
1. Refresh your application page (Ctrl+R or Cmd+R)
2. Try editing a word, definition, or sentence
3. It should now work! ✅

## If Still Not Working
1. Open DevTools (F12)
2. Go to **Console** tab
3. Try editing again
4. Look for red error messages
5. Copy the error and let me know what it says

## Note
These are temporary permissive policies for testing. They allow any authenticated user to update any record. Later we should replace them with more secure owner-based policies.
