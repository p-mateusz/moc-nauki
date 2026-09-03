export function normalizeAllFeeExemptSetting(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/**
 * Darmowe konta są włączone domyślnie — dopóki administrator jawnie ich nie wyłączy.
 * Brak wpisu w app_settings (undefined/null/"") traktujemy jako "włączone".
 */
export function resolveFreeAccountsEnabled(value: unknown): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return true;
  return normalizeAllFeeExemptSetting(value);
}

export const DEFAULT_FREE_ACCOUNT_DAYS = 365;

/** Ile dni trwa automatyczne zwolnienie z opłat dla nowego konta. */
export function resolveFreeAccountDays(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FREE_ACCOUNT_DAYS;
  return Math.min(parsed, 3650);
}
