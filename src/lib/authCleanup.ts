import { supabase } from "@/lib/supabase";

/**
 * Centralized auth cleanup utility
 * Ensures consistent logout across all pages/components
 */

export const LOGOUT_TIMEOUT_MS = 10000;

export function clearAuthStorage() {
  const keysToRemove = [
    "userId",
    "userName",
    "userUsername",
    "userRole",
    "userEmail",
    "language",
    "guestMode",
    "guestListId",
    "userAvatarUrl",
    "dashboardActiveTab",
    "cookieConsent",
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith("userAvatarUrl:") || (key.startsWith("sb-") && key.endsWith("-auth-token"))) {
      localStorage.removeItem(key);
    }
  });
}

export function clearAuthStorageExcept(exceptKeys: string[] = []) {
  const allKeys = [
    "userId",
    "userName",
    "userUsername",
    "userRole",
    "userEmail",
    "language",
    "guestMode",
    "guestListId",
    "userAvatarUrl",
    "dashboardActiveTab",
    "cookieConsent",
  ];

  allKeys.forEach(key => {
    if (!exceptKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith("userAvatarUrl:") || (key.startsWith("sb-") && key.endsWith("-auth-token"))) {
      if (!exceptKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    }
  });
}

export async function logoutUser() {
  const signOutPromise = supabase.auth.signOut();
  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ _timedOut: true }), LOGOUT_TIMEOUT_MS));
  const wrappedSignOut = signOutPromise
    .then(res => ({ result: res }))
    .catch(error => ({ result: { error } }));

  const raceResult = await Promise.race([wrappedSignOut, timeoutPromise]);
  const timedOut = (raceResult as any)?._timedOut === true;
  const result = timedOut ? undefined : (raceResult as any).result;

  if (timedOut) {
    console.warn("logoutUser: signOut timed out, proceeding with local cleanup");
  }

  if (result?.error) {
    console.error("logoutUser signOut error:", result.error);
  }

  clearAuthStorage();

  try {
    await supabase.auth.setSession({ access_token: "", refresh_token: "" });
  } catch (error) {
    console.warn("logoutUser setSession clear failed:", error);
  }

  if (timedOut || result?.error) {
    signOutPromise
      .then((r: any) => {
        if (r?.error) console.warn("logoutUser background signOut error:", r.error);
        else console.log("logoutUser background signOut succeeded");
      })
      .catch((e: any) => console.warn("logoutUser background signOut exception:", e));
  }

  return {
    timedOut,
    error: result?.error,
  };
}
