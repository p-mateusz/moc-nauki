import { supabase } from "@/lib/supabase";
import { resetQueryCache } from "@/lib/queryClient";

export const LOGOUT_TIMEOUT_MS = 2000;

export function clearAuthStorage() {
  const keysToRemove = [
    "userId", "userName", "userUsername", "userRole", "userEmail",
    "language", "guestMode", "guestListId", "userAvatarUrl",
    "dashboardActiveTab", "cookieConsent",
  ];
  keysToRemove.forEach(key => localStorage.removeItem(key));
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("userAvatarUrl:") || (key.startsWith("sb-") && key.endsWith("-auth-token"))) {
      localStorage.removeItem(key);
    }
  });
}

export function clearAuthStorageExcept(exceptKeys: string[] = []) {
  const allKeys = [
    "userId", "userName", "userUsername", "userRole", "userEmail",
    "language", "guestMode", "guestListId", "userAvatarUrl",
    "dashboardActiveTab", "cookieConsent",
  ];
  allKeys.forEach(key => { if (!exceptKeys.includes(key)) localStorage.removeItem(key); });
  Object.keys(localStorage).forEach(key => {
    if ((key.startsWith("userAvatarUrl:") || (key.startsWith("sb-") && key.endsWith("-auth-token"))) && !exceptKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });
}

export async function logoutUser() {
  // 1. Wyczyść cały cache React Query — zapobiega wyciekowi danych
  //    poprzedniego użytkownika do nowo zalogowanego konta na tym urządzeniu.
  try { resetQueryCache(); } catch (e) { console.warn("resetQueryCache failed", e); }

  // 2. Usuń wpis bieżącego urządzenia z user_sessions (zwalnia 1 z 2 slotów).
  try {
    const userId = localStorage.getItem("userId");
    const deviceId = localStorage.getItem("mocnauki_device_id");
    if (userId && userId !== "guest" && deviceId) {
      await Promise.race([
        supabase.from("user_sessions").delete().eq("user_id", userId).eq("device_id", deviceId),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    }
  } catch (e) { console.warn("user_sessions cleanup failed", e); }

  // 3. Czyść localStorage natychmiast — nie czekaj na serwer
  clearAuthStorage();

  // Wyloguj z Supabase w tle z krótkim timeout
  const signOutWithTimeout = Promise.race([
    supabase.auth.signOut(),
    new Promise<{ error: Error }>(resolve =>
      setTimeout(() => resolve({ error: new Error("timeout") }), LOGOUT_TIMEOUT_MS)
    ),
  ]);

  let timedOut = false;
  let error: Error | null = null;

  try {
    const result = await signOutWithTimeout;
    if ((result as any)?.error?.message === "timeout") {
      timedOut = true;
      // Kontynuuj w tle
      supabase.auth.signOut().catch(() => {});
    } else if ((result as any)?.error) {
      error = (result as any).error;
    }
  } catch (e: any) {
    error = e;
  }

  return { timedOut, error };
}
