import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  RotateCcw,
  Check,
  X,
  Loader2,
  Undo2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n";

type FlashCard = {
  id: string;
  word: string;
  definition: string;
};

type Mode = "word-first" | "definition-first";

type HistoryEntry = {
  remaining: FlashCard[];
  wrongThisRound: FlashCard[];
  currentIndex: number;
  learnedCount: number;
  unknownCount: number;
  action: "know" | "dontknow";
};

const FlashCards = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const lang = getLang();
  const userId = localStorage.getItem("userId");

  const [listName, setListName] = useState("");
  const [allCards, setAllCards] = useState<FlashCard[]>([]);
  const [remaining, setRemaining] = useState<FlashCard[]>([]);
  const [wrongThisRound, setWrongThisRound] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundWrong, setRoundWrong] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<
    "left" | "right" | null
  >(null);
  const [outgoingCard, setOutgoingCard] = useState<FlashCard | null>(null);
  const [outgoingFlipped, setOutgoingFlipped] = useState(false);
  const [hasExistingSession, setHasExistingSession] = useState(false);

  useEffect(() => {
    if (!listId) return;
    loadCards();
  }, [listId]);

  useEffect(() => {
    if (!mode || finished || roundEnded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;

      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.code === "ArrowLeft" && flipped) {
        e.preventDefault();
        handleDontKnow();
      } else if (e.code === "ArrowRight" && flipped) {
        e.preventDefault();
        handleKnow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    mode,
    finished,
    roundEnded,
    flipped,
    isTransitioning,
    remaining,
    currentIndex,
    learnedCount,
    unknownCount,
  ]);

  useEffect(() => {
    if (!mode || !userId || !listId || finished) return;

    const timeout = setTimeout(() => {
      saveSession();
    }, 500);

    return () => clearTimeout(timeout);
  }, [remaining, currentIndex, learnedCount, unknownCount, mode]);

  const saveSession = async () => {
    if (!userId || !listId || !mode || remaining.length === 0) return;

    await supabase.from("flashcard_sessions").upsert(
      {
        user_id: userId,
        list_id: listId,
        mode,
        remaining_word_ids: remaining.map((c) => c.id),
        current_index: currentIndex,
        learned_count: learnedCount,
        unknown_count: unknownCount,
      },
      { onConflict: "user_id,list_id" }
    );
  };

  const deleteSession = async () => {
    if (!userId || !listId) return;

    await supabase
      .from("flashcard_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("list_id", listId);
  };

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

    if (!words || words.length === 0) {
      toast.error(t("noWordsInList", lang));
      navigate("/dashboard");
      return;
    }

    const cards: FlashCard[] = words.map((w) => ({
      id: w.id,
      word: w.word,
      definition: w.definition || t("noDefinition", lang),
    }));

    setAllCards(cards);

    if (userId) {
      const { data: session } = await supabase
        .from("flashcard_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("list_id", listId!)
        .maybeSingle();

      if (
        session &&
        session.remaining_word_ids &&
        session.remaining_word_ids.length > 0
      ) {
        setHasExistingSession(true);
        (window as any).__pendingFlashcardSession = session;
      }
    }

    setLoading(false);
  };

  const resumeSession = () => {
    const session = (window as any).__pendingFlashcardSession;

    if (!session) return;

    delete (window as any).__pendingFlashcardSession;

    setMode(session.mode as Mode);

    const remainingCards = (session.remaining_word_ids as string[])
      .map((id: string) => allCards.find((c) => c.id === id))
      .filter(Boolean) as FlashCard[];

    if (remainingCards.length === 0) {
      startSession(session.mode as Mode);
      return;
    }

    setRemaining(remainingCards);
    setWrongThisRound([]);
    setCurrentIndex(
      Math.min(session.current_index, remainingCards.length - 1)
    );
    setLearnedCount(session.learned_count);
    setUnknownCount(session.unknown_count);
    setRoundCorrect(0);
    setRoundWrong(0);
    setRoundNumber(1);
    setFinished(false);
    setRoundEnded(false);
    setFlipped(false);
    setHistory([]);
    setHasExistingSession(false);
  };

  const startSession = (m: Mode) => {
    setMode(m);

    const shuffled = [...allCards].sort(() => Math.random() - 0.5);

    setRemaining(shuffled);
    setWrongThisRound([]);
    setCurrentIndex(0);
    setLearnedCount(0);
    setUnknownCount(0);
    setRoundCorrect(0);
    setRoundWrong(0);
    setRoundNumber(1);
    setFinished(false);
    setRoundEnded(false);
    setFlipped(false);
    setHistory([]);
    setHasExistingSession(false);

    delete (window as any).__pendingFlashcardSession;
  };

  const continueWithWrong = () => {
    if (wrongThisRound.length === 0) {
      setFinished(true);
      deleteSession();
      return;
    }

    const shuffled = [...wrongThisRound].sort(
      () => Math.random() - 0.5
    );

    setRemaining(shuffled);
    setWrongThisRound([]);
    setCurrentIndex(0);
    setRoundCorrect(0);
    setRoundWrong(0);
    setRoundNumber((r) => r + 1);
    setRoundEnded(false);
    setFlipped(false);
    setHistory([]);
  };

  const restartAll = () => {
    if (!mode) return;
    startSession(mode);
  };

  const current = remaining[currentIndex];

  const handleKnow = () => {
    if (isTransitioning || !current) return;

    setHistory((h) => [
      ...h,
      {
        remaining: [...remaining],
        wrongThisRound: [...wrongThisRound],
        currentIndex,
        learnedCount,
        unknownCount,
        action: "know",
      },
    ]);

    setLearnedCount((c) => c + 1);
    setRoundCorrect((c) => c + 1);

    advance(true);
  };

  const handleDontKnow = () => {
    if (isTransitioning || !current) return;

    setHistory((h) => [
      ...h,
      {
        remaining: [...remaining],
        wrongThisRound: [...wrongThisRound],
        currentIndex,
        learnedCount,
        unknownCount,
        action: "dontknow",
      },
    ]);

    setUnknownCount((c) => c + 1);
    setRoundWrong((c) => c + 1);
    setWrongThisRound((w) => [...w, current]);

    advance(false);
  };

  const handleUndo = () => {
    if (history.length === 0 || isTransitioning) return;

    const prev = history[history.length - 1];

    setRemaining(prev.remaining);
    setWrongThisRound(prev.wrongThisRound);
    setCurrentIndex(prev.currentIndex);
    setLearnedCount(prev.learnedCount);
    setUnknownCount(prev.unknownCount);

    if (prev.action === "know") {
      setRoundCorrect((c) => Math.max(0, c - 1));
    } else {
      setRoundWrong((c) => Math.max(0, c - 1));
    }

    setFlipped(false);
    setFinished(false);
    setRoundEnded(false);
    setSlideDirection(null);
    setOutgoingCard(null);
    setOutgoingFlipped(false);
    setIsTransitioning(false);

    setHistory((h) => h.slice(0, -1));
  };

  const advance = (known: boolean) => {
    if (!current || isTransitioning) return;

    setIsTransitioning(true);
    setOutgoingCard(current);
    setOutgoingFlipped(flipped);
    setSlideDirection(known ? "right" : "left");

    const nextRemaining = remaining.filter((_, i) => i !== currentIndex);

    let shouldEndRound = false;

    if (nextRemaining.length === 0) {
      shouldEndRound = true;
      setRemaining([]);
      setCurrentIndex(0);
    } else {
      const nextIdx =
        currentIndex >= nextRemaining.length ? 0 : currentIndex;

      setRemaining(nextRemaining);
      setCurrentIndex(nextIdx);
    }

    setFlipped(false);

    setTimeout(() => {
      if (shouldEndRound) {
        const finalWrongCount = roundWrong + (known ? 0 : 1);

        if (finalWrongCount === 0) {
          setFinished(true);
          deleteSession();
        } else {
          setRoundEnded(true);
        }
      }

      setSlideDirection(null);
      setOutgoingCard(null);
      setOutgoingFlipped(false);
      setIsTransitioning(false);
    }, 400);
  };

  const totalCards = allCards.length;
  const roundTotal =
    roundCorrect + roundWrong + remaining.length;

  const progressPct =
    roundTotal > 0
      ? Math.round(
          ((roundCorrect + roundWrong) / roundTotal) * 100
        )
      : 0;

  const currentFront =
    mode === "word-first"
      ? current?.word
      : current?.definition;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14]">
        <Loader2 className="h-9 w-9 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <h1 className="text-lg font-semibold">{listName}</h1>
          </div>
        </header>

        <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
              <div className="mb-3 text-5xl">🧠</div>

              <h2 className="text-3xl font-black tracking-tight">
                {t("flashcardsTitle", lang)}
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Wybierz sposób nauki i zacznij powtarzać słówka
                w nowoczesnym trybie fiszek.
              </p>
            </div>

            {hasExistingSession && (
              <Card className="mb-5 border-indigo-500/30 bg-indigo-500/10 backdrop-blur-xl">
                <CardContent className="space-y-4 py-5">
                  <p className="text-sm font-medium text-white">
                    Masz zapisaną sesję. Chcesz kontynuować?
                  </p>

                  <Button
                    onClick={resumeSession}
                    className="w-full bg-indigo-500 hover:bg-indigo-600"
                    size="lg"
                  >
                    Kontynuuj sesję
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <Button
                onClick={() => startSession("word-first")}
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-base font-semibold hover:opacity-95"
              >
                {t("seeWordFirst", lang)}
              </Button>

              <Button
                onClick={() =>
                  startSession("definition-first")
                }
                variant="outline"
                className="h-14 w-full rounded-2xl border-white/10 bg-white/[0.03] text-base text-white hover:bg-white/10"
              >
                {t("seeDefinitionFirst", lang)}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] px-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mb-4 text-6xl">🎉</div>

          <h2 className="text-3xl font-black">
            {t("allCardsLearned", lang)}
          </h2>

          <p className="mt-3 leading-relaxed text-slate-400">
            Opanowałeś wszystkie {totalCards} fiszek z „
            {listName}”
          </p>

          <div className="mt-8 space-y-3">
            <Button
              onClick={restartAll}
              variant="outline"
              className="h-14 w-full rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Zacznij od nowa
            </Button>

            <Button
              onClick={() => navigate("/dashboard")}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-95"
            >
              {t("backToHome", lang)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (roundEnded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] px-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mb-4 text-6xl">📊</div>

          <h2 className="text-3xl font-black">
            Runda {roundNumber} zakończona
          </h2>

          <p className="mt-3 text-slate-400">
            Zobaczyłeś każdą fiszkę dokładnie raz.
          </p>

          <div className="my-8 flex justify-center gap-4">
            <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4">
              <Check className="mb-2 h-5 w-5 text-emerald-400" />
              <span className="text-3xl font-black text-emerald-400">
                {roundCorrect}
              </span>
              <span className="text-xs text-slate-400">
                umiem
              </span>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4">
              <X className="mb-2 h-5 w-5 text-red-400" />
              <span className="text-3xl font-black text-red-400">
                {roundWrong}
              </span>
              <span className="text-xs text-slate-400">
                do powtórki
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={continueWithWrong}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-95"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Kontynuuj naukę ({roundWrong})
            </Button>

            <Button
              onClick={restartAll}
              variant="outline"
              className="h-14 w-full rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Zacznij od nowa
            </Button>

            <Button
              onClick={() => navigate("/dashboard")}
              variant="ghost"
              className="w-full text-slate-400 hover:bg-white/5 hover:text-white"
            >
              {t("backToHome", lang)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-lg font-bold">{listName}</h1>

            <p className="text-xs text-slate-400">
              Runda {roundNumber} ·{" "}
              {roundCorrect + roundWrong}/{roundTotal}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={history.length === 0 || isTransitioning}
            title="Cofnij"
            className="text-white hover:bg-white/10"
          >
            <Undo2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <Progress
            value={progressPct}
            className="h-2 rounded-full bg-white/10"
          />
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5">
            <X className="h-5 w-5 text-red-400" />
            <span className="text-lg font-black text-red-400">
              {roundWrong}
            </span>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400">
            {remaining.length} pozostało
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
            <Check className="h-5 w-5 text-emerald-400" />
            <span className="text-lg font-black text-emerald-400">
              {roundCorrect}
            </span>
          </div>
        </div>

        <div
          className="relative overflow-hidden"
          style={{ minHeight: "320px" }}
        >
          {current && (
            <div className="relative z-0">
              <div
                onClick={() =>
                  !isTransitioning && setFlipped(!flipped)
                }
                className={`${
                  isTransitioning ? "" : "cursor-pointer"
                }`}
                style={{ perspective: "1200px" }}
              >
                <div
                  className={`relative ${
                    isTransitioning
                      ? ""
                      : "transition-transform duration-500"
                  }`}
                  style={{
                    transformStyle: "preserve-3d",
                    transform: flipped
                      ? "rotateY(180deg)"
                      : "rotateY(0deg)",
                    minHeight: "320px",
                  }}
                >
                  {/* FRONT */}
                  <Card
                    className="absolute inset-0 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827] shadow-2xl"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_40%)]" />

                    <CardContent className="relative flex h-full flex-col items-center justify-center px-8 py-12 text-center">
                      <p className="mb-5 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {mode === "word-first"
                          ? t("wordLabel", lang)
                          : t("definitionLabel", lang)}
                      </p>

                      <p className="max-w-xl text-3xl font-black leading-tight text-white md:text-4xl">
                        {currentFront}
                      </p>

                      <div className="mt-8 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-xs text-indigo-300">
                        Kliknij aby odwrócić
                      </div>
                    </CardContent>
                  </Card>

                  {/* BACK */}
                  <Card
                    className="absolute inset-0 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] shadow-2xl"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_40%)]" />

                    <CardContent className="relative flex h-full flex-col items-center justify-center px-8 py-12 text-center">
                      <p className="mb-5 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {mode === "word-first"
                          ? t("definitionLabel", lang)
                          : t("wordLabel", lang)}
                      </p>

                      <p className="max-w-xl text-3xl font-black leading-tight text-white md:text-4xl">
                        {mode === "word-first"
                          ? current?.definition
                          : current?.word}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {isTransitioning && outgoingCard && (
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                transform:
                  slideDirection === "right"
                    ? "translateX(120%) rotate(8deg)"
                    : slideDirection === "left"
                    ? "translateX(-120%) rotate(-8deg)"
                    : "translateX(0)",
                opacity: slideDirection ? 0.7 : 1,
                transition:
                  "transform 0.4s ease-in-out, opacity 0.35s ease-in-out",
              }}
            >
              <div style={{ perspective: "1200px" }}>
                <div
                  className="relative"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: outgoingFlipped
                      ? "rotateY(180deg)"
                      : "rotateY(0deg)",
                    minHeight: "320px",
                  }}
                >
                  <Card
                    className="absolute inset-0 rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827]"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <CardContent className="flex h-full items-center justify-center px-8 text-center">
                      <p className="text-3xl font-black text-white">
                        {mode === "word-first"
                          ? outgoingCard.word
                          : outgoingCard.definition}
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    className="absolute inset-0 rounded-[32px] border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a]"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <CardContent className="flex h-full items-center justify-center px-8 text-center">
                      <p className="text-3xl font-black text-white">
                        {mode === "word-first"
                          ? outgoingCard.definition
                          : outgoingCard.word}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>

        {flipped ? (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Button
              onClick={handleDontKnow}
              variant="outline"
              size="lg"
              className="h-16 rounded-2xl border-red-500/20 bg-red-500/10 text-base text-white hover:bg-red-500/20"
              disabled={isTransitioning}
            >
              <X className="mr-2 h-5 w-5 text-red-400" />
              Nie umiem
            </Button>

            <Button
              onClick={handleKnow}
              size="lg"
              className="h-16 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-base font-semibold text-white hover:opacity-95"
              disabled={isTransitioning}
            >
              <Check className="mr-2 h-5 w-5" />
              Umiem
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-slate-500">
            Spacja = odwróć • ← nie umiem • → umiem
          </p>
        )}
      </main>
    </div>
  );
};

export default FlashCards;