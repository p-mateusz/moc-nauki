import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { t, type Language, LANGUAGE_META, DEFAULT_LANGUAGE_ORDER } from "@/lib/i18n";
import { usePreferences } from "@/hooks/use-preferences";

type WordList = {
  id: string;
  name: string;
  created_at: string;
  wordCount: number;
  mastered: number;
  total: number;
  shareSlug: string | null;
};

type LanguagesTabProps = {
  userId: string;
};

const legacyCopy = (text: string): boolean => {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

const LANG_ORDER_KEY = "languageOrder";

const loadLangOrder = (): Language[] => {
  try {
    const raw = localStorage.getItem(LANG_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Language[];
      const filtered = parsed.filter((l) => LANGUAGE_META[l]);
      const missing = DEFAULT_LANGUAGE_ORDER.filter((l) => !filtered.includes(l));
      return [...filtered, ...missing];
    }
  } catch {}
  return [...DEFAULT_LANGUAGE_ORDER];
};

const LanguagesTab = ({ userId }: LanguagesTabProps) => {
  const guestMode = localStorage.getItem("guestMode") === "true";
  const guestListId = localStorage.getItem("guestListId");
  const { prefs } = usePreferences();
  const hiddenLangs = prefs.hiddenLanguages || [];
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem("language") as Language) || "en"
  );
  const [langOrder, setLangOrder] = useState<Language[]>(loadLangOrder);
  const visibleOrder = guestMode
    ? langOrder
    : langOrder.filter((l) => !hiddenLangs.includes(l));
  const [dragLang, setDragLang] = useState<Language | null>(null);
  const [dragOverLang, setDragOverLang] = useState<Language | null>(null);
  const [lists, setLists] = useState<WordList[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const deleteTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const persistLangOrder = (order: Language[]) => {
    setLangOrder(order);
    try {
      localStorage.setItem(LANG_ORDER_KEY, JSON.stringify(order));
    } catch {}
  };

  const handleLangDragStart = (e: React.DragEvent, l: Language) => {
    setDragLang(l);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", l);
  };
  const handleLangDragOver = (e: React.DragEvent, l: Language) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragLang && dragLang !== l) setDragOverLang(l);
  };
  const handleLangDrop = (e: React.DragEvent, target: Language) => {
    e.preventDefault();
    setDragOverLang(null);
    if (!dragLang || dragLang === target) { setDragLang(null); return; }
    const from = langOrder.indexOf(dragLang);
    const to = langOrder.indexOf(target);
    if (from === -1 || to === -1) { setDragLang(null); return; }
    const next = [...langOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistLangOrder(next);
    setDragLang(null);
  };
  const handleLangDragEnd = () => {
    setDragLang(null);
    setDragOverLang(null);
  };

  useEffect(() => {
    localStorage.setItem("language", lang);
    fetchLists();
  }, [lang]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (guestMode) return;
    const missing = lists.filter((l) => !l.shareSlug);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const list of missing) {
        const slug = await ensureSlug(list.id, list.name);
        if (cancelled || !slug) continue;
        setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, shareSlug: slug } : l)));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists.length, guestMode]);

  const fetchLists = async () => {
    if (guestMode && guestListId) {
      setLoading(true);
      const { data: list } = await supabase
        .from("word_lists")
        .select("id, name, created_at, language")
        .eq("id", guestListId)
        .single();

      if (!list) { setLoading(false); return; }

      if (list.language && (list.language in LANGUAGE_META)) {
        setLang(list.language as Language);
        localStorage.setItem("language", list.language);
      }

      const { count: wordCount } = await supabase
        .from("words")
        .select("*", { count: "exact", head: true })
        .eq("list_id", guestListId);

      setLists([{
        id: list.id,
        name: list.name,
        created_at: list.created_at,
        wordCount: wordCount || 0,
        mastered: 0,
        total: 0,
        shareSlug: null,
      }]);
      setLoading(false);
      return;
    }

    if (!userId) return;
    setLoading(true);
    const { data: wordLists } = await supabase
      .from("word_lists")
      .select("id, name, created_at, share_slug")
      .eq("user_id", userId)
      .eq("language", lang)
      .order("created_at", { ascending: false });

    if (!wordLists) { setLoading(false); return; }

    const enriched = await Promise.all(
      wordLists.map(async (list) => {
        const { count: wordCount } = await supabase
          .from("words")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        const { data: progress } = await supabase
          .from("practice_progress")
          .select("mastered")
          .eq("list_id", list.id)
          .eq("user_id", userId);
        const mastered = progress?.filter((p) => p.mastered).length || 0;
        return {
          id: list.id,
          name: list.name,
          created_at: list.created_at,
          wordCount: wordCount || 0,
          mastered,
          total: progress?.length || 0,
          shareSlug: (list as { share_slug: string | null }).share_slug ?? null,
        };
      })
    );
    setLists(enriched);
    setLoading(false);
  };

  const handleDeleteClick = async (listId: string) => {
    if (pendingDeleteId !== listId) {
      setPendingDeleteId(listId);
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = window.setTimeout(() => {
        setPendingDeleteId(null);
      }, 3000);
      return;
    }
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDeleteId(null);
    await supabase.from("practice_progress").delete().eq("list_id", listId);
    await supabase.from("words").delete().eq("list_id", listId);
    await supabase.from("word_lists").delete().eq("id", listId);
    toast.success(t("listDeleted", lang));
    fetchLists();
  };

  const startEditingName = (list: WordList) => {
    if (guestMode) return;
    setEditingNameId(list.id);
    setEditingNameValue(list.name);
  };

  const commitNameEdit = async () => {
    if (!editingNameId) return;
    const original = lists.find((l) => l.id === editingNameId);
    const trimmed = editingNameValue.trim();
    const id = editingNameId;
    setEditingNameId(null);
    if (!original || !trimmed || trimmed === original.name) return;
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: trimmed } : l)));
    const { error } = await supabase
      .from("word_lists")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) {
      toast.error("Błąd zapisu nazwy");
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: original.name } : l)));
      return;
    }
    toast.success(t("listRenamed", lang));
  };

  const cancelNameEdit = () => {
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);

  const ensureSlug = async (listId: string, listName: string): Promise<string | null> => {
    const { data: existing } = await supabase
      .from("word_lists")
      .select("share_slug")
      .eq("id", listId)
      .maybeSingle();

    let slug = (existing?.share_slug as string | null | undefined) ?? null;
    if (slug) return slug;

    const base = slugify(listName) || "lista";
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = Math.random().toString(36).slice(2, 7);
      const candidate = `${base}-${suffix}`;
      const { error } = await supabase
        .from("word_lists")
        .update({ share_slug: candidate })
        .eq("id", listId);
      if (!error) { slug = candidate; break; }
    }
    return slug;
  };

  const flashCopied = (listId: string) => {
    setCopiedId(listId);
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedId((prev) => (prev === listId ? null : prev));
    }, 1800);
  };

  const handleShare = (list: WordList) => {
    if (list.shareSlug) {
      const url = `${window.location.origin}/s/${list.shareSlug}`;
      try {
        navigator.clipboard?.writeText(url);
        flashCopied(list.id);
        toast.success(t("linkCopied", lang));
        return;
      } catch {}
      const ok = legacyCopy(url);
      if (ok) {
        flashCopied(list.id);
        toast.success(t("linkCopied", lang));
      } else {
        toast.error("Nie udało się skopiować linku");
      }
      return;
    }

    const supportsAsyncWrite =
      typeof window !== "undefined" &&
      typeof window.ClipboardItem !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function";

    if (supportsAsyncWrite) {
      const blobPromise = ensureSlug(list.id, list.name).then((slug) => {
        const url = slug
          ? `${window.location.origin}/s/${slug}`
          : `${window.location.origin}/share/${list.id}`;
        if (slug) {
          setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, shareSlug: slug } : l)));
        }
        return new Blob([url], { type: "text/plain" });
      });
      navigator.clipboard
        .write([new ClipboardItem({ "text/plain": blobPromise })])
        .then(() => {
          flashCopied(list.id);
          toast.success(t("linkCopied", lang));
        })
        .catch(async () => {
          const blob = await blobPromise.catch(() => null);
          const url = blob ? await blob.text() : "";
          const ok = url ? legacyCopy(url) : false;
          if (ok) {
            flashCopied(list.id);
            toast.success(t("linkCopied", lang));
          } else {
            toast.error("Nie udało się skopiować linku");
          }
        });
      return;
    }

    (async () => {
      const slug = await ensureSlug(list.id, list.name);
      const url = slug
        ? `${window.location.origin}/s/${slug}`
        : `${window.location.origin}/share/${list.id}`;
      if (slug) {
        setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, shareSlug: slug } : l)));
      }
      const ok = legacyCopy(url);
      if (ok) {
        flashCopied(list.id);
        toast.success(t("linkCopied", lang));
      } else {
        toast.error("Nie udało się skopiować linku");
      }
    })();
  };

  return (
    <div className="md-content">
      <div className="md-page-title">
        {guestMode ? "📚 Lista udostępniona Tobie" : "🌍 Języki AI"}
      </div>
      <div className="md-page-sub">
        {guestMode
          ? "Ucz się słówek z tej listy — kliknij Ćwicz, Fiszki lub Quiz poniżej"
          : "Nauka słówek z AI · ćwiczenia i fiszki"}
      </div>

      {guestMode && lists.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(59,130,246,0.12))",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: ".85rem",
            color: "#c8d8f0",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>✨</span>
          <span>
            Otrzymałeś listę <b style={{ color: "#fff" }}>„{lists[0].name}"</b> ({lists[0].wordCount}{" "}
            {t("words", lang)}). Możesz od razu zacząć naukę poniżej.
          </span>
        </div>
      )}

      {/* Language Selector — draggable to reorder */}
      {!guestMode && (
        <div className="md-lang-selector" style={{ flexWrap: "wrap" }}>
          {langOrder.map((l) => {
            const meta = LANGUAGE_META[l];
            const isDragging = dragLang === l;
            const isOver = dragOverLang === l;
            return (
              <button
                key={l}
                draggable
                onDragStart={(e) => handleLangDragStart(e, l)}
                onDragOver={(e) => handleLangDragOver(e, l)}
                onDragLeave={() => setDragOverLang(null)}
                onDrop={(e) => handleLangDrop(e, l)}
                onDragEnd={handleLangDragEnd}
                className={`md-lang-btn ${lang === l ? "active" : ""}`}
                onClick={() => setLang(l)}
                title="Przeciągnij, aby zmienić kolejność"
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  outline: isOver ? "2px dashed rgba(99,102,241,0.7)" : undefined,
                  cursor: "grab",
                }}
              >
                {meta.flag} {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* New List Button */}
      {!guestMode && (
        <button
          className="md-btn md-btn-prim md-new-list-btn"
          onClick={() => navigate("/create")}
        >
          + {t("newList", lang)}
        </button>
      )}

      {/* Lists */}
      {loading ? (
        <div className="md-empty-state">
          <p>{t("loading", lang)}</p>
        </div>
      ) : lists.length === 0 ? (
        <div className="md-empty-state">
          <div className="md-es-icon">📚</div>
          <p>{t("noListsYet", lang)}</p>
        </div>
      ) : (
        lists.map((list) => {
          const pct =
            list.wordCount > 0
              ? Math.round((list.mastered / list.wordCount) * 100)
              : 0;
          const isEditing = editingNameId === list.id;
          const isPendingDelete = pendingDeleteId === list.id;
          return (
            <div key={list.id} className="md-word-list-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        cancelNameEdit();
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: ".95rem",
                      fontWeight: 800,
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.45)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      color: "#fff",
                      outline: "none",
                    }}
                  />
                ) : (
                  <div
                    onClick={() => startEditingName(list)}
                    title={!guestMode ? t("renameList", lang) : undefined}
                    style={{
                      fontSize: ".95rem",
                      fontWeight: 800,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: guestMode ? "default" : "text",
                      padding: "6px 8px",
                      borderRadius: 8,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!guestMode) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {list.name}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!guestMode && (
                    <button
                      className="md-icon-btn"
                      title={t("viewWords", lang)}
                      onClick={() => navigate(`/list/${list.id}`)}
                    >
                      👁️
                    </button>
                  )}
                  {!guestMode && (
                    <button
                      className="md-icon-btn"
                      title={copiedId === list.id ? "Skopiowano!" : t("shareList", lang)}
                      onClick={() => handleShare(list)}
                      style={
                        copiedId === list.id
                          ? {
                              background: "rgba(52,211,153,0.18)",
                              borderColor: "rgba(52,211,153,0.55)",
                              color: "#34d399",
                            }
                          : undefined
                      }
                    >
                      {copiedId === list.id ? "✅" : "🔗"}
                    </button>
                  )}
                  {!guestMode && (
                    <button
                      className="md-icon-btn"
                      title={isPendingDelete ? "Kliknij ponownie, aby potwierdzić" : t("deleteList", lang)}
                      onClick={() => handleDeleteClick(list.id)}
                      style={
                        isPendingDelete
                          ? {
                              background: "rgba(248,113,113,0.18)",
                              borderColor: "rgba(248,113,113,0.55)",
                              color: "#fca5a5",
                              animation: "mdDeletePulse 1.2s ease-in-out infinite",
                            }
                          : undefined
                      }
                    >
                      {isPendingDelete ? (
                        <AlertTriangle size={15} strokeWidth={2.4} />
                      ) : (
                        <Trash2 size={15} strokeWidth={2.2} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: ".78rem",
                  color: "#8899b4",
                  marginBottom: 6,
                }}
              >
                <span>
                  {list.wordCount} {t("words", lang)}
                </span>
                <span>
                  {list.mastered}/{list.wordCount} {t("mastered", lang)} ({pct}%)
                </span>
              </div>

              <div className="md-progress-bar">
                <div
                  className="md-progress-fill"
                  style={{
                    width: `${pct}%`,
                    background:
                      pct >= 100 && list.wordCount > 0
                        ? "linear-gradient(90deg, #10b981, #34d399)"
                        : undefined,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="md-btn md-btn-prim"
                  style={{ flex: 1, fontSize: ".8rem", padding: "8px 12px" }}
                  onClick={() => navigate(`/practice/${list.id}`)}
                >
                  📝 {t("practiceList", lang)}
                </button>
                <button
                  className="md-btn"
                  style={{ flex: 1, fontSize: ".8rem", padding: "8px 12px" }}
                  onClick={() => navigate(`/flashcards/${list.id}`)}
                >
                  🧠 {t("flashcards", lang)}
                </button>
                <button
                  className="md-btn"
                  style={{ flex: 1, fontSize: ".8rem", padding: "8px 12px" }}
                  onClick={() => navigate(`/quiz/${list.id}`)}
                >
                  🎯 Quiz
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default LanguagesTab;
