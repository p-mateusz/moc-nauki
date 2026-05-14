import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Check, X, Plus, AlertTriangle } from "lucide-react";
import { t, getLang } from "@/lib/i18n";

type Word = { id: string; word: string; definition: string | null };
type Sentence = { id: string; wordId: string; sentence: string; hint: string | null };
type EditingSentenceState = { wordId: string; sentenceId: string } | null;

const ListDetail = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const lang = getLang();
  const [listName, setListName] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [sentences, setSentences] = useState<{ [wordId: string]: Sentence[] }>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editDef, setEditDef] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);
  const [addingWord, setAddingWord] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newDef, setNewDef] = useState("");
  const [editingSentence, setEditingSentence] = useState<EditingSentenceState>(null);
  const [editSentenceText, setEditSentenceText] = useState("");
  const [savingSentence, setSavingSentence] = useState(false);

  useEffect(() => {
    if (!listId) return;
    loadData();
    return () => {
      if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
    };
  }, [listId]);

  const loadData = async () => {
    try {
      const { data: list } = await supabase.from("word_lists").select("name").eq("id", listId!).single();
      if (list) setListName(list.name);

      const { data: w } = await supabase.from("words").select("id, word, definition").eq("list_id", listId!).order("created_at");
      setWords(w || []);

      if (w && w.length > 0) {
        const { data: sent, error: sentError } = await supabase
          .from("generated_sentences")
          .select("id, word_id, sentence, hint")
          .eq("list_id", listId!);

        if (sentError) {
          console.error("Error loading sentences:", sentError);
        } else {
          const sentencesByWord: { [wordId: string]: Sentence[] } = {};
          (sent || []).forEach((s) => {
            if (!sentencesByWord[s.word_id]) sentencesByWord[s.word_id] = [];
            sentencesByWord[s.word_id].push({
              id: s.id,
              wordId: s.word_id,
              sentence: s.sentence || "",
              hint: s.hint || null,
            });
          });
          setSentences(sentencesByWord);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error in loadData:", err);
      setLoading(false);
    }
  };

  const startEdit = (w: Word) => {
    setEditingId(w.id);
    setEditWord(w.word);
    setEditDef(w.definition || "");
  };

  const saveEdit = async () => {
    if (!editingId || !editWord.trim()) return;
    const newDefinition = editDef.trim() || null;
    try {
      const { error } = await supabase
        .from("words")
        .update({ word: editWord.trim(), definition: newDefinition })
        .eq("id", editingId);

      if (error) {
        toast.error("Błąd: " + error.message);
        return;
      }

      // Sync word and definition into all related generated sentences so all study modes use the updated term.
      // First, check if there are any sentences to update
      const { data: sentencesToSync } = await supabase
        .from("generated_sentences")
        .select("id")
        .eq("word_id", editingId);

      console.log("Sentences to sync:", sentencesToSync?.length || 0);

      if (sentencesToSync && sentencesToSync.length > 0) {
        const { error: sentenceUpdateError } = await supabase
          .from("generated_sentences")
          .update({ word: editWord.trim(), hint: newDefinition, definition: newDefinition })
          .eq("word_id", editingId);

        if (sentenceUpdateError) {
          console.error("Error syncing to generated_sentences:", sentenceUpdateError);
          toast.error("Błąd synchronizacji zdań: " + sentenceUpdateError.message);
          return;
        }

        console.log("Sentences synced successfully");
      } else {
        console.log("No sentences to sync for this word");
      }

      toast.success(t("wordUpdated", lang));
      setEditingId(null);
      loadData();
    } catch (err) {
      toast.error("Błąd: " + String(err));
    }
  };

  const handleDeleteClick = (wordId: string) => {
    if (pendingDeleteId === wordId) {
      // Confirm delete
      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
      setPendingDeleteId(null);
      performDelete(wordId);
    } else {
      setPendingDeleteId(wordId);
      if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = window.setTimeout(() => {
        setPendingDeleteId(null);
        deleteTimeoutRef.current = null;
      }, 3000);
    }
  };

  const performDelete = async (wordId: string) => {
    try {
      await supabase.from("practice_progress").delete().eq("word_id", wordId);
      await supabase.from("generated_sentences").delete().eq("word_id", wordId);
      const { error } = await supabase.from("words").delete().eq("id", wordId);
      if (error) {
        toast.error("Błąd: " + error.message);
        return;
      }
      toast.success(t("wordDeleted", lang));
      loadData();
    } catch (err) {
      toast.error("Błąd: " + String(err));
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim() || !listId) return;
    try {
      const { error } = await supabase
        .from("words")
        .insert({ list_id: listId, word: newWord.trim(), definition: newDef.trim() || null });
      if (error) {
        toast.error("Błąd: " + error.message);
        return;
      }
      toast.success(t("wordsAdded", lang));
      setNewWord("");
      setNewDef("");
      setAddingWord(false);
      loadData();
    } catch (err) {
      toast.error("Błąd: " + String(err));
    }
  };

  const startEditSentence = (wordId: string, sentence: Sentence) => {
    setEditingSentence({ wordId, sentenceId: sentence.id });
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
        .update({ sentence: newSentenceText })
        .eq("id", sentenceId);

      if (error) {
        toast.error("Błąd: " + error.message);
        setSavingSentence(false);
        return;
      }

      setEditingSentence(null);
      setEditSentenceText("");
      await loadData();
      toast.success("Zdanie zaktualizowane");
    } catch (err) {
      toast.error("Błąd: " + String(err));
    } finally {
      setSavingSentence(false);
    }
  };

  const cancelEditSentence = () => {
    setEditingSentence(null);
    setEditSentenceText("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-card/30 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{listName}</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{words.length} {t("words", lang)}</p>
          </div>
          <div className="flex w-full gap-1.5 sm:w-auto sm:gap-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => navigate(`/flashcards/${listId}`)}>
              {t("flashcards", lang)}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => navigate(`/quiz/${listId}`)}>
              Quiz
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => navigate(`/practice/${listId}`)}>
              {t("practiceList", lang)}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {loading ? (
          <p className="text-center text-muted-foreground">{t("loading", lang)}</p>
        ) : (
          <>
            {words.map((w) => {
              const isEditingWord = editingId === w.id;
              const wordSentences = sentences[w.id] || [];
              const pendingDelete = pendingDeleteId === w.id;
              return (
                <Card
                  key={w.id}
                  className={`overflow-hidden transition-colors ${isEditingWord ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
                >
                  <CardContent className="p-0">
                    <div className="flex items-start gap-2 p-3 sm:gap-3 sm:p-4">
                      {isEditingWord ? (
                        <div className="flex flex-1 flex-col gap-2.5">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{t("wordPlaceholder", lang)}</label>
                            <Input value={editWord} onChange={(e) => setEditWord(e.target.value)} placeholder={t("wordPlaceholder", lang)} autoFocus />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{t("definitionPlaceholder", lang)}</label>
                            <Input value={editDef} onChange={(e) => setEditDef(e.target.value)} placeholder={t("definitionPlaceholder", lang)} />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={saveEdit}><Check className="mr-1 h-4 w-4" /> {t("save", lang)}</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 h-4 w-4" /> {t("cancel", lang)}</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-medium text-foreground">{w.word}</p>
                            <p className="break-words text-sm text-muted-foreground">
                              {w.definition || <span className="italic opacity-70">{t("noDefinition", lang)}</span>}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(w)} aria-label="Edytuj słowo">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${pendingDelete ? "text-orange-500 hover:text-orange-500 animate-pulse" : "text-destructive hover:text-destructive"}`}
                              onClick={() => handleDeleteClick(w.id)}
                              aria-label={pendingDelete ? "Kliknij ponownie aby usunąć" : "Usuń słowo"}
                              title={pendingDelete ? "Kliknij ponownie aby potwierdzić" : "Usuń"}
                            >
                              {pendingDelete ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {!isEditingWord && wordSentences.length > 0 && (
                      <div className="space-y-2 border-t border-border/60 bg-muted/20 p-3 sm:p-4">
                        {wordSentences.map((sent) => {
                          const isEditingThis = editingSentence?.sentenceId === sent.id;
                          return (
                            <div
                              key={sent.id}
                              className={`rounded-lg border bg-card/60 p-3 transition-colors ${
                                isEditingThis ? "border-primary/50 ring-1 ring-primary/20" : "border-border/50"
                              }`}
                            >
                              {isEditingThis ? (
                                <div className="flex flex-col gap-2.5">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Zdanie</label>
                                    <Input value={editSentenceText} onChange={(e) => setEditSentenceText(e.target.value)} placeholder="Zdanie..." autoFocus />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" onClick={saveSentenceEdit} disabled={savingSentence}>
                                      <Check className="mr-1 h-4 w-4" />
                                      {savingSentence ? "Zapisywanie..." : t("save", lang)}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={cancelEditSentence} disabled={savingSentence}>
                                      <X className="mr-1 h-4 w-4" /> {t("cancel", lang)}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm text-foreground">{sent.sentence}</p>
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => startEditSentence(w.id, sent)} aria-label="Edytuj zdanie">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {addingWord ? (
              <Card className="border-primary/50 ring-1 ring-primary/20">
                <CardContent className="space-y-2.5 p-3 sm:p-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("wordPlaceholder", lang)}</label>
                    <Input value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder={t("wordPlaceholder", lang)} autoFocus />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("definitionPlaceholder", lang)}</label>
                    <Input value={newDef} onChange={(e) => setNewDef(e.target.value)} placeholder={t("definitionPlaceholder", lang)} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleAddWord}><Check className="mr-1 h-4 w-4" /> {t("addWord", lang)}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingWord(false)}><X className="mr-1 h-4 w-4" /> {t("cancel", lang)}</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setAddingWord(true)}>
                <Plus className="mr-2 h-4 w-4" /> {t("addWord", lang)}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ListDetail;
