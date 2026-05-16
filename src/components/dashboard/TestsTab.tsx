import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Plus, Trash2, Upload, X, Heart, Star, BookOpen, PenLine, ChevronDown, ChevronUp } from "lucide-react";
import {
  fetchTests, fetchSaves, createTest, deleteTest as deleteTestApi,
  toggleLike, toggleSave, incrementUses, addSolution, deleteSolution as deleteSolApi,
  uploadTestImage, Test, SUBJECTS, SCOPE_LABEL, SYMS, avInitials, ago,
} from "@/lib/testsStore";

interface Props { userName: string; guestMode?: boolean }
type Subtab = "all" | "mine" | "saved";
type Filters = { subject: string; klasa: string; scope: string; teacher: string };

const s = {
  wrap: { fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f1f5f9" } as React.CSSProperties,
  input: {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#f1f5f9", borderRadius: 10, padding: "10px 14px", fontSize: ".9rem",
    fontFamily: "inherit", outline: "none", transition: "border-color .2s", boxSizing: "border-box",
  } as React.CSSProperties,
  textarea: {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#f1f5f9", borderRadius: 10, padding: "10px 14px", fontSize: ".9rem",
    fontFamily: "inherit", outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const,
  },
  select: {
    width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#f1f5f9", borderRadius: 10, padding: "10px 14px", fontSize: ".9rem",
    fontFamily: "inherit", outline: "none",
  } as React.CSSProperties,
  label: { display: "block", fontSize: ".72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: ".08em", marginBottom: 6 },
  card: { background: "#0f1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 } as React.CSSProperties,
  btnGrad: {
    background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", border: "none",
    padding: "9px 18px", borderRadius: 9, fontWeight: 700, fontSize: ".88rem",
    cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
    boxShadow: "0 4px 14px rgba(59,130,246,0.25)", transition: ".2s",
  } as React.CSSProperties,
  btnGhost: {
    background: "rgba(255,255,255,0.04)", color: "#8899b4", border: "1px solid rgba(255,255,255,0.08)",
    padding: "9px 18px", borderRadius: 9, fontWeight: 600, fontSize: ".88rem",
    cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, transition: ".2s",
  } as React.CSSProperties,
  btnDanger: {
    background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)",
    padding: "6px 12px", borderRadius: 8, fontWeight: 600, fontSize: ".78rem",
    cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, transition: ".2s",
  } as React.CSSProperties,
  overlay: {
    position: "fixed" as const, inset: 0, zIndex: 2000,
    background: "rgba(4,8,18,0.88)", display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px", backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#0f1117", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20,
    width: "100%", maxWidth: 680, maxHeight: "92vh", overflow: "hidden",
    display: "flex", flexDirection: "column" as const,
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    position: "relative" as const,
  },
};

const TestsTab = ({ userName, guestMode }: Props) => {
  const userId = localStorage.getItem("userId") || "";
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState<Subtab>("all");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ subject: "", klasa: "", scope: "", teacher: "" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [viewTestId, setViewTestId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"test" | "solutions">("test");
  const [solMode, setSolMode] = useState<"text" | "photo">("text");
  const [solImgs, setSolImgs] = useState<string[]>([]);
  const [solImgFiles, setSolImgFiles] = useState<File[]>([]);
  const [symOpen, setSymOpen] = useState(false);
  const solTextRef = useRef<HTMLTextAreaElement>(null);

  const [ntTitle, setNtTitle] = useState("");
  const [ntSubject, setNtSubject] = useState("");
  const [ntKlasa, setNtKlasa] = useState("");
  const [ntScope, setNtScope] = useState("");
  const [ntSname, setNtSname] = useState("");
  const [ntTeacher, setNtTeacher] = useState("");
  const [ntDesc, setNtDesc] = useState("");
  const [ntImgPreviews, setNtImgPreviews] = useState<string[]>([]);
  const [ntImgFiles, setNtImgFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const solFileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (guestMode) {
      const now = Date.now();
      const days = (n: number) => new Date(now - n * 86400000).toISOString();
      const mk = (id: string, title: string, subject: string, klasa: string, scope: string, sname: string, teacher: string, desc: string, author_name: string, likes: number, uses: number, dago: number): Test => ({
        id, title, subject, klasa, scope, school_name: sname, sname, teacher, description: desc, desc,
        images: [], questions: [], author: author_name, author_id: `demo-${id}`, author_name, user_id: `demo-${id}`,
        ts: now - dago * 86400000, created_at: days(dago),
        likes: Array.from({ length: likes }, (_, i) => `u${i}`), uses, solutions: [],
      });
      setAllTests([
        mk("dt1","Sprawdzian – Funkcje kwadratowe","Matematyka","2","rozszerzenie","LO im. M. Kopernika","mgr Anna Kowalska","Wzory Viete, delta, wykresy paraboli.","Jan Kowalski",12,187,2),
        mk("dt2","Test z biologii – Genetyka","Biologia","3","rozszerzenie","LO im. J. Słowackiego","dr Piotr Nowak","Krzyżówki Mendla, dziedziczenie sprzężone z płcią.","Aleksandra Nowak",5,98,5),
        mk("dt3","Kartkówka – II wojna światowa","Historia","4","podstawa","LO nr 5","mgr Magdalena Wiśniewska","Najważniejsze daty, bitwy i postacie.","Michał Wiśniewski",8,142,7),
        mk("dt4","Sprawdzian – Pan Tadeusz","Język polski","2","podstawa","LO im. A. Mickiewicza","mgr Joanna Dąbrowska","Bohaterowie, motywy, znaczenie utworu.","Karolina Lewandowska",15,211,3),
        mk("dt5","Test – Past Perfect & Conditionals","Język angielski","3","rozszerzenie","Liceum Językowe","mgr Katarzyna Zielińska","Zaawansowana gramatyka i transformacje zdań.","Bartosz Zieliński",7,76,10),
        mk("dt6","Sprawdzian z fizyki – Mechanika","Fizyka","1","podstawa","Technikum Mechaniczne","mgr Tomasz Lewandowski","Zasady dynamiki Newtona, energia, pęd.","Natalia Wójcik",4,64,12),
      ]);
      setSavedIds(["dt2","dt4"]);
      setLoading(false);
      return;
    }
    const [tests, saves] = await Promise.all([fetchTests(), fetchSaves(userId)]);
    setAllTests(tests);
    setSavedIds(saves);
    setLoading(false);
  }, [userId, guestMode]);

  useEffect(() => { reload(); }, [reload]);

  let tests = [...allTests];
  if (subtab === "mine") tests = tests.filter(t => t.author_id === userId);
  if (subtab === "saved") tests = tests.filter(t => savedIds.includes(t.id));
  if (subtab === "all") {
    if (filters.subject) tests = tests.filter(t => t.subject === filters.subject);
    if (filters.klasa) tests = tests.filter(t => t.klasa === filters.klasa);
    if (filters.scope) tests = tests.filter(t => t.scope === filters.scope);
    if (filters.teacher) tests = tests.filter(t => t.teacher === filters.teacher);
  }
  const q = search.toLowerCase();
  if (q) tests = tests.filter(t => (t.title + t.subject + t.teacher + t.school_name + t.description).toLowerCase().includes(q));

  const cntAll = allTests.length;
  const cntMine = allTests.filter(t => t.author_id === userId).length;
  const cntSaved = savedIds.length;

  const handleToggleLike = async (id: string) => {
    const test = allTests.find(t => t.id === id);
    if (!test) return;
    await toggleLike(id, userId, userName, test.likes.includes(userId));
    reload();
  };

  const handleToggleStar = async (id: string) => {
    const saved = savedIds.includes(id);
    await toggleSave(id, userId, saved);
    if (saved) { setSavedIds(prev => prev.filter(s => s !== id)); toast.info("Usunięto z zapisanych"); }
    else { setSavedIds(prev => [...prev, id]); toast.success("⭐ Zapisano!"); }
  };

  const handleDeleteTest = async (id: string) => {
    await deleteTestApi(id);
    toast.success("Usunięto test");
    reload();
  };

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "test" | "sol") => {
    const files = Array.from(e.target.files || []);
    const ok = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (ok.length < files.length) toast.warning(`${files.length - ok.length} plik(i) za duże (maks. 10 MB)`);
    ok.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target!.result as string;
        if (target === "test") { setNtImgPreviews(prev => [...prev, url]); setNtImgFiles(prev => [...prev, file]); }
        else { setSolImgs(prev => [...prev, url]); setSolImgFiles(prev => [...prev, file]); }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const publishTest = async () => {
    if (!ntTitle) { toast.warning("Podaj temat testu!"); return; }
    if (!ntSubject) { toast.warning("Wybierz przedmiot!"); return; }
    if (!ntKlasa) { toast.warning("Wybierz klasę!"); return; }
    if (!ntScope) { toast.warning("Wybierz zakres!"); return; }
    setPublishing(true);
    const test = await createTest({ title: ntTitle, subject: ntSubject, klasa: ntKlasa, scope: ntScope, school_name: ntSname, teacher: ntTeacher, description: ntDesc, images: [], author_id: userId, author_name: userName });
    if (!test) { toast.error("Błąd tworzenia testu"); setPublishing(false); return; }
    if (ntImgFiles.length > 0) {
      const urls: string[] = [];
      for (const file of ntImgFiles) {
        const url = await uploadTestImage(file, test.id, userId);
        if (url) urls.push(url);
        else toast.error(`Nie udało się zapisać zdjęcia: ${file.name}`);
      }
      if (urls.length > 0) {
        const { error } = await supabase.from("tests").update({ images: urls }).eq("id", test.id);
        if (error) toast.error(`Błąd zapisu zdjęć: ${error.message}`);
      }
    }
    setShowCreate(false);
    setNtTitle(""); setNtSubject(""); setNtKlasa(""); setNtScope("");
    setNtSname(""); setNtTeacher(""); setNtDesc(""); setNtImgPreviews([]); setNtImgFiles([]);
    setPublishing(false);
    toast.success("🚀 Test opublikowany!");
    reload();
  };

  const openQuiz = async (id: string) => {
    const test = allTests.find(t => t.id === id);
    if (test && test.author_id !== userId) await incrementUses(id);
    setSolImgs([]); setSolImgFiles([]); setSolMode("text"); setViewTab("test"); setViewTestId(id);
  };

  const insertSym = (sym: string) => {
    const ta = solTextRef.current;
    if (!ta) return;
    const s = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + sym + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = s + sym.length;
    ta.focus();
  };

  const submitSolutionText = async (testId: string) => {
    const text = solTextRef.current?.value.trim() || "";
    if (!text) { toast.warning("Wpisz treść rozwiązania!"); return; }
    await addSolution(testId, { author_id: userId, author_name: userName, content: text, images: [] });
    toast.success("✅ Rozwiązanie dodane!");
    reload();
  };

  const submitSolutionPhoto = async (testId: string) => {
    if (!solImgFiles.length) { toast.warning("Dodaj przynajmniej jedno zdjęcie!"); return; }
    const urls: string[] = [];
    for (const file of solImgFiles) {
      const url = await uploadTestImage(file, testId, userId);
      if (url) urls.push(url);
      else toast.error(`Nie udało się zapisać zdjęcia: ${file.name}`);
    }
    if (!urls.length) { toast.error("Żadne zdjęcie nie zostało zapisane."); return; }
    await addSolution(testId, { author_id: userId, author_name: userName, content: "", images: urls });
    setSolImgs([]); setSolImgFiles([]);
    toast.success("✅ Rozwiązanie dodane!");
    reload();
  };

  const handleDeleteSolution = async (solId: string) => {
    if (!viewTestId) return;
    await deleteSolApi(viewTestId, solId);
    toast.info("Usunięto rozwiązanie");
    reload();
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const allSubjects = [...new Set(allTests.map(t => t.subject).filter(Boolean))].sort();
  const allKlasy = [...new Set(allTests.map(t => t.klasa).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const allTeachers = [...new Set(allTests.map(t => t.teacher).filter(Boolean))].sort();
  const viewTest = viewTestId ? allTests.find(t => t.id === viewTestId) : null;

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 20,
      border: active ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
      color: active ? "#a5b4fc" : "#8899b4",
      fontWeight: 600, fontSize: ".82rem", cursor: "pointer", fontFamily: "inherit", transition: ".2s",
    }}>{children}</button>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240, color: "#8899b4", gap: 10 }}>
        <div style={{ width: 20, height: 20, border: "2px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Ładowanie testów...
      </div>
    );
  }

  return (
    <div style={s.wrap}>

      {/* Sub-tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {([["all", "Wszystkie", cntAll, "#3b82f6"], ["mine", "Moje testy", cntMine, "#3b82f6"], ["saved", "Zapisane", cntSaved, "#f59e0b"]] as const).map(([val, label, cnt, color]) => (
          <button
            key={val}
            onClick={() => { setSubtab(val); setSearch(""); }}
            style={{
              padding: "8px 14px", borderRadius: 10,
              border: subtab === val ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.06)",
              background: subtab === val ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
              color: subtab === val ? "#a5b4fc" : "#8899b4",
              fontWeight: 600, fontSize: ".88rem", cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 7, transition: ".2s",
            }}
          >
            {label}
            <span style={{ background: subtab === val ? `${color}22` : "rgba(255,255,255,0.06)", color: subtab === val ? color : "#8899b4", borderRadius: 20, padding: "1px 8px", fontSize: ".72rem", fontWeight: 800 }}>{cnt}</span>
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {subtab === "mine" && (
            <motion.button style={s.btnGrad} onClick={() => setShowCreate(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Plus size={15} /> Dodaj test
            </motion.button>
          )}
          {subtab === "all" && (
            <button
              onClick={() => setFilterOpen(p => !p)}
              style={{
                ...s.btnGhost,
                border: hasActiveFilters ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: hasActiveFilters ? "#a5b4fc" : "#8899b4",
              }}
            >
              <Filter size={14} /> Filtruj{hasActiveFilters ? " ●" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {subtab === "all" && filterOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginBottom: 16 }}
          >
            <div style={{ ...s.card, padding: "18px 20px" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)", borderRadius: "16px 16px 0 0" }} />
              {allSubjects.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={s.label}>Przedmiot</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {allSubjects.map(v => <Chip key={v} active={filters.subject === v} onClick={() => setFilters(f => ({ ...f, subject: f.subject === v ? "" : v }))}>{v}</Chip>)}
                  </div>
                </div>
              )}
              {allKlasy.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={s.label}>Klasa</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {allKlasy.map(k => <Chip key={k} active={filters.klasa === k} onClick={() => setFilters(f => ({ ...f, klasa: f.klasa === k ? "" : k }))}>Klasa {k}</Chip>)}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <div style={s.label}>Zakres</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["podstawa", "rozszerzenie"].map(v => <Chip key={v} active={filters.scope === v} onClick={() => setFilters(f => ({ ...f, scope: f.scope === v ? "" : v }))}>{SCOPE_LABEL[v]}</Chip>)}
                </div>
              </div>
              {allTeachers.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={s.label}>Nauczyciel</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {allTeachers.map(v => <Chip key={v} active={filters.teacher === v} onClick={() => setFilters(f => ({ ...f, teacher: f.teacher === v ? "" : v }))}>{v}</Chip>)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {hasActiveFilters && <button style={s.btnDanger} onClick={() => setFilters({ subject: "", klasa: "", scope: "", teacher: "" })}><X size={13} /> Wyczyść</button>}
                <button style={s.btnGhost} onClick={() => setFilterOpen(false)}>Zamknij</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      {subtab !== "saved" && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={subtab === "all" ? "Szukaj tytułu, przedmiotu, nauczyciela..." : "Szukaj wśród swoich testów..."}
            style={{ ...s.input, paddingLeft: 36 }}
          />
        </div>
      )}

      {/* Grid */}
      {tests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#475569" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.5 }}>{subtab === "saved" ? "⭐" : "📝"}</div>
          <div style={{ fontWeight: 700, color: "#8899b4", marginBottom: 8 }}>
            {subtab === "all" ? "Brak testów pasujących do filtrów." : subtab === "mine" ? "Nie masz jeszcze żadnych testów." : "Nie zapisałeś jeszcze żadnego testu."}
          </div>
          {subtab === "mine" && (
            <motion.button style={{ ...s.btnGrad, marginTop: 12 }} onClick={() => setShowCreate(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Plus size={15} /> Dodaj test
            </motion.button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {tests.map((t, idx) => {
            const liked = (t.likes || []).includes(userId);
            const starred = savedIds.includes(t.id);
            const isMe = t.author_id === userId;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                onClick={() => openQuiz(t.id)}
                whileHover={{ y: -3, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}
                style={{ ...s.card, padding: "16px", cursor: "pointer", position: "relative", overflow: "hidden", transition: "box-shadow .2s" }}
              >
                {/* top accent */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)" }} />

                {/* star */}
                <button
                  onClick={e => { e.stopPropagation(); handleToggleStar(t.id); }}
                  style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: starred ? "#f59e0b" : "#334155", transition: ".2s", padding: 0 }}
                >
                  <Star size={17} fill={starred ? "#f59e0b" : "none"} />
                </button>

                {/* tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10, paddingRight: 28 }}>
                  {t.klasa && <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>Kl. {t.klasa}</span>}
                  {t.subject && <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>{t.subject}</span>}
                  {t.scope && <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: t.scope === "rozszerzenie" ? "rgba(167,139,250,0.12)" : "rgba(52,211,153,0.1)", color: t.scope === "rozszerzenie" ? "#a78bfa" : "#34d399", border: `1px solid ${t.scope === "rozszerzenie" ? "rgba(167,139,250,0.2)" : "rgba(52,211,153,0.2)"}` }}>{SCOPE_LABEL[t.scope] || t.scope}</span>}
                </div>

                <div style={{ fontSize: ".95rem", fontWeight: 800, color: "#fff", marginBottom: 6, lineHeight: 1.3 }}>{t.title}</div>
                {t.description && <div style={{ fontSize: ".8rem", color: "#8899b4", marginBottom: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</div>}
                {t.teacher && <div style={{ fontSize: ".78rem", color: "#475569", marginBottom: 4 }}>🎓 {t.teacher}</div>}
                {t.school_name && <div style={{ fontSize: ".75rem", color: "#334155", marginBottom: 10 }}>🏫 {t.school_name}</div>}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: ".72rem", color: "#334155" }}>{t.uses || 0} wyświetleń</span>
                    <span style={{ fontSize: ".72rem", color: "#334155" }}>{ago(t.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleLike(t.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: liked ? "#ef4444" : "#334155", display: "flex", alignItems: "center", gap: 4, fontSize: ".78rem", fontWeight: 700, fontFamily: "inherit", transition: ".2s" }}
                    >
                      <Heart size={15} fill={liked ? "#ef4444" : "none"} /> {(t.likes || []).length}
                    </button>
                    {subtab === "mine" && isMe && (
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4, transition: ".2s" }}
                        onClick={() => { if (confirm("Na pewno usunąć test?")) handleDeleteTest(t.id); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div style={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
            <motion.div style={s.modal} initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }} transition={{ duration: 0.25 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)", borderRadius: "20px 20px 0 0" }} />

              {/* Modal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>📝 Dodaj test</div>
                <button onClick={() => setShowCreate(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#8899b4", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={16} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={s.label}>Temat testu *</label><input value={ntTitle} onChange={e => setNtTitle(e.target.value)} placeholder="np. Sprawdzian z całkowania" maxLength={80} style={s.input} /></div>
                  <div>
                    <label style={s.label}>Przedmiot *</label>
                    <select value={ntSubject} onChange={e => setNtSubject(e.target.value)} style={s.select}>
                      <option value="" />
                      {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={s.label}>Klasa *</label>
                    <select value={ntKlasa} onChange={e => setNtKlasa(e.target.value)} style={s.select}>
                      <option value="" />
                      {[1,2,3,4].map(k => <option key={k} value={String(k)}>Klasa {k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Zakres *</label>
                    <select value={ntScope} onChange={e => setNtScope(e.target.value)} style={s.select}>
                      <option value="" />
                      <option value="podstawa">Podstawa</option>
                      <option value="rozszerzenie">Rozszerzenie</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={s.label}>Nazwa szkoły</label><input value={ntSname} onChange={e => setNtSname(e.target.value)} placeholder="np. ZS nr 3 Warszawa" maxLength={60} style={s.input} /></div>
                  <div><label style={s.label}>Nauczyciel</label><input value={ntTeacher} onChange={e => setNtTeacher(e.target.value)} placeholder="np. mgr Kowalski" maxLength={50} style={s.input} /></div>
                </div>
                <div><label style={s.label}>Opis / zakres materiału</label><textarea value={ntDesc} onChange={e => setNtDesc(e.target.value)} rows={2} placeholder="np. Działy 4–6, funkcje trygonometryczne..." maxLength={220} style={s.textarea} /></div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <label style={{ ...s.label, marginBottom: 0 }}>Zdjęcia testu {ntImgPreviews.length > 0 && <span style={{ color: "#475569" }}>({ntImgPreviews.length})</span>}</label>
                    <button onClick={() => fileInputRef.current?.click()} style={{ ...s.btnGhost, padding: "5px 12px", fontSize: ".78rem" }}>
                      <Plus size={13} /> Dodaj
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImgUpload(e, "test")} />
                  {ntImgPreviews.length === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{ border: "2px dashed rgba(255,255,255,0.08)", borderRadius: 12, padding: "28px", textAlign: "center", cursor: "pointer", transition: ".2s" }}
                    >
                      <div style={{ fontSize: "1.8rem", opacity: 0.3, marginBottom: 6 }}>📷</div>
                      <div style={{ fontSize: ".82rem", color: "#475569", fontWeight: 600 }}>Kliknij, aby załączyć zdjęcia testu</div>
                      <div style={{ fontSize: ".72rem", color: "#334155", marginTop: 4 }}>JPG, PNG · maks. 10 MB / zdjęcie</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                      {ntImgPreviews.map((src, i) => (
                        <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden" }}>
                          <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: ".6rem", fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>{i + 1}</div>
                          <button onClick={() => { setNtImgPreviews(prev => prev.filter((_, j) => j !== i)); setNtImgFiles(prev => prev.filter((_, j) => j !== i)); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: 20, height: 20, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <div onClick={() => fileInputRef.current?.click()} style={{ aspectRatio: "1", border: "2px dashed rgba(99,102,241,0.3)", borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#475569", fontSize: ".7rem", fontWeight: 700 }}>
                        <Plus size={18} style={{ opacity: 0.4 }} /> Więcej
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={s.btnGhost} onClick={() => setShowCreate(false)}>Anuluj</button>
                <motion.button style={s.btnGrad} onClick={publishTest} disabled={publishing} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  {publishing ? "⏳ Publikowanie..." : "🚀 Opublikuj"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── View Test Modal ── */}
      <AnimatePresence>
        {viewTest && (
          <motion.div style={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) setViewTestId(null); }}>
            <motion.div style={s.modal} initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }} transition={{ duration: 0.25 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)", borderRadius: "20px 20px 0 0" }} />

              {/* Header */}
              <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                      {viewTest.klasa && <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>Kl. {viewTest.klasa}</span>}
                      {viewTest.subject && <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>{viewTest.subject}</span>}
                      {viewTest.scope && <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>{SCOPE_LABEL[viewTest.scope]}</span>}
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", marginBottom: 4 }}>{viewTest.title}</div>
                    {viewTest.teacher && <div style={{ fontSize: ".78rem", color: "#475569" }}>🎓 {viewTest.teacher}</div>}
                    {viewTest.school_name && <div style={{ fontSize: ".75rem", color: "#334155", marginTop: 2 }}>🏫 {viewTest.school_name}</div>}
                  </div>
                  <button onClick={() => setViewTestId(null)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#8899b4", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X size={16} />
                  </button>
                </div>

                {/* View tabs */}
                <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
                  {[["test", <BookOpen size={14} />, "Sprawdzian"], ["solutions", <PenLine size={14} />, `Rozwiązania${(viewTest.solutions || []).length > 0 ? ` (${(viewTest.solutions || []).length})` : ""}`]].map(([val, icon, label]) => (
                    <button
                      key={val as string}
                      onClick={() => setViewTab(val as any)}
                      style={{
                        padding: "7px 14px", borderRadius: 9, border: "none",
                        background: viewTab === val ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                        color: viewTab === val ? "#a5b4fc" : "#8899b4",
                        fontWeight: 600, fontSize: ".85rem", cursor: "pointer", fontFamily: "inherit",
                        display: "inline-flex", alignItems: "center", gap: 6, transition: ".2s",
                      }}
                    >
                      {icon as React.ReactNode} {label as string}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
                {viewTab === "test" ? (
                  viewTest.images?.length ? (
                    viewTest.images.map((src, i) => (
                      <div key={i} style={{ position: "relative", marginBottom: 10 }}>
                        <img src={src} style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", display: "block" }} />
                        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: ".65rem", fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>{i + 1}/{viewTest.images.length}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 100, border: "2px dashed rgba(255,255,255,0.06)", borderRadius: 12, color: "#334155", fontSize: ".85rem" }}>Brak zdjęć testu</div>
                  )
                ) : (
                  <>
                    {/* Add solution */}
                    <div style={{ marginBottom: 16, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, padding: "14px 16px" }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 800, color: "#a5b4fc", marginBottom: 10 }}>✏️ Dodaj swoje rozwiązanie</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        {[["text","⌨️ Tekst"],["photo","📷 Zdjęcie"]].map(([val, label]) => (
                          <button key={val} onClick={() => { setSolMode(val as any); if (val === "text") { setSolImgs([]); setSolImgFiles([]); } }}
                            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: solMode === val ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)", color: solMode === val ? "#a5b4fc" : "#8899b4", fontWeight: 600, fontSize: ".82rem", cursor: "pointer", fontFamily: "inherit", transition: ".2s" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <input ref={solFileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImgUpload(e, "sol")} />
                      {solMode === "text" ? (
                        <>
                          <button onClick={() => setSymOpen(p => !p)} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#8899b4", borderRadius: 8, padding: "7px 12px", fontSize: ".78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span>🔣 Symbole matematyczne</span>
                            {symOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {symOpen && (
                            <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                              {SYMS.map(gr => (
                                <div key={gr.g} style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: ".65rem", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{gr.g}</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {gr.s.map((sym, i) => (
                                      <button key={i} onClick={() => insertSym(sym)} style={{ padding: "4px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#c8d8f0", cursor: "pointer", fontSize: ".9rem", fontFamily: "inherit" }}>{sym}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <textarea ref={solTextRef} placeholder="Wpisz rozwiązanie…" rows={5} style={s.textarea} />
                          <motion.button style={{ ...s.btnGrad, marginTop: 10 }} onClick={() => submitSolutionText(viewTestId!)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>💾 Opublikuj rozwiązanie</motion.button>
                        </>
                      ) : (
                        solImgs.length === 0 ? (
                          <div onClick={() => solFileRef.current?.click()} style={{ border: "2px dashed rgba(255,255,255,0.08)", borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer" }}>
                            <div style={{ fontSize: "1.6rem", opacity: 0.3, marginBottom: 4 }}>📷</div>
                            <div style={{ fontSize: ".8rem", color: "#475569", fontWeight: 600 }}>Kliknij, aby dodać zdjęcia rozwiązania</div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                              {solImgs.map((src, i) => (
                                <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden" }}>
                                  <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  <button onClick={() => { setSolImgs(prev => prev.filter((_, j) => j !== i)); setSolImgFiles(prev => prev.filter((_, j) => j !== i)); }} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: 18, height: 18, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <div onClick={() => solFileRef.current?.click()} style={{ aspectRatio: "1", border: "2px dashed rgba(99,102,241,0.3)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: ".7rem", fontWeight: 700 }}>
                                <Plus size={16} style={{ opacity: 0.4 }} />
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <motion.button style={s.btnGrad} onClick={() => submitSolutionPhoto(viewTestId!)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>💾 Opublikuj</motion.button>
                              <button style={s.btnGhost} onClick={() => { setSolImgs([]); setSolImgFiles([]); }}>Anuluj</button>
                            </div>
                          </>
                        )
                      )}
                    </div>

                    {/* Existing solutions */}
                    {(viewTest.solutions || []).length === 0 ? (
                      <div style={{ textAlign: "center", padding: 28, color: "#334155", fontSize: ".84rem" }}>Nikt jeszcze nie dodał rozwiązania.<br />Bądź pierwszy!</div>
                    ) : (
                      (viewTest.solutions || []).map(sol => {
                        const isOwn = sol.author_id === userId;
                        return (
                          <div key={sol.id} style={{ marginBottom: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${!sol.confirmed ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
                              <span style={{ fontSize: ".82rem", fontWeight: 700, color: "#c8d8f0" }}>{sol.author_name}</span>
                              <span style={{ fontSize: ".7rem", color: "#334155" }}>{ago(sol.created_at)} temu</span>
                              <span style={{ fontSize: ".65rem", color: "#334155", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: 5 }}>{sol.content ? "⌨️ tekst" : "📷 zdjęcie"}</span>
                              {!sol.confirmed ? (
                                <span style={{ fontSize: ".65rem", fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>⏳ oczekuje</span>
                              ) : (
                                <span style={{ fontSize: ".65rem", fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>✓ potwierdzone</span>
                              )}
                              {isOwn && <button style={{ ...s.btnDanger, marginLeft: "auto", padding: "4px 10px" }} onClick={() => { if (confirm("Na pewno?")) handleDeleteSolution(sol.id); }}><Trash2 size={12} /> Usuń</button>}
                            </div>
                            {sol.images?.length ? (
                              <div style={{ padding: "10px 12px" }}>
                                {sol.images.map((src, i) => <img key={i} src={src} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", display: "block", marginBottom: 8 }} />)}
                              </div>
                            ) : (
                              <div style={{ padding: "12px 14px", fontSize: ".88rem", color: "#c8d8f0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sol.content || <span style={{ color: "#334155" }}>Brak treści</span>}</div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 24px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: ".82rem", color: "#8899b4", fontWeight: 600 }}>{viewTest.author_name}</span>
                  <span style={{ fontSize: ".7rem", color: "#334155" }}>{ago(viewTest.created_at)} temu</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleToggleLike(viewTestId!)}
                    style={{ ...s.btnGhost, color: (viewTest.likes || []).includes(userId) ? "#ef4444" : "#8899b4", borderColor: (viewTest.likes || []).includes(userId) ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)", padding: "7px 14px" }}
                  >
                    <Heart size={14} fill={(viewTest.likes || []).includes(userId) ? "#ef4444" : "none"} /> {(viewTest.likes || []).length}
                  </button>
                  <button onClick={() => handleToggleStar(viewTestId!)} style={{ ...s.btnGhost, color: savedIds.includes(viewTestId!) ? "#f59e0b" : "#8899b4", padding: "7px 14px" }}>
                    <Star size={14} fill={savedIds.includes(viewTestId!) ? "#f59e0b" : "none"} /> {savedIds.includes(viewTestId!) ? "Zapisano" : "Zapisz"}
                  </button>
                  <button style={s.btnGhost} onClick={() => setViewTestId(null)}>Zamknij</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TestsTab;
