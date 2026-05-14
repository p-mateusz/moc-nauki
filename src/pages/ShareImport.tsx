import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ShareImport = () => {
  const { listId, slug } = useParams<{ listId?: string; slug?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const enterGuest = (id: string) => {
      if (cancelled) return;
      localStorage.setItem("guestMode", "true");
      localStorage.setItem("guestListId", id);
      localStorage.setItem("userName", "Gość");
      localStorage.setItem("userRole", "uczeń");
      localStorage.setItem("userId", "guest");
      navigate("/dashboard", { replace: true });
    };

    const resolve = async () => {
      // Direct list ID (legacy /share/:listId path or numeric/uuid passed)
      if (listId && UUID_RE.test(listId)) {
        enterGuest(listId);
        return;
      }

      // Slug-based path /s/:slug — resolve to list id
      const key = slug || listId;
      if (!key) {
        navigate("/", { replace: true });
        return;
      }

      const { data } = await supabase
        .from("word_lists")
        .select("id")
        .eq("share_slug", key)
        .maybeSingle();

      if (data?.id) {
        enterGuest(data.id);
      } else {
        navigate("/", { replace: true });
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [listId, slug, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
};

export default ShareImport;
