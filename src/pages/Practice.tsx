import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  RotateCcw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { t, getLang } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

type SentenceItem = {
  wordId: string;
  word: string;
  definition: string;
  sentence: string;
  hint: string;
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#060d1a",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  color: "#f1f5f9",
  position: "relative",
  overflow: "hidden",
};


const blob1Style: React.CSSProperties = {
  position: "fixed",
  top: "-15%",
  left: "-10%",
  width: 500,
  height: 500,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
  pointerEvents: "none",
  zIndex: 0,
};

const blob2Style: React.CSSProperties = {
  position: "fixed",
  bottom: "-15%",
  right: "-10%",
  width: 400,
  height: 400,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)",
  pointerEvents: "none",
  zIndex: 0,
};

const cardStyle: React.CSSProperties = {
  background: "#0f1117",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: "32px 28px",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 0 40px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
  color: "#fff",
  border: "none",
  padding: "14px 24px",
  borderRadius: 14,
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 6px 24px rgba(59,130,246,0.35)",
};

const secondaryBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  color: "#dbeafe",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "13px 24px",
  borderRadius: 14,
  fontWeight: 600,
  fontSize: "1rem",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const ghostBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  color: "#94a3b8",
  border: "none",
  padding: "12px 24px",
  borderRadius: 14,
  fontWeight: 600,
  fontSize: ".95rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const backBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#c8d8f0",
  width: 42,
  height: 42,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const Practice = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const lang = getLang();

  const [listName, setListName] = useState("");
  const [allItems, setAllItems] = useState<SentenceItem[]>([]);
  const [queue, setQueue] = useState<SentenceItem[]>([]);
  const [wrongThisRound, setWrongThisRound] = useState<SentenceItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctWord, setCorrectWord] = useState("");

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundWrong, setRoundWrong] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);

  const [finished, setFinished] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  const [showResumeGate, setShowResumeGate] = useState(false);
  const pendingResumeRef = useRef<any>(null);
  const autoNextTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionKey = userId && listId ? `practice-session:${userId}:${listId}` : null;

  useEffect(() => {
    if (!userId || !listId) {
      navigate("/login");
      return;
    }

    loadPractice();
  }, [userId, listId]);

  useEffect(() => {
    if (!loading && !feedback && !showResumeGate) {
      inputRef.current?.focus();
    }
  }, [currentIndex, feedback, loading, showResumeGate]);

  useEffect(() => {
    return () => {
      if (autoNextTimeout.current) {
        clearTimeout(autoNextTimeout.current);
      }
    };
  }, []);

  // Wymagaj puszczenia Entera po oznaczeniu odpowiedzi jako błędnej,
  // żeby kolejne naciśnięcie świadomie przeskakiwało do następnego pytania.
  const enterArmedRef = useRef(true);
  useEffect(() => {
    if (feedback === "wrong") {
      enterArmedRef.current = false;
    } else {
      enterArmedRef.current = true;
    }
  }, [feedback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && feedback === "wrong" && enterArmedRef.current) {
        e.preventDefault();
        goToNextQuestion(currentIndex + 1);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        enterArmedRef.current = true;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [feedback, currentIndex]);


  const loadPractice = async () => {
    const { data: list } = await supabase
      .from("word_lists")
      .select("name, sentences_generating")
      .eq("id", listId!)
      .single();

    if (list) {
      setListName(list.name);
    }

    let words: { id: string; word: string; definition: string | null }[] | null = null;
    let wordsError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await supabase
        .from("words")
        .select("id, word, definition")
        .eq("list_id", listId!);
      if (!res.error) { words = res.data; wordsError = null; break; }
      wordsError = res.error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }

    if (wordsError) {
      console.error("Practice: failed to load words", wordsError);
      toast.error("Błąd połączenia — spróbuj ponownie");
      navigate("/dashboard");
      return;
    }

    if (!words || words.length === 0) {
      toast.error(t("noWordsInList", lang));
      navigate("/dashboard");
      return;
    }

    const { data: cached } = await supabase
      .from("generated_sentences")
      .select("word_id, sentence, hint")
      .eq("list_id", listId!);

    console.log("Loaded from generated_sentences:", cached?.length || 0, "items");

    if (cached && cached.length > 0) {
      const validSentences = cached.filter(
        (s) => (s.sentence || "").trim().length > 0
      );

      console.log("Valid sentences:", validSentences.length);

      if (validSentences.length > 0) {
        const wordMap = (words || []).reduce(
          (acc, item) => {
            acc[item.id] = item;
            return acc;
          },
          {} as Record<string, { word: string; definition: string | null }>
        );

        console.log("Word map created with", Object.keys(wordMap).length, "words");

        const sentences: SentenceItem[] = validSentences
          .map((s) => {
            const wordData = wordMap[s.word_id];
            if (!wordData) {
              console.warn("Missing word data for word_id:", s.word_id);
              return null;
            }
            return {
              wordId: s.word_id,
              word: wordData.word,
              definition: wordData.definition || "",
              sentence: s.sentence,
              hint: s.hint || wordData.definition || "",
            };
          })
          .filter((s) => s !== null) as SentenceItem[];

        console.log("Final sentences to practice:", sentences.length, sentences.slice(0, 2));

        if (sentences.length > 0) {
          const shuffled = [...sentences].sort(() => Math.random() - 0.5);

          setAllItems(shuffled);

          // Sprawdź zapisaną sesję
          let resumed = false;
          if (sessionKey) {
            try {
              const raw = localStorage.getItem(sessionKey);
              if (raw) {
                const saved = JSON.parse(raw);
                if (
                  saved &&
                  Array.isArray(saved.queueIds) &&
                  saved.queueIds.length > 0
                ) {
                  pendingResumeRef.current = { saved, allItems: shuffled };
                  setShowResumeGate(true);
                  resumed = true;
                }
              }
            } catch {}
          }

          if (!resumed) {
            setQueue(shuffled);
          }
          setLoading(false);
          return;
        }
      }
    }

    if (list?.sentences_generating) {
      toast.info("Zdania są wciąż generowane. Spróbuj za chwilę!");
      navigate("/dashboard");
      return;
    }

    toast.error("Brakuje wygenerowanych zdań dla tej listy.");
    navigate("/dashboard");
  };

  const nextQuestion = () => {
    goToNextQuestion(currentIndex + 1);
  };

  const goToNextQuestion = (nextIndex: number) => {
  if (autoNextTimeout.current) {
    clearTimeout(autoNextTimeout.current);
  }

  setFeedback(null);
  setAnswer("");
  setCorrectWord("");
  setChecking(false);

  if (nextIndex >= queue.length) {
    if (roundWrong === 0) {
      setFinished(true);
    } else {
      setRoundEnded(true);
    }
  } else {
    setCurrentIndex(nextIndex);
  }
};

  const current = queue[currentIndex];

  const checkAnswer = useCallback(async () => {
    if (!current || checking || feedback !== null) {
      return;
    }

    setChecking(true);

    const answers = answer
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const isCorrect = answers.some(
      (a) =>
        a.localeCompare(current.word.trim(), undefined, {
          sensitivity: "base",
        }) === 0
    );

    if (isCorrect) {
      setFeedback("correct");
      setRoundCorrect((c) => c + 1);

      // Zapisz mastered w bazie (fire-and-forget)
      const wid = current.wordId;
      (async () => {
        if (!userId || !listId) return;
        try {
          const { data: existing } = await supabase
            .from("practice_progress")
            .select("id")
            .eq("user_id", userId)
            .eq("word_id", wid)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("practice_progress")
              .update({ mastered: true, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            await supabase.from("practice_progress").insert({
              user_id: userId,
              word_id: wid,
              list_id: listId,
              mastered: true,
              attempts: 1,
            });
          }
        } catch (e) {
          console.warn("mark mastered failed", e);
        }
      })();

      // AUTO NEXT tylko przy dobrej odpowiedzi
      autoNextTimeout.current = setTimeout(() => {
        goToNextQuestion(currentIndex + 1);
     }, 1200);
   } else {
      setFeedback("wrong");
      setCorrectWord(current.word);
      setRoundWrong((c) => c + 1);
      setWrongThisRound((w) => [...w, current]);
    }

    setChecking(false);
  }, [current, answer, checking, feedback, currentIndex, userId, listId]);

  // Zapis sesji do localStorage
  useEffect(() => {
    if (!sessionKey || loading || showResumeGate || finished || roundEnded) return;
    if (queue.length === 0) return;
    try {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          queueIds: queue.map((q) => q.wordId),
          currentIndex,
          roundCorrect,
          roundWrong,
          roundNumber,
          wrongIds: wrongThisRound.map((w) => w.wordId),
        })
      );
    } catch {}
  }, [queue, currentIndex, roundCorrect, roundWrong, roundNumber, wrongThisRound, loading, showResumeGate, finished, roundEnded, sessionKey]);

  // Wyczyść sesję po ukończeniu
  useEffect(() => {
    if (finished && sessionKey) {
      try { localStorage.removeItem(sessionKey); } catch {}
    }
  }, [finished, sessionKey]);

  const handleResumeSession = () => {
    const payload = pendingResumeRef.current;
    if (!payload) {
      setShowResumeGate(false);
      return;
    }
    const { saved, allItems: items } = payload;
    const byId = new Map(items.map((i: SentenceItem) => [i.wordId, i]));
    const resolvedQueue = (saved.queueIds as string[])
      .map((id) => byId.get(id))
      .filter(Boolean) as SentenceItem[];
    const resolvedWrong = ((saved.wrongIds as string[]) || [])
      .map((id) => byId.get(id))
      .filter(Boolean) as SentenceItem[];

    if (resolvedQueue.length === 0) {
      setQueue(items);
      setShowResumeGate(false);
      pendingResumeRef.current = null;
      return;
    }

    setQueue(resolvedQueue);
    setWrongThisRound(resolvedWrong);
    setCurrentIndex(Math.min(saved.currentIndex || 0, resolvedQueue.length - 1));
    setRoundCorrect(saved.roundCorrect || 0);
    setRoundWrong(saved.roundWrong || 0);
    setRoundNumber(saved.roundNumber || 1);
    setShowResumeGate(false);
    pendingResumeRef.current = null;
  };

  // Czyści pasek postępu (mastered) w DB dla bieżącej listy,
  // chyba że użytkownik już opanował WSZYSTKIE słówka — wtedy
  // pasek pozostaje permanentnie pełny i zielony.
  const resetMasteredProgressIfNotComplete = async (totalItems: number) => {
    if (!userId || !listId || totalItems <= 0) return;
    try {
      const { count } = await supabase
        .from("practice_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("list_id", listId)
        .eq("mastered", true);
      const masteredCount = count || 0;
      if (masteredCount >= totalItems) return; // pełny zielony — nie ruszamy
      await supabase
        .from("practice_progress")
        .delete()
        .eq("user_id", userId)
        .eq("list_id", listId);
    } catch (e) {
      console.warn("reset mastered progress failed", e);
    }
  };

  const handleRestartFresh = () => {
    if (sessionKey) {
      try { localStorage.removeItem(sessionKey); } catch {}
    }
    const items = pendingResumeRef.current?.allItems || allItems;
    void resetMasteredProgressIfNotComplete(items.length);
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setWrongThisRound([]);
    setCurrentIndex(0);
    setRoundCorrect(0);
    setRoundWrong(0);
    setRoundNumber(1);
    setShowResumeGate(false);
    pendingResumeRef.current = null;
  };

  const continueWithWrong = () => {
    if (wrongThisRound.length === 0) {
      setFinished(true);
      return;
    }

    const shuffled = [...wrongThisRound].sort(() => Math.random() - 0.5);

    setQueue(shuffled);
    setWrongThisRound([]);
    setCurrentIndex(0);

    setRoundCorrect(0);
    setRoundWrong(0);

    setRoundNumber((r) => r + 1);
    setRoundEnded(false);

    setFeedback(null);
    setAnswer("");
  };

  const restartAll = () => {
    void resetMasteredProgressIfNotComplete(allItems.length);
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);

    setQueue(shuffled);
    setWrongThisRound([]);
    setCurrentIndex(0);

    setRoundCorrect(0);
    setRoundWrong(0);

    setRoundNumber(1);

    setFinished(false);
    setRoundEnded(false);

    setFeedback(null);
    setAnswer("");
  };

  if (loading) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={blob1Style} />
        <div style={blob2Style} />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
          }}
        >
          <Loader2
            style={{
              width: 40,
              height: 40,
              color: "#3b82f6",
              animation: "spin 1s linear infinite",
              marginBottom: 14,
            }}
          />
          <p style={{ color: "#94a3b8" }}>
            {t("generatingSentences", lang)}
          </p>
        </div>
      </div>
    );
  }

  if (showResumeGate) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
        <div style={blob1Style} />
        <div style={blob2Style} />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ width: "100%", maxWidth: 430, textAlign: "center", position: "relative", zIndex: 1 }}
        >
          <div style={{ ...cardStyle, border: "1px solid rgba(99,102,241,0.25)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📝</div>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 900, marginBottom: 10 }}>
              {listName}
            </h2>
            <p style={{ color: "#94a3b8", marginBottom: 28, lineHeight: 1.6 }}>
              Masz niezakończoną sesję nauki. Co chcesz zrobić?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={primaryBtnStyle}
                onClick={handleResumeSession}
              >
                <ArrowRight size={16} />
                Kontynuuj naukę
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={secondaryBtnStyle}
                onClick={handleRestartFresh}
              >
                <RotateCcw size={16} />
                Zacznij od początku
              </motion.button>
              <button style={ghostBtnStyle} onClick={() => navigate("/dashboard")}>
                {t("backToHome", lang)}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }


  if (finished) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
        }}
      >
        <div style={blob1Style} />
        <div style={blob2Style} />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            width: "100%",
            maxWidth: 430,
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(52,211,153,0.25)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background:
                  "linear-gradient(90deg, #34d399, #10b981, #059669)",
              }}
            />

            <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🎉</div>

            <h2
              style={{
                fontSize: "1.7rem",
                fontWeight: 900,
                marginBottom: 10,
              }}
            >
              {t("completed", lang)}
            </h2>

            <p
              style={{
                color: "#94a3b8",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Opanowałeś wszystkie{" "}
              <strong style={{ color: "#34d399" }}>
                {allItems.length}
              </strong>{" "}
              słów z „{listName}”
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={secondaryBtnStyle}
                onClick={restartAll}
              >
                <RotateCcw size={16} />
                Zacznij od nowa
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={primaryBtnStyle}
                onClick={() => navigate("/dashboard")}
              >
                {t("backToHome", lang)}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (roundEnded) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
        }}
      >
        <div style={blob1Style} />
        <div style={blob2Style} />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            width: "100%",
            maxWidth: 430,
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background:
                  "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)",
              }}
            />

            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📊</div>

            <div
              style={{
                fontSize: ".72rem",
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#60a5fa",
                marginBottom: 8,
              }}
            >
              Runda {roundNumber}
            </div>

            <h2
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                marginBottom: 10,
              }}
            >
              Zakończona!
            </h2>

            <p
              style={{
                color: "#94a3b8",
                marginBottom: 30,
              }}
            >
              Odpowiedziałeś na każde zdanie raz
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                marginBottom: 30,
              }}
            >
              <div
                style={{
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  borderRadius: 18,
                  padding: "18px 26px",
                }}
              >
                <Check
                  size={20}
                  color="#34d399"
                  style={{ marginBottom: 6 }}
                />
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: 900,
                    color: "#34d399",
                  }}
                >
                  {roundCorrect}
                </div>
                <div
                  style={{
                    fontSize: ".75rem",
                    color: "#94a3b8",
                  }}
                >
                  dobrze
                </div>
              </div>

              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 18,
                  padding: "18px 26px",
                }}
              >
                <X
                  size={20}
                  color="#ef4444"
                  style={{ marginBottom: 6 }}
                />
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: 900,
                    color: "#ef4444",
                  }}
                >
                  {roundWrong}
                </div>
                <div
                  style={{
                    fontSize: ".75rem",
                    color: "#94a3b8",
                  }}
                >
                  do powtórki
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <motion.button
                style={primaryBtnStyle}
                onClick={continueWithWrong}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowRight size={16} />
                Kontynuuj naukę ({roundWrong})
              </motion.button>

              <motion.button
                style={secondaryBtnStyle}
                onClick={restartAll}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RotateCcw size={16} />
                Zacznij od nowa
              </motion.button>

              <button
                style={ghostBtnStyle}
                onClick={() => navigate("/dashboard")}
              >
                {t("backToHome", lang)}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const roundTotal = queue.length;
  const roundDone = roundCorrect + roundWrong;

  const progressPct =
    roundTotal > 0
      ? Math.round((roundDone / roundTotal) * 100)
      : 0;

  return (
    <div style={pageStyle}>
      <div style={blob1Style} />
      <div style={blob2Style} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* HEADER */}
        <header
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(6,13,26,0.82)",
            backdropFilter: "blur(14px)",
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 0",
            }}
          >
            <button
              style={backBtnStyle}
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={18} />
            </button>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {listName}
              </div>

              <div
                style={{
                  fontSize: ".75rem",
                  color: "#94a3b8",
                  marginTop: 2,
                }}
              >
                Runda {roundNumber} · {roundDone}/{roundTotal}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                }}
              >
                <Check size={14} color="#34d399" />
                <span
                  style={{
                    fontSize: ".8rem",
                    fontWeight: 700,
                    color: "#34d399",
                  }}
                >
                  {roundCorrect}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <X size={14} color="#ef4444" />
                <span
                  style={{
                    fontSize: ".8rem",
                    fontWeight: 700,
                    color: "#ef4444",
                  }}
                >
                  {roundWrong}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "28px 20px 50px",
          }}
        >
          {/* PROGRESS */}
          <div style={{ marginBottom: 26 }}>
            <div
              style={{
                height: 8,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <motion.div
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.35 }}
                style={{
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #3b82f6, #6366f1)",
                  borderRadius: 999,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: ".75rem",
                color: "#64748b",
              }}
            >
              <span>{progressPct}% ukończono</span>
              <span>{queue.length - roundDone} pozostało</span>
            </div>
          </div>

          {/* QUESTION */}
          {current && (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.wordId}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
              >
                <div
                  style={{
                    ...cardStyle,
                    border: "1px solid rgba(99,102,241,0.18)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background:
                        "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginBottom: 18,
                      color: "#60a5fa",
                      fontSize: ".8rem",
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    <Sparkles size={14} />
                    Uzupełnij słowo
                  </div>

                  <p
                    style={{
                      textAlign: "center",
                      fontSize: "clamp(1.1rem, 4vw, 1.5rem)",
                      lineHeight: 1.8,
                      color: "#fff",
                      marginBottom: 22,
                      fontWeight: 600,
                    }}
                  >
                    {current.sentence}
                  </p>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 14,
                      padding: "14px 16px",
                      marginBottom: 22,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: ".72rem",
                        color: "#64748b",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        fontWeight: 700,
                      }}
                    >
                      Podpowiedź
                    </div>

                    <div
                      style={{
                        color: "#cbd5e1",
                        fontSize: ".95rem",
                        fontStyle: "italic",
                      }}
                    >
                      💡 {current.hint}
                    </div>
                  </div>

                  {/* INPUT */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <input
                      ref={inputRef}
                      autoFocus
                      placeholder={t("typeWord", lang)}
                      value={answer}
                      disabled={feedback !== null}
                      onChange={(e) => setAnswer(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) =>
                        e.key === "Enter" && checkAnswer()
                      }
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff",
                        borderRadius: 14,
                        padding: "16px 18px",
                        fontSize: "1.05rem",
                        outline: "none",
                        textAlign: "center",
                        fontFamily: "inherit",
                      }}
                    />

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={!answer.trim() || feedback !== null}
                      onClick={checkAnswer}
                      style={{
                        ...primaryBtnStyle,
                        opacity:
                          !answer.trim() || feedback !== null
                            ? 0.5
                            : 1,
                        cursor:
                          !answer.trim() || feedback !== null
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {checking ? (
                        <Loader2
                          size={18}
                          style={{
                            animation: "spin 1s linear infinite",
                          }}
                        />
                      ) : (
                        <>
                          <Check size={18} />
                          {t("check", lang)}
                        </>
                      )}
                    </motion.button>
                  </div>
                  {/* FEEDBACK */}
                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          marginTop: 20,
                          borderRadius: 16,
                          padding: "16px 18px",
                          textAlign: "center",
                          background:
                            feedback === "correct"
                              ? "rgba(52,211,153,0.1)"
                              : "rgba(239,68,68,0.1)",
                          border:
                            feedback === "correct"
                              ? "1px solid rgba(52,211,153,0.2)"
                              : "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        {feedback === "correct" ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 8,
                                color: "#34d399",
                                fontWeight: 700,
                                marginBottom: 4,
                              }}
                            >
                              <Check size={18} />
                              Dobra robota!
                            </div>

                            <div
                              style={{
                                color: "#86efac",
                                fontSize: ".9rem",
                              }}
                            >
                              Poprawna odpowiedź
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 8,
                                color: "#f87171",
                                fontWeight: 700,
                                marginBottom: 6,
                              }}
                            >
                              <X size={18} />
                              Niepoprawna odpowiedź
                            </div>
                  
                            <div
                              style={{
                                color: "#fecaca",
                                fontSize: ".92rem",
                              }}
                            >
                              Poprawne słowo: <strong>{correctWord}</strong>
                            </div>

                            {/* 🔥 DODANY PRZYCISK TYLKO DLA BŁĘDU */}
                            <motion.button
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => goToNextQuestion(currentIndex + 1)}
                              style={{
                                marginTop: 18,
                                width: "100%",
                                border: "none",
                                borderRadius: 14,
                                padding: "14px 18px",
                                background:
                                  "linear-gradient(135deg, #ef4444, #f87171)",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: ".95rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                boxShadow: "0 8px 24px rgba(239,68,68,0.28)",
                              }}
                            >
                              <ArrowRight size={16} />
                              Dalej
                            </motion.button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
};

export default Practice;