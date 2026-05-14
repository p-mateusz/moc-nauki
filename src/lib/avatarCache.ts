// Per-user avatar cache + cross-component notification.
// Namespacing prevents one user's avatar from leaking to another account on the same device.

export const avatarCacheKey = (userId: string | null | undefined) =>
  userId ? `userAvatarUrl:${userId}` : null;

export function setAvatarCache(userId: string, url: string | null) {
  const key = avatarCacheKey(userId);
  if (!key) return;
  if (url) localStorage.setItem(key, url);
  else localStorage.removeItem(key);
  // Same-tab notification
  window.dispatchEvent(new CustomEvent("avatar-changed", { detail: { userId, url } }));
}

export function getAvatarCache(userId: string | null | undefined): string | null {
  const key = avatarCacheKey(userId);
  return key ? localStorage.getItem(key) : null;
}
