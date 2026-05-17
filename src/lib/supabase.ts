// Dedicated client pointing to the legacy Supabase project (yjlelwsmmrqvlsfcnxru).
// NOTE: src/integrations/supabase/client.ts and .env are auto-generated for
// the Lovable Cloud project and cannot be edited, so we create a standalone
// client here and re-export it as `supabase` for the rest of the app.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://yjlelwsmmrqvlsfcnxru.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mH3athQr7dWGK_m_f4KKEA_0SePhAEY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
