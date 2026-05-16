// Tests store – DB-backed shared state for tests & ranking
import { supabase } from "@/lib/supabase";

export type TestSolution = {
  id: string;
  author: string;
  author_id: string;
  author_name: string;
  content: string;
  text: string;
  images: string[];
  ts: number;
  created_at: string;
  confirmed: boolean;
};

export type Test = {
  id: string;
  title: string;
  subject: string;
  klasa: string;
  scope: string;
  school_name: string;
  sname: string;
  teacher: string;
  description: string;
  desc: string;
  images: string[];
  questions: unknown[];
  author: string;
  author_id: string;
  author_name: string;
  ts: number;
  created_at: string;
  likes: string[];
  uses: number;
  solutions?: TestSolution[];
  user_id: string;
};

export type TestUser = {
  name: string;
  handle: string;
  avColor: string;
  activityDays: string[];
  joined: number;
  saved?: number[];
  solveCount?: number;
  _badges?: string[];
};

export type TestsState = {
  users: Record<string, TestUser>;
  tests: Test[];
  cur: string | null;
  seq: number;
};

// ─── DB-backed functions ───

export async function fetchTests(): Promise<Test[]> {
  const { data, error } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
  if (error) { console.error("fetchTests error:", error); return []; }
  return (data || []).map((t: any) => ({
    ...t,
    sname: t.school_name || "",
    desc: t.description || "",
    author: t.author_name || "",
    ts: new Date(t.created_at).getTime(),
    likes: t.likes || [],
    solutions: t.solutions || [],
    questions: t.questions || [],
    images: t.images || [],
  }));
}

export async function fetchSaves(userId: string): Promise<string[]> {
  const { data } = await supabase.from("test_saves").select("test_id").eq("user_id", userId);
  return (data || []).map((s: any) => s.test_id);
}

export async function createTest(input: {
  title: string; subject: string; klasa: string; scope: string;
  school_name: string; teacher: string; description: string;
  images: string[]; author_id: string; author_name: string;
}): Promise<Test | null> {
  const { data, error } = await supabase.from("tests").insert({
    title: input.title, subject: input.subject, klasa: input.klasa, scope: input.scope,
    school_name: input.school_name, teacher: input.teacher, description: input.description,
    images: input.images, author_id: input.author_id, author_name: input.author_name,
    user_id: input.author_id,
  } as any).select().single();
  if (error) { console.error("createTest error:", error); return null; }
  return { ...data, sname: data.school_name, desc: data.description, author: data.author_name, ts: new Date(data.created_at).getTime(), likes: data.likes || [], solutions: data.solutions || [], questions: data.questions || [], images: data.images || [] } as Test;
}

export async function deleteTest(id: string) {
  await supabase.from("tests").delete().eq("id", id);
}

export async function toggleLike(testId: string, userId: string, _userName: string, currentlyLiked: boolean) {
  const { data: test } = await supabase.from("tests").select("likes").eq("id", testId).single();
  if (!test) return;
  let likes: string[] = test.likes || [];
  if (currentlyLiked) {
    likes = likes.filter((l: string) => l !== userId);
  } else {
    likes = [...likes, userId];
  }
  await supabase.from("tests").update({ likes } as any).eq("id", testId);
}

export async function toggleSave(testId: string, userId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    await supabase.from("test_saves").delete().eq("test_id", testId).eq("user_id", userId);
  } else {
    await supabase.from("test_saves").insert({ test_id: testId, user_id: userId } as any);
  }
}

export async function incrementUses(testId: string) {
  const { data: test } = await supabase.from("tests").select("uses").eq("id", testId).single();
  if (!test) return;
  await supabase.from("tests").update({ uses: (test.uses || 0) + 1 } as any).eq("id", testId);
}

export async function addSolution(testId: string, solution: { author_id: string; author_name: string; content: string; images: string[] }) {
  const { data: test } = await supabase.from("tests").select("solutions").eq("id", testId).single();
  if (!test) return;
  const solutions = [...(test.solutions as any[] || []), {
    id: crypto.randomUUID(),
    ...solution,
    confirmed: false,
    created_at: new Date().toISOString(),
    ts: Date.now(),
  }];
  await supabase.from("tests").update({ solutions } as any).eq("id", testId);
}

export async function deleteSolution(testId: string, solutionId: string) {
  const { data: test } = await supabase.from("tests").select("solutions").eq("id", testId).single();
  if (!test) return;
  const solutions = ((test.solutions as any[]) || []).filter((s: any) => s.id !== solutionId);
  await supabase.from("tests").update({ solutions } as any).eq("id", testId);
}

