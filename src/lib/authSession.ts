import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SESSION_TIMEOUT_MS = 2500;

export async function getSessionSafe(timeoutMs = SESSION_TIMEOUT_MS): Promise<Session | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

  try {
    const result = await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session ?? null),
      timeout,
    ]);

    return result;
  } catch (error) {
    console.warn("Auth session read failed", error);
    return null;
  }
}

export function getStoredUserId(): string | null {
  try {
    const userId = localStorage.getItem("userId");
    return userId && userId !== "guest" ? userId : null;
  } catch {
    return null;
  }
}

export async function getUserIdSafe(session?: Session | null): Promise<string | null> {
  if (session?.user?.id) return session.user.id;

  const restoredSession = await getSessionSafe();
  return restoredSession?.user?.id ?? getStoredUserId();
}