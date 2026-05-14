/**
 * Centralized auth cleanup utility
 * Ensures consistent logout across all pages/components
 */

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

  // Remove avatar cache for all users (pattern: userAvatarUrl:*)
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith("userAvatarUrl:")) {
      localStorage.removeItem(key);
    }
  });

  // Remove Supabase persisted auth tokens (sb-<ref>-auth-token)
  keys.forEach(key => {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
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
  ];

  allKeys.forEach(key => {
    if (!exceptKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });
}
