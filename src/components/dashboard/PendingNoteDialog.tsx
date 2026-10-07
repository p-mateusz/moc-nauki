import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { insertParsedEvents, stripHtml, type ParsedEvent } from "@/lib/pendingNotes";

type Pending = { id: string; title: string; content: string; events: ParsedEvent[] };
type Nb = { id: string; name: string; sections: { id: string; name: string }[] };

export default function PendingNoteDialog({ userId }: { userId: string | null }) {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [nbs, setNbs] = useState<Nb[]>([]);
  const [nbId, setNbId] = useState("");
  const [secId, setSecId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || userId === "guest") return;
    (async () => {
      const { data, error } = await (supabase as any).from("pending_notes").select("id,title,content,events")
        .eq("user_id", userId).eq("status", "pending").order("created_at");
      if (error || !data?.length) return;
      setQueue(data);
      const { data: books } = await supabase.from("notebooks").select("id,name").eq("user_id", userId).order("sort_order");
      const ids = (books || []).map(b => b.id);
      const { data: secs } = ids.length
        ? await supabase.from("notebook_sections").select("id,name,notebook_id").in("notebook_id", ids).order("sort_order")
        : { data: [] as any[] };
      const list = (books || []).map(b => ({ id: b.id, name: b.name, sections: (secs || []).filter((s: any) => s.notebook_id === b.id) }));
      setNbs(list);
      const first = list.find(n => n.sections.length) || list[0];
      if (first) { setNbId(first.id); setSecId(first.sections[0]?.id || ""); }
    })();
  }, [userId]);

  const cur = queue[0];
  if (!cur || !userId) return null;
  const nb = nbs.find(n => n.id === nbId);

  const resolve = async (status: "accepted" | "rejected") => {
    setBusy(true);
    try {
      if (status === "accepted") {
        if (!secId) { toast.error("Wybierz notes i sekcję"); return; }
        const { data: last } = await supabase.from("notebook_pages").select("sort_order").eq("section_id", secId).order("sort_order", { ascending: false }).limit(1);
        const { error } = await supabase.from("notebook_pages").insert({ section_id: secId, title: cur.title, content: cur.content, sort_order: (last?.[0]?.sort_order ?? -1) + 1 } as any);
        if (error) throw error;
        try { await insertParsedEvents(userId, cur.events || [], cur.title); } catch (e) { console.error(e); }
        window.dispatchEvent(new CustomEvent("notesTab_externalNoteAdded"));
      }
      const { error } = await (supabase as any).from("pending_notes").update({ status, resolved_at: new Date().toISOString() }).eq("id", cur.id);
      if (error) throw error;
      toast.success(status === "accepted" ? "✓ Notatka dodana" : "Notatka odrzucona");
      setQueue(q => q.slice(1));
    } catch (e) {
      console.error(e);
      toast.error("Coś poszło nie tak — spróbuj ponownie");
    } finally { setBusy(false); }
  };

  const field = { width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "inherit", border: "1px solid rgba(255,255,255,0.15)" } as const;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#141a2a", color: "#e8edf7", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, display: "grid", gap: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>📝 Masz nową notatkę{queue.length > 1 ? ` (1 z ${queue.length})` : ""}</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{cur.title}</div>
        <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>{stripHtml(cur.content).slice(0, 200)}…</div>
        {nbs.length === 0 ? (
          <div style={{ fontSize: 13, color: "#fbbf24" }}>Najpierw utwórz notes w zakładce Notatki, aby przyjąć notatkę.</div>
        ) : (
          <>
            <select style={field} value={nbId} onChange={e => { setNbId(e.target.value); setSecId(nbs.find(n => n.id === e.target.value)?.sections[0]?.id || ""); }}>
              {nbs.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <select style={field} value={secId} onChange={e => setSecId(e.target.value)}>
              {(nb?.sections || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {!nb?.sections.length && <option value="">Brak sekcji w tym notesie</option>}
            </select>
          </>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button disabled={busy} onClick={() => resolve("rejected")} style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "inherit", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}>Odrzuć</button>
          <button disabled={busy || !secId} onClick={() => resolve("accepted")} style={{ padding: "10px 18px", borderRadius: 10, background: "linear-gradient(135deg,#22d3ee,#6366f1)", color: "#fff", border: 0, cursor: "pointer", opacity: secId ? 1 : 0.5 }}>Przyjmij</button>
        </div>
      </div>
    </div>
  );
}
