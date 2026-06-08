// Dedicated client pointing to the legacy Supabase project (yjlelwsmmrqvlsfcnxru).
// NOTE: src/integrations/supabase/client.ts and .env are auto-generated for
// the Lovable Cloud project and cannot be edited, so we create a standalone
// client here and re-export it as `supabase` for the rest of the app.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const SUPABASE_URL = "https://yjlelwsmmrqvlsfcnxru.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mH3athQr7dWGK_m_f4KKEA_0SePhAEY";
export const SUPABASE_AUTH_STORAGE_KEY = "sb-yjlelwsmmrqvlsfcnxru-auth-token";

export const getStoredAccessToken = () => {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session | { currentSession?: Session };
    return ("access_token" in parsed ? parsed.access_token : parsed.currentSession?.access_token) ?? null;
  } catch {
    return null;
  }
};

export const invokeCloudFunction = async <T,>(
  functionName: string,
  options: { body?: unknown; accessToken?: string | null; headers?: Record<string, string> } = {},
): Promise<T> => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !publishableKey) throw new Error("Brak konfiguracji backendu.");

  const accessToken = options.accessToken === undefined ? getStoredAccessToken() : options.accessToken;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    apikey: publishableKey,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: isFormData ? options.body as BodyInit : JSON.stringify(options.body ?? {}),
  });

  const raw = await response.text();
  let payload: any = null;
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = { error: raw }; }
  }

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || payload?.message || `Błąd funkcji (${response.status})`);
  }

  return payload as T;
};

// gotrue-js domyślnie używa Web Locks (navigator.locks) do koordynacji
// odświeżania tokena między kartami. W kontekście iframe podglądu Lovable
// te locki potrafią się zawiesić ("Lock was not released within 5000ms"),
// blokując całą kolejkę zapytań — wszystkie fetch-e do PostgREST zaczynają
// padać z "TypeError: Load failed". Podajemy własny no-op lock, który
// po prostu wykonuje callback bez globalnego synchronizowania.
const noopLock = async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: noopLock,
  },
});

const dataClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  accessToken: async () => getStoredAccessToken(),
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    lock: noopLock,
  },
  db: {
    timeout: 15000,
  },
});

// DB/functions/storage requests must never wait on auth.getSession(); that is
// exactly what freezes after tab suspension in affected supabase-js versions.
// Use the data client for requests and attach the real Auth API separately.
export const supabase = dataClient as SupabaseClient<Database>;
(supabase as any).auth = authClient.auth;
