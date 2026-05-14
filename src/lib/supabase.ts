// Custom Supabase client — points to the user's own Supabase project
// (not the Lovable Cloud one in src/integrations/supabase/client.ts).
//
// Required Build Secrets (Workspace Settings → Build Secrets):
//   - VITE_CUSTOM_SUPABASE_URL
//   - VITE_CUSTOM_SUPABASE_ANON_KEY
//
// We still import Database types from the auto-generated types file.
// If your custom Supabase project has a different schema, regenerate the
// types via the Supabase CLI and replace src/integrations/supabase/types.ts.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_CUSTOM_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_CUSTOM_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly in dev so misconfiguration is obvious.
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Missing VITE_CUSTOM_SUPABASE_URL or VITE_CUSTOM_SUPABASE_ANON_KEY. " +
      "Add them in Workspace Settings → Build Secrets."
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL ?? "https://invalid.supabase.co",
  SUPABASE_ANON_KEY ?? "invalid",
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
