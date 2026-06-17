// Identyfikator urządzenia używany do limitu jednoczesnych sesji (max 2).
// Generowany raz per przeglądarka i przechowywany w localStorage.
const DEVICE_ID_KEY = "mocnauki_device_id";

function generateDeviceId(): string {
  try {
    // crypto.randomUUID działa w nowoczesnych przeglądarkach.
    return (crypto as any)?.randomUUID?.() || fallbackId();
  } catch {
    return fallbackId();
  }
}

function fallbackId(): string {
  return "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || id.length < 8) {
      id = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return generateDeviceId();
  }
}

export function clearDeviceSessionLocal() {
  // device_id celowo zostaje — to identyfikator przeglądarki, nie konta.
}
