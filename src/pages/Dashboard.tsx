import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { clearAuthStorage } from "@/lib/authCleanup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Plus, LogOut, BookOpen, Eye, Pencil, Trash2, MoreVertical, Layers, Share2 } from "lucide-react";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WordList = {
  id: string;
  name: string;
  created_at: string;
  wordCount: number;
  mastered: number;
  total: number;
  sentencesGenerating: boolean;
  isDraft: boolean;
};

const Dashboard = () => {
  const [lists, setLists] = useState<WordList[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const userName = localStorage.getItem("userName");
  const lang = getLang();

  useEffect(() => {
    if (!userId) { navigate("/"); return; }
    fetchLists();

    // Poll for updates to sentences_generating status
    const pollInterval = setInterval(() => {
      fetchLists();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [userId]);

  const fetchLists = async () => {
    const { data: wordLists } = await supabase
      .from("word_lists")
      .select("id, name, created_at, sentences_generating, is_draft")
      .eq("user_id", userId!)
      .eq("language", lang)
      .order("created_at", { ascending: false });

    if (!wordLists) { setLoading(false); return; }

    const enriched = await Promise.all(
      wordLists.map(async (list: any) => {
        const { count: wordCount } = await supabase
          .from("words")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        const { data: progress } = await supabase
          .from("practice_progress")
          .select("mastered")
          .eq("list_id", list.id)
          .eq("user_id", userId!);
        const mastered = progress?.filter((p) => p.mastered).length || 0;
        return {
          ...list,
          wordCount: wordCount || 0,
          mastered,
          total: progress?.length || 0,
          sentencesGenerating: list.sentences_generating || false,
          isDraft: list.is_draft || false,
        };
      })
    );
    setLists(enriched);
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      const signOutPromise = supabase.auth.signOut();
      const res = await signOutPromise;
      if (res?.error) {
        console.error("logout error:", res.error);
        toast.warning("Błąd podczas wylogowywania po stronie serwera — zakończono lokalnie");
        // proceed with local cleanup
        clearAuthStorage();
        // Force-clear client session so getSession() returns null
        try { await supabase.auth.setSession({ access_token: "", refresh_token: "" }); } catch (e) { /* ignore */ }
        navigate("/", { replace: true });
        // background retry
        signOutPromise.then(r => { if (r?.error) console.warn("background signOut error:", r.error); else console.log("background signOut succeeded"); }).catch(e => console.warn(e));
        return;
      }
      clearAuthStorage();
      try { await supabase.auth.setSession({ access_token: "", refresh_token: "" }); } catch (e) { /* ignore */ }
      toast.success("Wylogowano pomyślnie");
      navigate("/", { replace: true });
    } catch (err) {
      console.error("logout exception:", err);
      toast.warning("Błąd podczas wylogowywania — zakończono lokalnie");
      clearAuthStorage();
      try { await supabase.auth.setSession({ access_token: "", refresh_token: "" }); } catch (e) { /* ignore */ }
      navigate("/", { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("practice_progress").delete().eq("list_id", deleteId);
    await supabase.from("words").delete().eq("list_id", deleteId);
    await supabase.from("word_lists").delete().eq("id", deleteId);
    toast.success(t("listDeleted", lang));
    setDeleteId(null);
    fetchLists();
  };

  const handleRename = async () => {
    if (!renameId || !newName.trim()) return;
    await supabase.from("word_lists").update({ name: newName.trim() }).eq("id", renameId);
    toast.success(t("listRenamed", lang));
    setRenameId(null);
    setNewName("");
    fetchLists();
  };

  const langFlag = ({ en: "🇬🇧", es: "🇪🇸", de: "🇩🇪", fr: "🇫🇷", it: "🇮🇹" } as const)[lang] || "🌍";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{langFlag} {t("myLists", lang)}</h1>
            <p className="text-sm text-muted-foreground">{t("hello", lang)}, {userName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Button onClick={() => navigate("/create")} className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          {t("newList", lang)}
        </Button>

        {loading ? (
          <p className="text-center text-muted-foreground">{t("loading", lang)}</p>
        ) : lists.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">{t("noListsYet", lang)}</p>
          </div>
        ) : (
          lists.map((list) => {
            const pct = list.total > 0 ? Math.round((list.mastered / list.total) * 100) : 0;
            const handleShare = async (e: React.MouseEvent) => {
              e.stopPropagation();
              const url = `${window.location.origin}/share/${list.id}`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success(t("linkCopied", lang));
              } catch (err) {
                console.error('Failed to copy link: ', err);
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  toast.success(t("linkCopied", lang));
                } catch (fallbackErr) {
                  console.error('Fallback copy failed: ', fallbackErr);
                  toast.error("Failed to copy link");
                }
                document.body.removeChild(textArea);
              }
            };
            return (
              <Card key={list.id} className={`transition-shadow hover:shadow-md ${list.isDraft ? "border-amber-400/40" : ""}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CardTitle className="text-lg truncate">{list.name}</CardTitle>
                    {list.isDraft && (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300 border border-amber-500/30">
                        Wersja robocza
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!list.isDraft && (
                        <DropdownMenuItem onClick={() => navigate(`/list/${list.id}`)}>
                          <Eye className="mr-2 h-4 w-4" /> {t("viewWords", lang)}
                        </DropdownMenuItem>
                      )}
                      {!list.isDraft && (
                        <DropdownMenuItem onClick={() => handleShare({ stopPropagation: () => {} } as React.MouseEvent)}>
                          <Share2 className="mr-2 h-4 w-4" /> {t("shareList", lang)}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { setRenameId(list.id); setNewName(list.name); }}>
                        <Pencil className="mr-2 h-4 w-4" /> {t("renameList", lang)}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(list.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> {t("deleteList", lang)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3">
                  {list.isDraft ? (
                    <>
                      <div className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                        Ta lista jest niedokończona. Otwórz, aby kontynuować edycję i wygenerować zdania.
                      </div>
                      <div className="text-sm text-muted-foreground">{list.wordCount} {t("words", lang)}</div>
                      <Button onClick={() => navigate(`/create?draft=${list.id}`)} className="w-full" size="sm">
                        <Pencil className="mr-2 h-4 w-4" /> Dokończ listę
                      </Button>
                    </>
                  ) : (
                    <>
                      {list.sentencesGenerating && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
                          ⏳ Zdania są generowane w tle...
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{list.wordCount} {t("words", lang)}</span>
                        <span>{pct}% {t("mastered", lang)}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => navigate(`/practice/${list.id}`)}
                          className="flex-1"
                          size="sm"
                          disabled={list.sentencesGenerating}
                          title={list.sentencesGenerating ? "Zdania są wciąż generowane" : ""}
                        >
                          <BookOpen className="mr-2 h-4 w-4" /> {t("practiceList", lang)}
                        </Button>
                        <Button
                          onClick={() => navigate(`/flashcards/${list.id}`)}
                          variant="outline"
                          className="flex-1"
                          size="sm"
                          disabled={list.sentencesGenerating}
                          title={list.sentencesGenerating ? "Zdania są wciąż generowane" : ""}
                        >
                          <Layers className="mr-2 h-4 w-4" /> {t("flashcards", lang)}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteList", lang)}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDelete", lang)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", lang)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t("delete", lang)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameList", lang)}</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("enterNewName", lang)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>{t("cancel", lang)}</Button>
            <Button onClick={handleRename}>{t("rename", lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