export async function uploadTestImage(file: File, testId: string, userId?: string): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  // Try authenticated user folder first (matches avatars bucket RLS which
  // typically requires the first path segment to equal auth.uid()).
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id;
  }
  if (!uid) { console.error("uploadTestImage: no auth user"); return null; }
  const path = `${uid}/tests/${testId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) { console.error("uploadTestImage error:", error); return null; }
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return pub.publicUrl;
}

// ─── Points / badges helpers that work with DB test arrays ───

export function getEarnedFromTests(tests: Test[], userId: string, activityDays: string[], solveCount: number) {
  const mt = tests.filter(t => t.author_id === userId);
  const likes = mt.reduce((a, t) => a + (t.likes || []).length, 0);
  const uses = mt.reduce((a, t) => a + (t.uses || 0), 0);
  const streak = calcStreak(activityDays).best;
  const subjects = [...new Set(mt.map(t => t.subject))];
  const c: Record<string, boolean> = {
    first: mt.length >= 1, pub5: mt.length >= 5, pub15: mt.length >= 15,
    like10: likes >= 10, like50: likes >= 50, used10: uses >= 10, used50: uses >= 50,
    streak: streak >= 7,
    math: mt.filter(t => t.subject === "Matematyka").length >= 3,
    multi: subjects.length >= 4,
    rozszerzenie: mt.filter(t => t.scope === "rozszerzenie").length >= 3,
    solver: solveCount >= 10,
  };
  return BADGES.filter(b => c[b.id]);
}

export function ptsFromTests(tests: Test[], userId: string, activityDays: string[], solveCount: number) {
  const mt = tests.filter(t => t.author_id === userId);
  const likes = mt.reduce((a, t) => a + (t.likes || []).length, 0);
  const uses = mt.reduce((a, t) => a + (t.uses || 0), 0);
  return mt.length * 5 + likes * 3 + uses * 2 + getEarnedFromTests(tests, userId, activityDays, solveCount).length * 10;
}

// ─── Legacy localStorage helpers (kept for compatibility) ───

const KEY = "mocnauki_v2";

export function loadState(): TestsState {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {}
  return { users: {}, tests: [], cur: null, seq: 1 };
}

export function saveState(s: TestsState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function ensureUser(s: TestsState, userName: string): TestsState {
  if (!s.users[userName]) {
    s.users[userName] = { name: userName, handle: userName.toLowerCase().replace(/\s+/g, "_"), avColor: "av-c1", activityDays: [], joined: Date.now() };
  }
  s.cur = userName;
  return s;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoAdd(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calcStreak(days: string[]) {
  if (!days?.length) return { cur: 0, best: 0, total: 0 };
  const s = [...new Set(days)].sort();
  const today = todayISO();
  const yest = isoAdd(today, -1);
  let cur = 0;
  const last = s[s.length - 1];
  if (last === today || last === yest) {
    cur = 1;
    for (let i = s.length - 2; i >= 0; i--) {
      if (isoAdd(s[i + 1], -1) === s[i]) cur++; else break;
    }
  }
  let best = 0, run = 1;
  for (let i = 1; i < s.length; i++) {
    if (isoAdd(s[i], -1) === s[i - 1]) run++; else run = 1;
    if (run > best) best = run;
  }
  if (cur > best) best = cur;
  if (!best && s.length) best = 1;
  return { cur, best, total: s.length };
}

export function recordActivity(s: TestsState) {
  const u = s.users[s.cur!];
  if (!u) return;
  if (!u.activityDays) u.activityDays = [];
  const t = todayISO();
  if (!u.activityDays.includes(t)) u.activityDays.push(t);
}

export const BADGES = [
  { id: "first", icon: "🌱", name: "Pierwsza publikacja", desc: "Dodaj swój pierwszy test" },
  { id: "pub5", icon: "📚", name: "Bibliotekarz", desc: "5 opublikowanych testów" },
  { id: "pub15", icon: "📖", name: "Encyklopedysta", desc: "15 opublikowanych testów" },
  { id: "like10", icon: "❤️", name: "Ulubieniec", desc: "10 polubień łącznie" },
  { id: "like50", icon: "🔥", name: "Na topie", desc: "50 polubień łącznie" },
  { id: "used10", icon: "▶️", name: "Popularny", desc: "Twoje testy rozwiązano 10 razy" },
  { id: "used50", icon: "🚀", name: "Wirusowy", desc: "Twoje testy rozwiązano 50 razy" },
  { id: "streak", icon: "⚡", name: "Tydzień z rzędu", desc: "Aktywny 7 dni z rzędu" },
  { id: "math", icon: "🔢", name: "Matematyk", desc: "Dodaj 3 testy z Matematyki" },
  { id: "multi", icon: "🌈", name: "Wszechstronny", desc: "Dodaj testy z 4 różnych przedmiotów" },
  { id: "rozszerzenie", icon: "💀", name: "Rozszerzeniowiec", desc: "Dodaj 3 testy z rozszerzenia" },
  { id: "solver", icon: "🧠", name: "Rozwiązywacz", desc: "Rozwiąż 10 cudzych testów" },
];

export function getEarned(s: TestsState, uname: string) {
  const u = s.users[uname];
  if (!u) return [];
  const mt = s.tests.filter(t => t.author === uname);
  const likes = mt.reduce((a, t) => a + (t.likes || []).length, 0);
  const uses = mt.reduce((a, t) => a + (t.uses || 0), 0);
  const streak = calcStreak(u.activityDays || []).best;
  const subjects = [...new Set(mt.map(t => t.subject))];
  const c: Record<string, boolean> = {
    first: mt.length >= 1, pub5: mt.length >= 5, pub15: mt.length >= 15,
    like10: likes >= 10, like50: likes >= 50, used10: uses >= 10, used50: uses >= 50,
    streak: streak >= 7,
    math: mt.filter(t => t.subject === "Matematyka").length >= 3,
    multi: subjects.length >= 4,
    rozszerzenie: mt.filter(t => t.scope === "rozszerzenie").length >= 3,
    solver: (u.solveCount || 0) >= 10,
  };
  return BADGES.filter(b => c[b.id]);
}

export function pts(s: TestsState, uname: string) {
  const mt = s.tests.filter(t => t.author === uname);
  const likes = mt.reduce((a, t) => a + (t.likes || []).length, 0);
  const uses = mt.reduce((a, t) => a + (t.uses || 0), 0);
  return mt.length * 5 + likes * 3 + uses * 2 + getEarned(s, uname).length * 10;
}

export function avInitials(n: string) {
  const p = (n || "").trim().split(" ");
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
}

export function ago(ts: number | string) {
  const time = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const d = Math.floor((Date.now() - time) / 1000);
  if (d < 60) return "przed chwilą";
  if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`;
  return `${Math.floor(d / 86400)} dni`;
}

