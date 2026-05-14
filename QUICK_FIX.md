# 🚀 QUICK FIX - CHOOSE ONE OPTION

## Option 1: FASTEST - Direct SQL (3 minutes)

### Step 1: Open SQL Editor
1. Go to: https://app.supabase.com
2. Login and select project: `cyvzfdxwkjiguhjmrgdv`
3. Left sidebar → **SQL Editor**
4. Click **New Query**

### Step 2: Run This SQL

Copy-paste ALL of this:

```sql
DROP POLICY IF EXISTS "Permissive update words" ON public.words;
CREATE POLICY "Permissive update words" ON public.words 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive update word_lists" ON public.word_lists;
CREATE POLICY "Permissive update word_lists" ON public.word_lists 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive update generated_sentences" ON public.generated_sentences;
CREATE POLICY "Permissive update generated_sentences" ON public.generated_sentences 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```

### Step 3: Click RUN
- Wait for "Success" message
- Refresh your app
- Try editing - should work now! ✅

---

## Option 2: PROPER WAY - Edge Function (10 minutes)

If you prefer a more secure approach with Edge Functions:

See: `DEPLOY_EDGE_FUNCTION.md`

This is slightly more complex but properly isolates database changes.

---

## ⚠️ IMPORTANT

If you're stuck on Step 1-2, it means you don't have access to Supabase SQL Editor:
- Check if you're logged into correct Supabase account
- Verify you have permissions on this project
- Contact Supabase support if needed

## After Fix

1. Refresh browser (Ctrl+R)
2. Try editing a word or definition
3. Should update instantly now
4. Try editing a sentence (expand word → click pencil)
5. All changes should save ✅
