import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { parseN8nNote, stripHtml } from "@/lib/pendingNotes";

type U = { id: string; name: string; username: string; email: string };
type Sent = { id: string; user_id: string; title: string; status: string; created_at: string };

const STATUS: Record<string, string> = { pending: "⏳ oczekuje", accepted: "✅ przyjęta", rejected: "❌ odrzucona" };

export default function AdminSendNoteView({ users }: { users: U[] }) {
  const [raw, setRaw] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent[]>([]);

  const parsed = useMemo(() => (raw.trim() ? parseN8nNote(raw) : null), [raw]);
  const matches = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }).slice(0, 8);
  const selected = users.find(u => u.id === userId);

  const load = async () => {
    const { data, error } = await (supabase as any).from("pending_notes").select("id,user_id,title,status,created_at").order("created_at", { ascending: false }).limit(30);
    if (!error) setSent(data || []);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!parsed?.title || !parsed.content) return toast.error("Nie rozpoznano tytułu lub treści notatki");
    if (!userId) return toast.error("Wybierz użytkownika");
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const { error } = await (supabase as any).from("pending_notes").insert({
      user_id: userId, title: parsed.title, content: parsed.content, events: parsed.events, created_by: s.session?.user?.id ?? null,
    });
    setBusy(false);
    if (error) { console.error(error); return toast.error("Nie udało się wysłać notatki"); }
    toast.success(`Notatka wysłana do ${selected?.username}`);
    setRaw(""); setUserId(""); setSearch("");
    load();
  };

  const nameOf = (id: string) => users.find(u => u.id === id)?.username || id.slice(0, 8);

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
      <div className="admin-section-title">📨 Wyślij notatkę użytkownikowi</div>
      <div className="admin-card" style={{ display: "grid", gap: 12, padding: 16 }}>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={"Wklej kod z n8n, np.\ntitle:Tytuł\ntext:<h1>…</h1>"}
          rows={8}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "inherit", border: "1px solid rgba(255,255,255,0.12)" }}
        />
        {parsed && (
          <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
            <div><b>Tytuł:</b> {parsed.title || <span style={{ color: "#ef4444" }}>brak</span>}</div>
            <div style={{ opacity: 0.8 }}><b>Treść:</b> {stripHtml(parsed.content).slice(0, 220) || <span style={{ color: "#ef4444" }}>brak</span>}…</div>
            {parsed.events.length > 0 && (
              <div><b>Wydarzenia:</b> {parsed.events.map(e => `${e.name} (${e.date}${e.time ? " " + e.time : ", cały dzień"})`).join("; ")}</div>
            )}
          </div>
        )}
        <div>
          <input
            value={selected ? `${selected.name} (@${selected.username})` : search}
            onChange={e => { setUserId(""); setSearch(e.target.value); }}
            placeholder="Szukaj użytkownika (imię, nazwa konta, e-mail)"
            style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "inherit", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          {!selected && search && (
            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
              {matches.map(u => (
                <button key={u.id} className="admin-btn admin-btn-sm" style={{ textAlign: "left" }} onClick={() => setUserId(u.id)}>
                  {u.name} (@{u.username}) · {u.email}
                </button>
              ))}
              {matches.length === 0 && <div style={{ opacity: 0.6, fontSize: 13 }}>Brak wyników</div>}
            </div>
          )}
        </div>
        <button className="admin-btn admin-btn-grad" disabled={busy} onClick={send}>{busy ? "Wysyłanie…" : "Wyślij notatkę"}</button>
      </div>

      <div className="admin-section-title">Wysłane notatki</div>
      <div className="admin-card" style={{ padding: 12, display: "grid", gap: 6 }}>
        {sent.length === 0 && <div style={{ opacity: 0.6, fontSize: 13 }}>Brak wysłanych notatek</div>}
        {sent.map(s => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
            <span>{s.title} → @{nameOf(s.user_id)}</span>
            <span style={{ opacity: 0.8, whiteSpace: "nowrap" }}>{STATUS[s.status] || s.status} · {new Date(s.created_at).toLocaleDateString("pl")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
