import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Upload, Loader2, Camera, Sparkles, List } from "lucide-react";
import { t, getLang } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

type WordEntry = { word: string; definition: string; sentence?: string; hint?: string };
const MAX_WORDS_PER_LIST = 300;

const CreateList = () => {
  const [searchParams] = useSearchParams();
  const draftParam = searchParams.get("draft");

  const [listName, setListName] = useState("");
  const [words, setWords] = useState<WordEntry[]>([{ word: "", definition: "" }]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState<"A1" | "A2" | "B1" | "B2" | "C1" | "C2">("B2");
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [defLang, setDefLang] = useState<"target" | "pl">("target");
  const [activeTab, setActiveTab] = useState<"manual" | "bulk" | "photo">("manual");

  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const lang = getLang();

  const draftIdRef = useRef<string | null>(draftParam);
  const submittedRef = useRef(false);
  const stateRef = useRef({ listName: "", words: [] as WordEntry[], specialInstructions: "", defLang: "target" as "target" | "pl" });

  useEffect(() => {
    stateRef.current = { listName, words, specialInstructions, defLang };
  }, [listName, words, specialInstructions, defLang]);

  // Load draft data if ?draft=<id>
  useEffect(() => {
    if (!draftParam || !userId) return;
    (async () => {
      try {
        const { data: list } = await supabase
          .from("word_lists")
          .select("id, name, special_instructions, definition_language, user_id")
          .eq("id", draftParam)
          .maybeSingle();
        if (!list || list.user_id !== userId) {
          toast.error("Nie znaleziono wersji roboczej");
          navigate("/dashboard");
          return;
        }
        setListName(list.name && list.name !== "Wersja robocza" ? list.name : "");
        setSpecialInstructions(list.special_instructions || "");
        setDefLang(list.definition_language === "pl" ? "pl" : "target");

        const { data: ws } = await supabase
          .from("words")
          .select("id, word, definition")
          .eq("list_id", draftParam)
          .order("created_at");
        const { data: sents } = await supabase
          .from("generated_sentences")
          .select("word_id, sentence, hint")
          .eq("list_id", draftParam);
        const sentByWord = new Map<string, { sentence: string; hint: string }>();
        (sents || []).forEach((s: any) => sentByWord.set(s.word_id, { sentence: s.sentence || "", hint: s.hint || "" }));
        const loaded: WordEntry[] = (ws || []).map((w: any) => {
          const s = sentByWord.get(w.id);
          return { word: w.word || "", definition: w.definition || "", sentence: s?.sentence || "", hint: s?.hint || "" };
        });
        if (loaded.length > 0) setWords(loaded);
      } catch (e) {
        console.error("draft load error", e);
      }
    })();
  }, [draftParam, userId]);

  // Save as draft (insert or update)
  const saveDraft = async (): Promise<string | null> => {
    if (!userId) return null;
    const snap = stateRef.current;
    const validWords = snap.words.filter((w) => w.word.trim());
    if (!snap.listName.trim() && validWords.length === 0) return null;
    try {
      let listId = draftIdRef.current;
      if (!listId) {
        const { data: list, error } = await supabase
          .from("word_lists")
          .insert({
            name: snap.listName.trim() || "Wersja robocza",
            user_id: userId,
            special_instructions: snap.specialInstructions.trim() || null,
            language: lang,
            definition_language: snap.defLang === "pl" ? "pl" : "target",
            is_draft: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        listId = list.id;
        draftIdRef.current = listId;
      } else {
        await supabase
          .from("word_lists")
          .update({
            name: snap.listName.trim() || "Wersja robocza",
            special_instructions: snap.specialInstructions.trim() || null,
            definition_language: snap.defLang === "pl" ? "pl" : "target",
            is_draft: true,
          })
          .eq("id", listId);
        await supabase.from("generated_sentences").delete().eq("list_id", listId);
        await supabase.from("words").delete().eq("list_id", listId);
      }
      if (validWords.length > 0 && listId) {
        await supabase.from("words").insert(
          validWords.map((w) => ({ list_id: listId!, word: w.word.trim(), definition: w.definition.trim() || null }))
        );
      }
      return listId;
    } catch (e) {
      console.error("saveDraft error", e);
      return null;
    }
  };

  // On unmount: persist draft if user has typed something and didn't submit
  useEffect(() => {
    return () => {
      if (submittedRef.current) return;
      const snap = stateRef.current;
      const hasContent = snap.listName.trim() || snap.words.some((w) => w.word.trim());
      if (hasContent) {
        saveDraft().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addWord = () => {
    if (words.length >= MAX_WORDS_PER_LIST) { toast.error(`Lista może mieć maksymalnie ${MAX_WORDS_PER_LIST} słów`); return; }
    setWords([...words, { word: "", definition: "" }]);
  };
  const removeWord = (i: number) => { if (words.length <= 1) return; setWords(words.filter((_, idx) => idx !== i)); };
  const updateWord = (i: number, field: keyof WordEntry, value: string) => {
    const updated = [...words]; updated[i] = { ...updated[i], [field]: value }; setWords(updated);
  };

  const handleOCR = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setOcrLoading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file, file.name || "image.png");
        fd.append("language", lang);
        fd.append("definitionLanguage", defLang);
        const { data, error } = await supabase.functions.invoke("ocr-extract", { body: fd });
        if (error) throw error;
        if (data?.words?.length) {
          setWords((prev) => {
            const cleaned = prev.filter((w) => w.word.trim());
            const availableSlots = MAX_WORDS_PER_LIST - cleaned.length;
            if (availableSlots <= 0) return cleaned;
            return [...cleaned, ...data.words.slice(0, availableSlots).map((w: any) => ({ word: w.word || "", definition: w.definition || "" }))];
          });
          toast.success(`${data.words.length} ${t("wordsExtracted", lang)}`);
        } else { toast.info(t("noWordsInImage", lang)); }
      }
    } catch (e: any) { toast.error(t("errorProcessingImage", lang)); console.error(e); }
    finally { setOcrLoading(false); }
  };

  const [genProgress, setGenProgress] = useState(0);
  const [genMessage, setGenMessage] = useState("");

  const handleBulkGenerate = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const existingCount = words.filter((w) => w.word.trim()).length;
    if (existingCount + lines.length > MAX_WORDS_PER_LIST) { toast.error(`Lista może mieć maksymalnie ${MAX_WORDS_PER_LIST} słów`); return; }
    setBulkLoading(true);
    setGenProgress(0);
    setGenMessage("Wysyłanie słów do AI...");
    const progressInterval = setInterval(() => {
      setGenProgress((prev) => {
        if (prev < 30) { setGenMessage("Wysyłanie słów do AI..."); return prev + 2; }
        if (prev < 60) { setGenMessage("AI generuje definicje..."); return prev + 1; }
        if (prev < 85) { setGenMessage("Prawie gotowe, jeszcze chwilka..."); return prev + 0.3; }
        return prev;
      });
    }, 1000);
    try {
      const { getStoredAccessToken } = await import("@/lib/supabase");
      const accessToken = getStoredAccessToken();
      if (!accessToken) throw new Error("Musisz być zalogowany.");
      const { data, error } = await supabase.functions.invoke("generate-definitions", {
        body: { words: lines, language: lang, definitionLanguage: defLang, specialInstructions },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      clearInterval(progressInterval);
      setGenProgress(100);
      setGenMessage("Gotowe!");
      if (error) throw error;
      if (data?.definitions?.length) {
        setWords((prev) => {
          const cleaned = prev.filter((w) => w.word.trim());
          return [...cleaned, ...data.definitions.map((d: any) => ({ word: d.word || "", definition: d.definition || "", sentence: "", hint: d.definition || "" }))];
        });
        toast.success(`${data.definitions.length} ${t("wordsAdded", lang)}`);
        setBulkText("");
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      console.error("generate definitions failed", e);
      let message = "Wystąpił błąd. Spróbuj ponownie za chwilę — generowanie może trwać do 2 minut.";
      try {
        if (e?.context instanceof Response) {
          const payload = await e.context.clone().json().catch(async () => ({ error: await e.context.clone().text() }));
          message = payload?.error || payload?.message || payload?.detail || message;
        } else if (e?.message) {
          message = e.message;
        }
      } catch {}
      toast.error(message);
    } finally { setTimeout(() => setBulkLoading(false), 500); }
  };

  const [sentenceProgress, setSentenceProgress] = useState(0);
  const [sentenceMessage, setSentenceMessage] = useState("");
  const [sentenceLoading, setSentenceLoading] = useState(false);

  const handleSave = async () => {
    if (!userId) return navigate("/login");
    const validWords = words.filter((w) => w.word.trim() && w.definition.trim());
    if (!listName.trim()) return toast.error(t("writeListName", lang));
    if (validWords.length === 0) return toast.error("Każde słowo musi mieć definicję.");
    if (validWords.length > MAX_WORDS_PER_LIST) return toast.error(`Lista może mieć maksymalnie ${MAX_WORDS_PER_LIST} słów`);
    setSaving(true);
    try {
      let listId = draftIdRef.current;
      if (listId) {
        // Update existing draft (clean slate for words/sentences)
        const { error: updErr } = await supabase.from("word_lists")
          .update({ name: listName.trim(), special_instructions: specialInstructions.trim() || null, language: lang, definition_language: defLang === "pl" ? "pl" : "target", is_draft: false })
          .eq("id", listId);
        if (updErr) throw updErr;
        await supabase.from("generated_sentences").delete().eq("list_id", listId);
        await supabase.from("words").delete().eq("list_id", listId);
      } else {
        const { data: list, error: listError } = await supabase.from("word_lists")
          .insert({ name: listName.trim(), user_id: userId, special_instructions: specialInstructions.trim() || null, language: lang, definition_language: defLang === "pl" ? "pl" : "target", is_draft: false })
          .select("id").single();
        if (listError) throw listError;
        listId = list.id;
        draftIdRef.current = listId;
      }
      const wordInserts = validWords.map((w) => ({ list_id: listId!, word: w.word.trim(), definition: w.definition.trim() || null }));
      const { data: insertedWords, error: wordsError } = await supabase.from("words").insert(wordInserts).select("id, word");
      if (wordsError) throw wordsError;
      const wordsWithSentences = validWords.filter((w) => w.sentence?.trim());
      const sentencesToInsert = wordsWithSentences.map((w) => {
        const wordId = insertedWords?.find((iw) => iw.word === w.word.trim())?.id;
        return { word_id: wordId || "", list_id: listId!, word: w.word.trim(), definition: w.definition.trim() || "", sentence: w.sentence?.trim() || "", hint: w.hint || w.definition.trim() || "" };
      }).filter((s) => s.word_id);
      if (sentencesToInsert.length > 0) {
        await supabase.from("generated_sentences").insert(sentencesToInsert);
      }
      const wordsWithoutSentences = validWords.filter((w) => !w.sentence?.trim());
      if (wordsWithoutSentences.length > 0) {
        setSaving(false);
        setSentenceLoading(true);
        setSentenceProgress(0);
        setSentenceMessage("Wysyłanie słów do AI...");
        const progressInterval = setInterval(() => {
          setSentenceProgress((prev) => {
            if (prev < 25) { setSentenceMessage("Wysyłanie słów do AI..."); return prev + 2; }
            if (prev < 50) { setSentenceMessage("AI generuje zdania przykładowe..."); return prev + 1; }
            if (prev < 75) { setSentenceMessage("Przetwarzanie odpowiedzi..."); return prev + 0.5; }
            if (prev < 90) { setSentenceMessage("Prawie gotowe, jeszcze chwilka..."); return prev + 0.2; }
            return prev;
          });
        }, 1000);
        try { await supabase.from("word_lists").update({ sentences_generating: true }).eq("id", listId!); } catch {}
        try {
          clearInterval(progressInterval);
          setSentenceProgress(95);
          const { data: triggerData, error: triggerError } = await supabase.functions.invoke("trigger-sentences-generation", {
            body: { listId: listId!, userId, language: lang, definitionLanguage: defLang, specialInstructions: specialInstructions.trim() || "", proficiencyLevel },
          });
          if (triggerError) throw triggerError;
          setSentenceProgress(100);
          setSentenceMessage("Gotowe!");
          submittedRef.current = true;
          setTimeout(() => { setSentenceLoading(false); toast.success(t("listCreated", lang)); navigate("/dashboard"); }, 500);
        } catch (sentErr: any) {
          clearInterval(progressInterval);
          // Mark as draft so the user can resume later
          try { await supabase.from("word_lists").update({ sentences_generating: false, is_draft: true }).eq("id", listId!); } catch {}
          setSentenceLoading(false);
          submittedRef.current = true; // we already saved data; don't double-save on unmount
          toast.error("Generowanie zdań nie powiodło się — lista została zapisana jako wersja robocza");
          navigate("/dashboard");
        }
      } else {
        submittedRef.current = true;
        toast.success(t("listCreated", lang));
        navigate("/dashboard");
      }
    } catch (e: any) { toast.error(t("errorSaving", lang)); console.error(e); setSaving(false); }
  };

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#060d1a",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#f1f5f9",
    position: "relative",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#f1f5f9",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: ".95rem",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color .2s",
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical" as const,
    minHeight: 100,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: ".75rem",
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: ".08em",
    marginBottom: 8,
  };

  const cardStyle: React.CSSProperties = {
    background: "#0f1117",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "20px",
  };

  const validWordCount = words.filter(w => w.word.trim() && w.definition.trim()).length;

  return (
    <div style={pageStyle}>
      {/* Blobs */}
      <div style={{ position: "fixed", top: "-15%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-15%", right: "-10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(6,13,26,0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 10,
          padding: "0 20px",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#c8d8f0", width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <ArrowLeft size={18} />
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: 0 }}>{t("createList", lang)}</h1>
              {validWordCount > 0 && (
                <div style={{ fontSize: ".72rem", color: "#8899b4", marginTop: 2 }}>{validWordCount} słów gotowych</div>
              )}
            </div>
            <motion.button
              onClick={handleSave}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: saving ? "rgba(59,130,246,0.3)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: saving ? "#475569" : "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: ".88rem",
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow: saving ? "none" : "0 4px 16px rgba(59,130,246,0.3)",
              }}
            >
              {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : t("save", lang)}
            </motion.button>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>

          {/* List name */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Nazwa listy</label>
            <input
              placeholder={t("listName", lang)}
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              style={{ ...inputStyle, fontSize: "1.1rem", fontWeight: 600, padding: "14px 18px" }}
            />
          </motion.div>

          {/* Definition language */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} style={{ ...cardStyle, marginBottom: 20 }}>
            <label style={labelStyle}>{t("definitionLanguage", lang)}</label>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { val: "target", label: t("defInTargetLang", lang) },
                { val: "pl", label: t("defInPolish", lang) },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setDefLang(opt.val as any)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: defLang === opt.val ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: defLang === opt.val ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                    color: defLang === opt.val ? "#a5b4fc" : "#8899b4",
                    fontWeight: 600,
                    fontSize: ".88rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: ".2s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {[
                { val: "manual", label: t("manual", lang), icon: <List size={14} /> },
                { val: "bulk", label: t("bulk", lang), icon: <Sparkles size={14} /> },
                { val: "photo", label: t("photo", lang), icon: <Camera size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.val}
                  onClick={() => setActiveTab(tab.val as any)}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: "none",
                    background: activeTab === tab.val ? "rgba(99,102,241,0.2)" : "transparent",
                    color: activeTab === tab.val ? "#a5b4fc" : "#8899b4",
                    fontWeight: 600,
                    fontSize: ".85rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: ".2s",
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "manual" && (
                <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {words.map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        style={{ display: "flex", gap: 10, alignItems: "center" }}
                      >
                        <input
                          placeholder={t("wordPlaceholder", lang)}
                          value={entry.word}
                          onChange={(e) => updateWord(i, "word", e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <input
                          placeholder={t("definitionPlaceholder", lang)}
                          value={entry.definition}
                          onChange={(e) => updateWord(i, "definition", e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          onClick={() => removeWord(i)}
                          disabled={words.length <= 1}
                          style={{
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            color: words.length <= 1 ? "#334155" : "#ef4444",
                            width: 36, height: 36, borderRadius: 9,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: words.length <= 1 ? "not-allowed" : "pointer",
                            flexShrink: 0, transition: ".2s",
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  <button
                    onClick={addWord}
                    style={{
                      width: "100%", marginTop: 12,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px dashed rgba(255,255,255,0.12)",
                      color: "#8899b4",
                      padding: "11px",
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: ".9rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: ".2s",
                    }}
                  >
                    <Plus size={16} /> {t("addWord", lang)}
                  </button>
                </motion.div>
              )}

              {activeTab === "bulk" && (
                <motion.div key="bulk" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <p style={{ color: "#8899b4", fontSize: ".88rem", marginBottom: 12, lineHeight: 1.6 }}>{t("bulkHint", lang)}</p>
                  <textarea
                    placeholder={t("bulkPlaceholder", lang)}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={8}
                    style={textareaStyle}
                  />
                  <motion.button
                    onClick={handleBulkGenerate}
                    disabled={bulkLoading || !bulkText.trim()}
                    whileHover={!bulkLoading && bulkText.trim() ? { scale: 1.01 } : {}}
                    whileTap={!bulkLoading && bulkText.trim() ? { scale: 0.98 } : {}}
                    style={{
                      width: "100%", marginTop: 12,
                      background: bulkLoading || !bulkText.trim() ? "rgba(59,130,246,0.2)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
                      color: bulkLoading || !bulkText.trim() ? "#475569" : "#fff",
                      border: "none", padding: "13px",
                      borderRadius: 12, fontWeight: 700, fontSize: ".95rem",
                      cursor: bulkLoading || !bulkText.trim() ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    {bulkLoading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> {t("generatingDefs", lang)}</> : t("bulkAdd", lang)}
                  </motion.button>
                </motion.div>
              )}

              {activeTab === "photo" && (
                <motion.div key="photo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <div style={{
                    ...cardStyle,
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 16, padding: "40px 28px", textAlign: "center",
                    border: "1px dashed rgba(255,255,255,0.1)",
                  }}>
                    {ocrLoading ? (
                      <>
                        <Loader2 size={36} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
                        <p style={{ color: "#8899b4", fontSize: ".9rem" }}>{t("extracting", lang)}</p>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Camera size={28} color="#60a5fa" />
                        </div>
                        <div>
                          <p style={{ color: "#fff", fontWeight: 700, marginBottom: 4 }}>{t("uploadPhotos", lang)}</p>
                          <p style={{ color: "#8899b4", fontSize: ".85rem" }}>Zdjęcia ze słówkami zostaną automatycznie przetworzone przez AI</p>
                        </div>
                        <label style={{ cursor: "pointer" }}>
                          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleOCR(e.target.files)} />
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
                            color: "#60a5fa", padding: "10px 20px", borderRadius: 10,
                            fontWeight: 600, fontSize: ".9rem", transition: ".2s",
                          }}>
                            <Upload size={16} /> {t("selectPhotos", lang)}
                          </span>
                        </label>
                        {words.some((w) => w.word.trim()) && (
                          <p style={{ color: "#34d399", fontSize: ".85rem", fontWeight: 600 }}>
                            ✓ {words.filter((w) => w.word.trim()).length} {t("wordsInList", lang)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Special instructions */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} style={{ ...cardStyle, marginBottom: 20 }}>
            <label style={labelStyle}>{t("specialInstructions", lang)}</label>
            <textarea
              placeholder={t("specialInstructionsPlaceholder", lang)}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={2}
              style={textareaStyle}
            />
          </motion.div>

          {/* Proficiency level */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} style={{ ...cardStyle, marginBottom: 28 }}>
            <label style={labelStyle}>Poziom zaawansowania zdań</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {(["A1", "A2", "B1", "B2", "C1", "C2"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setProficiencyLevel(level)}
                  style={{
                    padding: "9px 4px",
                    borderRadius: 9,
                    border: proficiencyLevel === level ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: proficiencyLevel === level ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                    color: proficiencyLevel === level ? "#a5b4fc" : "#8899b4",
                    fontWeight: 700,
                    fontSize: ".85rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: ".2s",
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Save button (bottom) */}
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileHover={!saving ? { scale: 1.01, boxShadow: "0 8px 30px rgba(59,130,246,0.45)" } : {}}
            whileTap={!saving ? { scale: 0.98 } : {}}
            style={{
              width: "100%",
              background: saving ? "rgba(59,130,246,0.2)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: saving ? "#475569" : "#fff",
              border: "none", padding: "15px",
              borderRadius: 14, fontWeight: 700, fontSize: "1rem",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: saving ? "none" : "0 4px 20px rgba(59,130,246,0.3)",
            }}
          >
            {saving ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> {t("saving", lang)}</> : t("save", lang)}
          </motion.button>

        </main>
      </div>

      {/* Bulk loading dialog */}
      <Dialog open={bulkLoading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
            <Loader2 size={40} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            <p style={{ textAlign: "center", fontWeight: 600, color: "#f1f5f9" }}>{genMessage}</p>
            <Progress value={genProgress} className="w-full" />
            <p style={{ fontSize: ".78rem", color: "#8899b4", textAlign: "center" }}>Generowanie może zająć do 2 minut w zależności od liczby słów.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sentence loading dialog */}
      <Dialog open={sentenceLoading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
            <Loader2 size={40} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            <p style={{ textAlign: "center", fontWeight: 600, color: "#f1f5f9" }}>{sentenceMessage}</p>
            <Progress value={sentenceProgress} className="w-full" />
            <p style={{ fontSize: ".78rem", color: "#8899b4", textAlign: "center" }}>Generowanie zdań przykładowych może zająć do 2 minut.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateList;
