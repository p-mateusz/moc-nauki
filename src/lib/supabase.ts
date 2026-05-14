// Custom Supabase client — points to the user's own Supabase project
// (not the Lovable Cloud one in src/integrations/supabase/client.ts).
//
// URL and anon/publishable key are public values (they ship in the frontend
// bundle anyway). Security is enforced via RLS, not by hiding these.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://yjlelwsmmrqvlsfcnxru.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mH3athQr7dWGK_m_f4KKEA_0SePhAEY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
