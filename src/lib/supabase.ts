// Dedicated client pointing to the legacy Supabase project (yjlelwsmmrqvlsfcnxru).
// NOTE: src/integrations/supabase/client.ts and .env are auto-generated for
// the Lovable Cloud project and cannot be edited, so we create a standalone
// client here and re-export it as `supabase` for the rest of the app.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://yjlelwsmmrqvlsfcnxru.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mH3athQr7dWGK_m_f4KKEA_0SePhAEY";

// gotrue-js domyślnie używa Web Locks (navigator.locks) do koordynacji
// odświeżania tokena między kartami. W kontekście iframe podglądu Lovable
// te locki potrafią się zawiesić ("Lock was not released within 5000ms"),
// blokując całą kolejkę zapytań — wszystkie fetch-e do PostgREST zaczynają
// padać z "TypeError: Load failed". Podajemy własny no-op lock, który
// po prostu wykonuje callback bez globalnego synchronizowania.
const noopLock = async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: noopLock,
  },
});
