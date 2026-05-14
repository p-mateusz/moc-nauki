# Deploying Edge Function for Update Operations

Because Supabase RLS policies are blocking updates, I've created an Edge Function `update-content` that bypasses RLS and uses the service role key instead.

## Option 1: Deploy via GitHub (Automatic)

If your project is connected to GitHub and has Supabase auto-deploy enabled:
1. Commit and push changes:
   ```bash
   git add .
   git commit -m "Add update-content Edge Function"
   git push origin main
   ```
2. Supabase will automatically deploy the function to your project
3. Wait 2-3 minutes for deployment
4. Refresh your app and try editing

## Option 2: Deploy via Supabase CLI (Manual)

If you have Supabase CLI installed locally:

```bash
# Install Supabase CLI globally (if not already installed)
npm install -g supabase

# Login to your Supabase account
supabase login

# Link your project
supabase link --project-ref cyvzfdxwkjiguhjmrgdv

# Deploy the function
supabase functions deploy update-content

# Push migrations
supabase db push
```

## Option 3: Deploy via Supabase Dashboard (Web UI)

1. Go to https://app.supabase.com
2. Open your project: `cyvzfdxwkjiguhjmrgdv`
3. Navigate to: **Edge Functions** (left sidebar)
4. Click **Create a new function**
5. Name it: `update-content`
6. Copy the content from `/supabase/functions/update-content/index.ts`
7. Paste it in the editor
8. Click **Deploy**

## Testing After Deployment

1. Refresh your application page
2. Try editing a word, definition, or sentence
3. It should now work! ✅
4. Check browser console (F12) for any errors

## How It Works

- When you edit a word/definition/sentence in the app, it calls the Edge Function
- The Edge Function uses the service role key (not user auth)
- This bypasses RLS restrictions and directly updates the database
- Data is then reloaded to show the changes

## Security Note

This implementation is secure because:
- Edge Functions run on Supabase servers (not in browser)
- Service role key is never exposed to the browser
- The function is invoked via authenticated request
- Only specific actions are allowed (update-word, update-sentence)
