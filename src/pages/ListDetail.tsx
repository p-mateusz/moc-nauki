import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  AlertTriangle,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { t, getLang } from "@/lib/i18n";

type Word = {
  id: string;
  word: string;
  definition: string | null;
};

type Sentence = {
  id: string;
  wordId: string;
  sentence: string;
  hint: string | null;
};

type EditingSentenceState = {
  wordId: string;
  sentenceId: string;
} | null;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#060d1a",
  color: "#f1f5f9",
  position: "relative",
  overflow: "hidden",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
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
  background: "rgba(15,17,23,0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 22,
  overflow: "hidden",
  backdropFilter: "blur(10px)",
  boxShadow: "0 0 40px rgba(0,0,0,0.35)",
};

const ListDetail = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const lang = getLang();

  const [listName, setListName] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [sentences, setSentences] = useState<{
    [wordId: string]: Sentence[];
  }>({});

  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editDef, setEditDef] = useState("");

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const deleteTimeoutRef = useRef<number | null>(null);

  const [addingWord, setAddingWord] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newDef, setNewDef] = useState("");

  const [editingSentence, setEditingSentence] =
    useState<EditingSentenceState>(null);

  const [editSentenceText, setEditSentenceText] = useState("");
  const [savingSentence, setSavingSentence] = useState(false);

  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!listId) return;

    loadData();

    return () => {
      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, [listId]);

  const loadData = async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;

    try {
      const { data: list } = await supabase
        .from("word_lists")
        .select("name")
        .eq("id", listId!)
        .single();

      if (list) setListName(list.name);

      const { data: w } = await supabase
        .from("words")
        .select("id, word, definition")
        .eq("list_id", listId!)
        .order("created_at");

      setWords(w || []);

      if (w && w.length > 0) {
        const { data: sent, error: sentError } = await supabase
          .from("generated_sentences")
          .select("id, word_id, sentence, hint")
          .eq("list_id", listId!);

        if (sentError) {
          console.error(sentError);
        } else {
          const grouped: { [wordId: string]: Sentence[] } = {};

          (sent || []).forEach((s) => {
            if (!grouped[s.word_id]) grouped[s.word_id] = [];

            grouped[s.word_id].push({
              id: s.id,
              wordId: s.word_id,
              sentence: s.sentence || "",
              hint: s.hint || null,
            });
          });

          setSentences(grouped);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  };

  const startEdit = (w: Word) => {
    setEditingId(w.id);
    setEditWord(w.word);
    setEditDef(w.definition || "");
  };

  const saveEdit = async () => {
    if (!editingId || !editWord.trim()) return;

    try {
      const newDefinition = editDef.trim() || null;

      const { error } = await supabase
        .from("words")
        .update({
          word: editWord.trim(),
          definition: newDefinition,
        })
        .eq("id", editingId);

      if (error) {
        toast.error(error.message);
        return;
      }

      await supabase
        .from("generated_sentences")
        .update({
          word: editWord.trim(),
          definition: newDefinition,
          hint: newDefinition,
        })
        .eq("word_id", editingId);

      setWords((prev) =>
        prev.map((w) =>
          w.id === editingId
            ? {
                ...w,
                word: editWord.trim(),
                definition: newDefinition,
              }
            : w
        )
      );

      setEditingId(null);

      toast.success("Słowo zapisane");
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDeleteClick = (wordId: string) => {
    if (pendingDeleteId === wordId) {
      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
      }

      setPendingDeleteId(null);

      performDelete(wordId);
    } else {
      setPendingDeleteId(wordId);

      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
      }

      deleteTimeoutRef.current = window.setTimeout(() => {
        setPendingDeleteId(null);
      }, 3000);
    }
  };

  const performDelete = async (wordId: string) => {
    try {
      await supabase
        .from("practice_progress")
        .delete()
        .eq("word_id", wordId);

      await supabase
        .from("generated_sentences")
        .delete()
        .eq("word_id", wordId);

      const { error } = await supabase
        .from("words")
        .delete()
        .eq("id", wordId);

      if (error) {
        toast.error(error.message);
        return;
      }

      setWords((prev) => prev.filter((w) => w.id !== wordId));

      toast.success("Usunięto słowo");
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim() || !listId) return;

    try {
      const { data, error } = await supabase
        .from("words")
        .insert({
          list_id: listId,
          word: newWord.trim(),
          definition: newDef.trim() || null,
        })
        .select()
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      setWords((prev) => [...prev, data]);

      setNewWord("");
      setNewDef("");
      setAddingWord(false);

      toast.success("Dodano słowo");
    } catch (err) {
      toast.error(String(err));
    }
  };

  const startEditSentence = (
    wordId: string,
    sentence: Sentence
  ) => {
    setEditingSentence({
      wordId,
      sentenceId: sentence.id,
    });

    setEditSentenceText(sentence.sentence);
  };

  const saveSentenceEdit = async () => {
    if (!editingSentence) return;

    const { sentenceId } = editingSentence;

    const newSentenceText = editSentenceText.trim();

    setSavingSentence(true);

    try {
      const { error } = await supabase
        .from("generated_sentences")
        .update({
          sentence: newSentenceText,
        })
        .eq("id", sentenceId);

      if (error) {
        toast.error(error.message);
        return;
      }

      setSentences((prev) => ({
        ...prev,
        [editingSentence.wordId]:
          prev[editingSentence.wordId].map((s) =>
            s.id === sentenceId
              ? {
                  ...s,
                  sentence: newSentenceText,
                }
              : s
          ),
      }));

      setEditingSentence(null);
      setEditSentenceText("");

      toast.success("Zdanie zapisane");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSavingSentence(false);
    }
  };

  const cancelEditSentence = () => {
    setEditingSentence(null);
    setEditSentenceText("");
  };

  return (
    <div style={pageStyle}>
      <div style={blob1Style} />
      <div style={blob2Style} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* HEADER */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            backdropFilter: "blur(16px)",
            background: "rgba(6,13,26,0.8)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 2,
                }}
              >
                <BookOpen size={20} color="#60a5fa" />

                <h1
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  {listName}
                </h1>
              </div>

              <p
                style={{
                  color: "#94a3b8",
                  fontSize: ".9rem",
                }}
              >
                {words.length} słów
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Button
                variant="outline"
                onClick={() => navigate(`/flashcards/${listId}`)}
              >
                Flashcards
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate(`/quiz/${listId}`)}
              >
                Quiz
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate(`/practice/${listId}`)}
              >
                Practice
              </Button>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "28px 20px 60px",
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: "center",
                color: "#94a3b8",
                paddingTop: 60,
              }}
            >
              Ładowanie...
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {words.map((w) => {
                const isEditingWord = editingId === w.id;

                const wordSentences = sentences[w.id] || [];

                const pendingDelete =
                  pendingDeleteId === w.id;

                return (
                  <div
                    key={w.id}
                    style={cardStyle}
                  >
                    <div
                      style={{
                        padding: 24,
                      }}
                    >
                      {isEditingWord ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                          }}
                        >
                          <Input
                            value={editWord}
                            onChange={(e) =>
                              setEditWord(e.target.value)
                            }
                            placeholder="Słowo"
                            autoFocus
                          />

                          <Input
                            value={editDef}
                            onChange={(e) =>
                              setEditDef(e.target.value)
                            }
                            placeholder="Definicja"
                          />

                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                            }}
                          >
                            <Button onClick={saveEdit}>
                              <Check className="mr-2 h-4 w-4" />
                              Zapisz
                            </Button>

                            <Button
                              variant="ghost"
                              onClick={() =>
                                setEditingId(null)
                              }
                            >
                              <X className="mr-2 h-4 w-4" />
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: 18,
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: "1.2rem",
                                  fontWeight: 800,
                                  marginBottom: 8,
                                }}
                              >
                                {w.word}
                              </div>

                              <div
                                style={{
                                  color: "#94a3b8",
                                  lineHeight: 1.6,
                                }}
                              >
                                {w.definition ||
                                  "Brak definicji"}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                              }}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  startEdit(w)
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDeleteClick(w.id)
                                }
                                style={{
                                  color: pendingDelete
                                    ? "#fb923c"
                                    : "#ef4444",
                                }}
                              >
                                {pendingDelete ? (
                                  <AlertTriangle className="h-4 w-4" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {wordSentences.length > 0 && (
                            <div
                              style={{
                                marginTop: 24,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  color: "#60a5fa",
                                  fontSize: ".8rem",
                                  fontWeight: 700,
                                  letterSpacing: 1,
                                  textTransform:
                                    "uppercase",
                                }}
                              >
                                <Sparkles size={14} />
                                Zdania
                              </div>

                              {wordSentences.map(
                                (sent, index) => {
                                  const isEditingThis =
                                    editingSentence?.sentenceId ===
                                    sent.id;

                                  return (
                                    <div
                                      key={`${sent.id}-${index}`}
                                      style={{
                                        background:
                                          "rgba(255,255,255,0.03)",
                                        border:
                                          "1px solid rgba(255,255,255,0.06)",
                                        borderRadius: 16,
                                        padding: 16,
                                      }}
                                    >
                                      {isEditingThis ? (
                                        <div
                                          style={{
                                            display:
                                              "flex",
                                            flexDirection:
                                              "column",
                                            gap: 12,
                                          }}
                                        >
                                          <Input
                                            value={
                                              editSentenceText
                                            }
                                            onChange={(
                                              e
                                            ) =>
                                              setEditSentenceText(
                                                e.target
                                                  .value
                                              )
                                            }
                                            placeholder="Zdanie..."
                                            autoFocus
                                          />

                                          <div
                                            style={{
                                              display:
                                                "flex",
                                              gap: 10,
                                            }}
                                          >
                                            <Button
                                              onClick={
                                                saveSentenceEdit
                                              }
                                              disabled={
                                                savingSentence
                                              }
                                            >
                                              <Check className="mr-2 h-4 w-4" />
                                              {savingSentence
                                                ? "Zapisywanie..."
                                                : "Zapisz"}
                                            </Button>

                                            <Button
                                              variant="ghost"
                                              onClick={
                                                cancelEditSentence
                                              }
                                            >
                                              <X className="mr-2 h-4 w-4" />
                                              Anuluj
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          style={{
                                            display:
                                              "flex",
                                            gap: 12,
                                            alignItems:
                                              "flex-start",
                                          }}
                                        >
                                          <div
                                            style={{
                                              flex: 1,
                                              lineHeight: 1.7,
                                              color:
                                                "#e2e8f0",
                                            }}
                                          >
                                            {
                                              sent.sentence
                                            }
                                          </div>

                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() =>
                                              startEditSentence(
                                                w.id,
                                                sent
                                              )
                                            }
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ADD WORD */}
              <div style={cardStyle}>
                <div style={{ padding: 24 }}>
                  {addingWord ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      <Input
                        value={newWord}
                        onChange={(e) =>
                          setNewWord(e.target.value)
                        }
                        placeholder="Nowe słowo"
                        autoFocus
                      />

                      <Input
                        value={newDef}
                        onChange={(e) =>
                          setNewDef(e.target.value)
                        }
                        placeholder="Definicja"
                      />

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                        }}
                      >
                        <Button
                          onClick={handleAddWord}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Dodaj
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() =>
                            setAddingWord(false)
                          }
                        >
                          <X className="mr-2 h-4 w-4" />
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setAddingWord(true)
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Dodaj nowe słowo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ListDetail;