export const SUBJECTS = [
  "Angielski", "Biologia", "Biznes i zarządzanie", "Chemia", "Europeistyka",
  "Filozofia", "Fizyka", "Francuski", "Geografia", "Historia", "Hiszpański",
  "Informatyka", "Matematyka", "Niemiecki", "Polski", "Włoski", "WOS",
];

export const SCOPE_LABEL: Record<string, string> = {
  podstawa: "Podstawa",
  rozszerzenie: "Rozszerzenie",
};

export const SYMS = [
  { g: "Działania", s: ["×", "÷", "±", "∓", "√", "%", "‰"] },
  { g: "Relacje", s: ["=", "≠", "≈", "≡", "∼", "≅", "<", ">", "≤", "≥", "≪", "≫", "∝", "≙"] },
  { g: "Ułamki", s: ["½", "⅓", "⅔", "¼", "¾", "⅛", "⅜", "⅝", "⅞"] },
  { g: "Potęgi/ind.", s: ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "₀", "₁", "₂", "₃", "₄", "ₙ"] },
  { g: "Greckie (m)", s: ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "κ", "λ", "μ", "ν", "ξ", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω"] },
  { g: "Greckie (W)", s: ["Γ", "Δ", "Θ", "Λ", "Ξ", "Π", "Σ", "Υ", "Φ", "Χ", "Ψ", "Ω"] },
  { g: "Zbiory/logika", s: ["∈", "∉", "⊂", "⊃", "⊆", "⊇", "∪", "∩", "∅", "∀", "∃", "¬", "∧", "∨", "⊕", "⇒", "⇔", "↔"] },
  { g: "Geometria", s: ["°", "′", "″", "∠", "⊥", "∥", "≁", "△", "□", "◯", "⌒", "∡", "⊿"] },
  { g: "Analiza", s: ["∂", "∇", "∑", "∏", "→", "∞", "Δx"] },
  { g: "Strzałki", s: ["→", "←", "↑", "↓", "↗", "↙", "↔", "⇄", "⇌", "⟶", "⟵", "⟺", "⟹"] },
  { g: "Fizyka", s: ["Ω", "ℏ", "ℓ", "℃", "℉", "Å", "·", "ρ", "μ", "η", "τ", "λ", "ν", "ω"] },
];
