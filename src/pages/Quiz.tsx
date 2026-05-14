import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, RotateCcw, Check, X, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

type QuizCard = {
  id: string;
  word: string;
  definition: string;
};

type QuizMode = "word-to-def" | "def-to-word";

type QuizQuestion = {
  card: QuizCard;
  options: string[];
  correctIndex: number;
};

const Quiz = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const lang = getLang();

  const [listName, setListName] = useState("");
  const [allCards, setAllCards] = useState<QuizCard[]>([]);
  const [remaining, setRemaining] = useState<QuizCard[]>([]);
  const [wrongThisRound, setWrongThisRound] = useState<QuizCard[]>([]);
  const [mode, setMode] = useState<QuizMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundWrong, setRoundWrong] = useState(0);

  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!listId) return;
    loadCards();
  }, [listId]);

  // Handle keyboard shortcuts for answer selection (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }

      // Only handle if quiz is active, not answered yet, and question exists
      if (!currentQuestion || answered || !mode) return;

      let keyNum = Number(e.key);

      if (Number.isNaN(keyNum)) {
        if (e.code.startsWith("Digit")) {
          keyNum = Number(e.code.replace("Digit", ""));
        } else if (e.code.startsWith("Numpad")) {
          keyNum = Number(e.code.replace("Numpad", ""));
        }
      }

      // Check if key is 1-4 and valid for current question
      if (!Number.isNaN(keyNum) && keyNum >= 1 && keyNum <= currentQuestion.options.length) {
        e.preventDefault();
        handleSelect(keyNum - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuestion, answered, mode]);

  const loadCards = async () => {
    const { data: list } = await supabase
      .from("word_lists")
      .select("name")
      .eq("id", listId!)
      .single();

    if (list) setListName(list.name);

    const { data: words } = await supabase
      .from("words")
      .select("id, word, definition")
      .eq("list_id", listId!);

    if (!words || words.length < 2) {
      toast.error("Lista musi mieć co najmniej 2 słowa");
      navigate("/dashboard");
      return;
    }

    const cards: QuizCard[] = words
      .filter((w) => w.definition && w.definition.trim())
      .map((w) => ({
        id: w.id,
        word: w.word,
        definition: w.definition!,
      }));

    if (cards.length < 2) {
      toast.error("Za mało słów z definicjami.");
      navigate("/dashboard");
      return;
    }

    setAllCards(cards);
    setLoading(false);
  };

  const generateQuestion = useCallback(
    (card: QuizCard, pool: QuizCard[], quizMode: QuizMode): QuizQuestion => {
      const distractors = pool
        .filter((c) => c.id !== card.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const correctAnswer =
        quizMode === "word-to-def" ? card.definition : card.word;

      const distractorAnswers = distractors.map((d) =>
        quizMode === "word-to-def" ? d.definition : d.word
      );

      const allOptions = [correctAnswer, ...distractorAnswers];
      const shuffled = allOptions.sort(() => Math.random() - 0.5);

      return {
        card,
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAnswer),
      };
    },
    []
  );

  const startSession = (m: QuizMode) => {
    setMode(m);

    const shuffled = [...allCards].sort(() => Math.random() - 0.5);

    setRemaining(shuffled);
    setWrongThisRound([]);
    setRoundCorrect(0);
    setRoundWrong(0);
    setRoundNumber(1);
    setFinished(false);
    setRoundEnded(false);
    setSelectedIndex(null);
    setAnswered(false);

    setCurrentQuestion(generateQuestion(shuffled[0], allCards, m));
  };

  const continueWithWrong = () => {
    if (wrongThisRound.length === 0 || !mode) {
      setFinished(true);
      return;
    }

    const shuffled = [...wrongThisRound].sort(() => Math.random() - 0.5);

    setRemaining(shuffled);
    setWrongThisRound([]);
    setRoundCorrect(0);
    setRoundWrong(0);
    setRoundNumber((r) => r + 1);
    setRoundEnded(false);
    setSelectedIndex(null);
    setAnswered(false);

    setCurrentQuestion(generateQuestion(shuffled[0], allCards, mode));
  };

  const restartAll = () => {
    if (!mode) return;
    startSession(mode);
  };

  const handleSelect = (index: number) => {
    if (answered || !currentQuestion) return;

    setSelectedIndex(index);
    setAnswered(true);

    const isCorrect = index === currentQuestion.correctIndex;
    const card = currentQuestion.card;

    const newRemaining = remaining.filter((c) => c.id !== card.id);

    setRemaining(newRemaining);

    if (isCorrect) {
      setRoundCorrect((c) => c + 1);
    } else {
      setRoundWrong((c) => c + 1);
      setWrongThisRound((w) => [...w, card]);
    }

    setTimeout(() => {
      if (newRemaining.length === 0) {
        const finalWrong = roundWrong + (isCorrect ? 0 : 1);

        if (finalWrong === 0) {
          setFinished(true);
        } else {
          setRoundEnded(true);
        }
      } else {
        const next =
          newRemaining[Math.floor(Math.random() * newRemaining.length)];

        setCurrentQuestion(generateQuestion(next, allCards, mode!));
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, isCorrect ? 1000 : 1600);
  };

  const roundTotal = roundCorrect + roundWrong + remaining.length;

  const progressPct =
    roundTotal > 0
      ? Math.round(
          ((roundCorrect + roundWrong) / roundTotal) * 100
        )
      : 0;

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
    background:
      "linear-gradient(180deg, rgba(15,17,23,0.96), rgba(10,12,18,0.92))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: "32px 28px",
    position: "relative",
    overflow: "hidden",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
    backdropFilter: "blur(18px)",
  };

  const btnPrimaryStyle: React.CSSProperties = {
    width: "100%",
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    color: "#fff",
    border: "none",
    padding: "15px 24px",
    borderRadius: 16,
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 8px 30px rgba(59,130,246,0.28)",
  };

  const btnSecondaryStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    color: "#c8d8f0",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "15px 24px",
    borderRadius: 16,
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  const backBtnStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#c8d8f0",
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
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

        <Loader2
          style={{
            width: 40,
            height: 40,
            color: "#3b82f6",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!mode) {
    return (
      <div style={pageStyle}>
        <div style={blob1Style} />
        <div style={blob2Style} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <header
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(6,13,26,0.8)",
              backdropFilter: "blur(12px)",
              padding: "0 20px",
            }}
          >
            <div
              style={{
                maxWidth: 680,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 0",
              }}
            >
              <button
                style={backBtnStyle}
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft size={18} />
              </button>

              <h1
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#fff",
                  margin: 0,
                }}
              >
                {listName}
              </h1>
            </div>
          </header>

          <main
            style={{
              maxWidth: 420,
              margin: "0 auto",
              padding: "70px 20px",
              textAlign: "center",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ fontSize: "3.5rem", marginBottom: 18 }}>🧠</div>

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
                Quiz
              </div>

              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: "#fff",
                  marginBottom: 10,
                  letterSpacing: "-0.03em",
                }}
              >
                {listName}
              </h2>

              <p
                style={{
                  color: "#8899b4",
                  marginBottom: 40,
                  fontSize: ".92rem",
                }}
              >
                {allCards.length} słów · Wybierz tryb quizu
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <motion.button
                  style={btnPrimaryStyle}
                  onClick={() => startSession("word-to-def")}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: "0 12px 40px rgba(59,130,246,0.35)",
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Słowo → Definicja
                </motion.button>

                <motion.button
                  style={btnSecondaryStyle}
                  onClick={() => startSession("def-to-word")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Definicja → Słowo
                </motion.button>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const prompt =
    mode === "word-to-def"
      ? currentQuestion.card.word
      : currentQuestion.card.definition;

  return (
    <div style={pageStyle}>
      <div style={blob1Style} />
      <div style={blob2Style} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <header
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(6,13,26,0.8)",
            backdropFilter: "blur(12px)",
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 680,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 0",
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
                  color: "#8899b4",
                  marginTop: 2,
                }}
              >
                Runda {roundNumber} · {roundCorrect + roundWrong}/{roundTotal}
              </div>
            </div>
          </div>
        </header>

        <main
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "28px 20px 40px",
          }}
        >
          {/* Progress */}

          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                height: 10,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 999,
                overflow: "hidden",
                padding: 2,
              }}
            >
              <motion.div
                style={{
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #3b82f6, #6366f1)",
                  borderRadius: 999,
                }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <span
                style={{
                  fontSize: ".72rem",
                  color: "#64748b",
                }}
              >
                {progressPct}% ukończono
              </span>

              <span
                style={{
                  fontSize: ".72rem",
                  color: "#64748b",
                }}
              >
                {remaining.length} pozostało
              </span>
            </div>
          </div>

          {/* Question */}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div
                style={{
                  ...cardStyle,
                  marginBottom: 22,
                  border: "1px solid rgba(99,102,241,0.18)",
                  boxShadow:
                    "0 0 40px rgba(59,130,246,0.08)",
                  minHeight: 180,
                  padding: "40px 28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    left: 18,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.18)",
                    color: "#60a5fa",
                    fontSize: ".7rem",
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {mode === "word-to-def"
                    ? "Słowo"
                    : "Definicja"}
                </div>

                <p
                  style={{
                    fontSize: "clamp(1.25rem, 4vw, 2rem)",
                    fontWeight: 900,
                    color: "#fff",
                    lineHeight: 1.25,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {prompt}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Feedback */}

          <div
            style={{
              textAlign: "center",
              height: 28,
              marginBottom: 18,
            }}
          >
            <AnimatePresence>
              {answered ? (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontWeight: 700,
                    fontSize: ".92rem",
                    color:
                      selectedIndex ===
                      currentQuestion.correctIndex
                        ? "#34d399"
                        : "#fb923c",
                  }}
                >
                  {selectedIndex === currentQuestion.correctIndex
                    ? "Dobra robota! ✓"
                    : "Nie martw się. Nadal się uczysz!"}
                </motion.p>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    color: "#64748b",
                    fontSize: ".88rem",
                  }}
                >
                  Wybierz odpowiedź (klawisze 1-4)
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Options */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            {currentQuestion.options.map((option, idx) => {
              const isCorrect =
                idx === currentQuestion.correctIndex;

              const isSelected = idx === selectedIndex;

              let borderColor =
                "rgba(255,255,255,0.08)";

              let bgColor =
                "rgba(255,255,255,0.03)";

              let opacity = 1;

              let icon = null;

              if (answered) {
                if (isCorrect) {
                  borderColor =
                    "rgba(52,211,153,0.5)";
                  bgColor =
                    "rgba(52,211,153,0.08)";
                  icon = (
                    <Check
                      size={16}
                      color="#34d399"
                      style={{ flexShrink: 0 }}
                    />
                  );
                } else if (isSelected) {
                  borderColor =
                    "rgba(251,146,60,0.5)";
                  bgColor =
                    "rgba(251,146,60,0.08)";
                  icon = (
                    <X
                      size={16}
                      color="#fb923c"
                      style={{ flexShrink: 0 }}
                    />
                  );
                } else {
                  opacity = 0.4;
                }
              }

              return (
                <motion.button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={answered}
                  whileHover={
                    !answered
                      ? {
                          scale: 1.015,
                          y: -2,
                          boxShadow:
                            "0 10px 30px rgba(59,130,246,0.12)",
                        }
                      : {}
                  }
                  whileTap={
                    !answered ? { scale: 0.985 } : {}
                  }
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    background: answered
                      ? bgColor
                      : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 20,
                    padding: "18px",
                    textAlign: "left",
                    cursor: answered
                      ? "default"
                      : "pointer",
                    opacity,
                    transition: "all .22s ease",
                    fontFamily: "inherit",
                    minHeight: 92,
                    overflow: "hidden",
                  }}
                >
                  {icon || (
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                        border:
                          "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: ".8rem",
                        fontWeight: 800,
                        color: "#94a3b8",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: ".92rem",
                      fontWeight: 500,
                      color: "#e2e8f0",
                      lineHeight: 1.45,
                    }}
                  >
                    {option}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Quiz;