import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type NoteLanguageMode = "original" | "polish";

export type UserPreferences = {
  noteLanguageMode: NoteLanguageMode;
  hiddenLanguages: string[];
  confirmDelete: boolean;
  noteDetailLevel: number;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  noteLanguageMode: "original",
  hiddenLanguages: [],
  confirmDelete: true,
  noteDetailLevel: 5,
};

const STORAGE_KEY = "userPreferences";
const EVENT = "preferencesChanged";

const isMissingPrivateProfileTable = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === "PGRST205" || error?.message?.includes("user_profile_private");

const isMissingLegacyPreferencesColumn = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === "42703" || error?.message?.includes("preferences");

function normalizePreferences(raw: Partial<UserPreferences> | null | undefined): Partial<UserPreferences> {
  if (!raw || typeof raw !== "object") return {};
  const next: Partial<UserPreferences> = {};
  if (raw.noteLanguageMode === "original" || raw.noteLanguageMode === "polish") next.noteLanguageMode = raw.noteLanguageMode;
  if (Array.isArray(raw.hiddenLanguages)) next.hiddenLanguages = raw.hiddenLanguages.filter((x) => typeof x === "string");
  if (typeof raw.confirmDelete === "boolean") next.confirmDelete = raw.confirmDelete;
  const detail = Math.round(Number(raw.noteDetailLevel));
  if (Number.isFinite(detail)) next.noteDetailLevel = Math.min(9, Math.max(1, detail));
  return next;
}

async function loadRemotePreferences(userId: string): Promise<Partial<UserPreferences>> {
  const privateResult = await supabase
    .from("user_profile_private")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (!privateResult.error) return normalizePreferences(privateResult.data?.preferences as Partial<UserPreferences>);
  if (!isMissingPrivateProfileTable(privateResult.error)) return {};

  const legacyResult = await (supabase as any)
    .from("user_profiles")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyResult.error) return {};
  return normalizePreferences(legacyResult.data?.preferences as Partial<UserPreferences>);
}

async function saveRemotePreferences(userId: string, preferences: UserPreferences) {
  const privateResult = await supabase
    .from("user_profile_private")
    .upsert({ user_id: userId, preferences, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (!isMissingPrivateProfileTable(privateResult.error)) return privateResult;

  const legacyResult = await (supabase as any)
    .from("user_profiles")
    .upsert({ user_id: userId, preferences }, { onConflict: "user_id" });

  if (!isMissingLegacyPreferencesColumn(legacyResult.error)) return legacyResult;
  return legacyResult;
}

function loadCached(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFERENCES };
}

function persistCache(p: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

export function getCachedPreferences(): UserPreferences {
  return loadCached();
}

export function notePreferenceHint(mode: NoteLanguageMode): string {
  return mode === "polish"
    ? "Treść notatki przetłumacz na język polski, ale wszystkie słówka pozostaw w oryginalnym języku lekcji."
    : "Zachowaj treść notatki w oryginalnym języku lekcji (słówka również w języku oryginalnym).";
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadCached);
  const [loading, setLoading] = useState(true);
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as UserPreferences | undefined;
      if (detail) setPrefs(detail);
      else setPrefs(loadCached());
    };
    window.addEventListener(EVENT, onChanged);
    return () => window.removeEventListener(EVENT, onChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || userId === "guest") {
        setLoading(false);
        return;
      }
      const remote = await loadRemotePreferences(userId);
      if (cancelled) return;
      const merged: UserPreferences = { ...DEFAULT_PREFERENCES, ...loadCached(), ...remote };
      setPrefs(merged);
      persistCache(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const next: UserPreferences = { ...loadCached(), ...partial };
      setPrefs(next);
      persistCache(next);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
      if (!userId || userId === "guest") return { error: null };
      const { error } = await saveRemotePreferences(userId, next);
      return { error };
    },
    [userId],
  );

  return { prefs, loading, update };
}
