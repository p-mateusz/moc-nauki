export function normalizeAllFeeExemptSetting(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}
