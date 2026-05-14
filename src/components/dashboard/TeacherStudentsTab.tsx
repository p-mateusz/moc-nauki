import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useRoles } from "@/hooks/use-roles";
import UserProfileModal from "./UserProfileModal";

function avInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.substring(0, 2).toUpperCase();
}

type UserInfo = { id: string; name: string; username: string; role: string; avatar_url?: string | null; avatar_color?: string };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; read: boolean; created_at: string };

interface Props {
  mode: "teacher" | "student";
  onMessagesRead?: () => void;
  guestMode?: boolean;
}

const TeacherStudentsTab = ({ mode, onMessagesRead, guestMode }: Props) => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [debugInfo, setDebugInfo] = useState<{ accounts?: any; profiles?: any } | null>(null);
  const [fallbackUsers, setFallbackUsers] = useState<UserInfo[] | null>(null);

  const userId = localStorage.getItem("userId") || "";
  const userRole = localStorage.getItem("userRole") || "uczeń";
  const targetRole = mode;
  const title = mode === "teacher" ? "👨‍🏫 Nauczyciele" : "👨‍🎓 Uczniowie";
  const subtitle = mode === "teacher" ? "Lista wszystkich nauczycieli" : "Lista wszystkich uczniów";

  const { roles, getRoleLabel, getRoleColor } = useRoles();

  useEffect(() => { 
    loadUsers(); 
    setSelectedUser(null);
    setMessages([]);
  }, [mode]);
  useEffect(() => { if (selectedUser) loadMessages(selectedUser.id); }, [selectedUser]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadUsers = async () => {
    if (guestMode) {
      // Demo data
      const demoUsers: UserInfo[] = mode === "teacher" ? [
        { id: "demo-t1", name: "Anna Kowalska", username: "a.kowalska", role: "nauczyciel", avatar_color: "av-c1" },
        { id: "demo-t2", name: "Piotr Nowak", username: "p.nowak", role: "nauczyciel", avatar_color: "av-c2" },
        { id: "demo-t3", name: "Magdalena Wiśniewska", username: "m.wisniewska", role: "nauczyciel", avatar_color: "av-c3" },
        { id: "demo-t4", name: "Tomasz Lewandowski", username: "t.lewandowski", role: "nauczyciel", avatar_color: "av-c4" },
        { id: "demo-t5", name: "Katarzyna Zielińska", username: "k.zielinska", role: "nauczyciel", avatar_color: "av-c5" },
        { id: "demo-t6", name: "Marek Wójcik", username: "m.wojcik", role: "nauczyciel", avatar_color: "av-c1" },
        { id: "demo-t7", name: "Joanna Dąbrowska", username: "j.dabrowska", role: "nauczyciel", avatar_color: "av-c2" },
        { id: "demo-t8", name: "Krzysztof Kamiński", username: "k.kaminski", role: "admin", avatar_color: "av-c3" },
      ] : [
        { id: "demo-s1", name: "Jan Kowalski", username: "j.kowalski", role: "uczeń", avatar_color: "av-c1" },
        { id: "demo-s2", name: "Aleksandra Nowak", username: "a.nowak", role: "uczeń", avatar_color: "av-c2" },
        { id: "demo-s3", name: "Michał Wiśniewski", username: "m.wisniewski", role: "uczeń", avatar_color: "av-c3" },
        { id: "demo-s4", name: "Karolina Lewandowska", username: "k.lewandowska", role: "uczeń", avatar_color: "av-c4" },
        { id: "demo-s5", name: "Bartosz Zieliński", username: "b.zielinski", role: "uczeń", avatar_color: "av-c5" },
        { id: "demo-s6", name: "Natalia Wójcik", username: "n.wojcik", role: "uczeń", avatar_color: "av-c1" },
        { id: "demo-s7", name: "Adam Dąbrowski", username: "a.dabrowski", role: "uczeń", avatar_color: "av-c2" },
        { id: "demo-s8", name: "Zuzanna Kamińska", username: "z.kaminska", role: "uczeń", avatar_color: "av-c3" },
      ];
      setUsers(demoUsers);
      // Auto-select first user
      setSelectedUser(demoUsers[0]);
      setLoading(false);
      return;
    }

    setFallbackUsers(null);

    const normalizeRole = (role?: string) => {
      const r = (role || "").toString().toLowerCase();
      if (r === "teacher" || r === "nauczyciel") return "nauczyciel";
      if (r === "student" || r === "uczeń" || r === "uczen") return "uczeń";
      if (r === "admin" || r === "administrator") return "admin";
      return r;
    };

    const isVisibleRole = (role: string) => {
      const normalized = normalizeRole(role);
      if (mode === "teacher") {
        return normalized === "nauczyciel" || normalized === "admin";
      }
      return normalized === "uczeń" || normalized === "admin";
    };

    const { data, error } = await supabase.functions.invoke("list-chat-users", {
      body: { mode },
    });

    if (error || data?.error) {
      console.error("Unable to load chat users:", error || data?.error);
      setDebugInfo({ accounts: data || error });
      setUsers([]);
      setLoading(false);
      return;
    }

    const mapped: UserInfo[] = ((data?.users || []) as UserInfo[])
      .filter((u) => u.id !== userId && isVisibleRole(u.role || ""))
      .map((u) => ({ ...u, role: normalizeRole(u.role) }));

    setUsers(mapped);
    setDebugInfo(null);
    setLoading(false);
  };


  const loadMessages = async (otherUserId: string) => {
    if (guestMode) {
      // Demo conversation with first teacher (Anna Kowalska) or first student
      const now = Date.now();
      const mins = (n: number) => new Date(now - n * 60000).toISOString();
      const isTeacherChat = mode === "teacher";
      const peerId = otherUserId;
      const demoMsgs: Message[] = isTeacherChat ? [
        { id: "m1", sender_id: peerId, receiver_id: userId, content: "Dzień dobry! Chciałam przypomnieć o jutrzejszym sprawdzianie z biologii.", read: true, created_at: mins(180) },
        { id: "m2", sender_id: userId, receiver_id: peerId, content: "Dzień dobry! Tak, pamiętam – materiał z układu krwionośnego, zgadza się?", read: true, created_at: mins(175) },
        { id: "m3", sender_id: peerId, receiver_id: userId, content: "Dokładnie. Dodatkowo będą pytania o budowę serca i obieg krwi.", read: true, created_at: mins(170) },
        { id: "m4", sender_id: userId, receiver_id: peerId, content: "Dziękuję za informację. Czy mogę liczyć na zadania powtórzeniowe?", read: true, created_at: mins(160) },
        { id: "m5", sender_id: peerId, receiver_id: userId, content: "Oczywiście, wysłałam je dzisiaj na grupę klasową.", read: true, created_at: mins(150) },
        { id: "m6", sender_id: userId, receiver_id: peerId, content: "Świetnie, zaraz sprawdzę. Dziękuję bardzo!", read: true, created_at: mins(145) },
        { id: "m7", sender_id: peerId, receiver_id: userId, content: "Pamiętaj też o oddaniu projektu do końca tygodnia.", read: true, created_at: mins(60) },
        { id: "m8", sender_id: userId, receiver_id: peerId, content: "Tak, kończę go już dzisiaj wieczorem.", read: true, created_at: mins(55) },
        { id: "m9", sender_id: peerId, receiver_id: userId, content: "Bardzo dobrze. Powodzenia jutro! 🍀", read: true, created_at: mins(10) },
        { id: "m10", sender_id: userId, receiver_id: peerId, content: "Dziękuję! Do zobaczenia na lekcji.", read: true, created_at: mins(5) },
      ] : [
        { id: "m1", sender_id: peerId, receiver_id: userId, content: "Cześć! Masz może notatki z dzisiejszej matematyki?", read: true, created_at: mins(120) },
        { id: "m2", sender_id: userId, receiver_id: peerId, content: "Cześć! Tak, zaraz Ci je wyślę.", read: true, created_at: mins(115) },
        { id: "m3", sender_id: peerId, receiver_id: userId, content: "Super, dzięki wielkie!", read: true, created_at: mins(110) },
        { id: "m4", sender_id: userId, receiver_id: peerId, content: "Idziesz jutro na korepetycje z fizyki?", read: true, created_at: mins(60) },
        { id: "m5", sender_id: peerId, receiver_id: userId, content: "Tak, o 16:00. Spotkamy się tam?", read: true, created_at: mins(55) },
        { id: "m6", sender_id: userId, receiver_id: peerId, content: "Jasne, do zobaczenia!", read: true, created_at: mins(10) },
      ];
      setMessages(demoMsgs);
      return;
    }

    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
    
    const { error } = await supabase.functions.invoke("mark-messages-read", {
      body: { sender_id: otherUserId },
    });
    if (!error) {
      onMessagesRead?.();
    }
  };

  const sendMessage = async () => {
    if (!msgText.trim() || !selectedUser) return;
    if (guestMode) {
      // Local-only message in guest mode
      const newMsg: Message = {
        id: `local-${Date.now()}`,
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: msgText.trim(),
        read: true,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setMsgText("");
      return;
    }
    const { data, error } = await supabase.from("messages").insert({ sender_id: userId, receiver_id: selectedUser.id, content: msgText.trim() }).select().single();
    if (error) { toast.error("Błąd wysyłania"); return; }
    if (data) setMessages(prev => [...prev, data as Message]);
    setMsgText("");
  };

  if (loading) return <div className="md-content" style={{ color: "#8899b4", textAlign: "center", padding: 40 }}>Ładowanie…</div>;

  return (
    <div className="md-content ts-layout">
      {/* User list */}
      <div className={`ts-user-list ${selectedUser ? "ts-hidden-mobile" : ""}`}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: "1rem", fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: ".78rem", color: "#8899b4" }}>{subtitle} · {users.length}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {users.map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", transition: ".15s",
              background: selectedUser?.id === u.id ? "rgba(59,130,246,0.1)" : "transparent",
              borderLeft: selectedUser?.id === u.id ? "3px solid #3b82f6" : "3px solid transparent",
            }}>
              <div
                style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", fontWeight: 900, flexShrink: 0, overflow: "hidden", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setViewingUserId(u.id); }}
                title="Zobacz profil"
              >
                {u.avatar_url ? <img src={u.avatar_url} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avInitials(u.name)}
              </div>
              <div>
                <div style={{ fontSize: ".88rem", fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: ".72rem", color: "#8899b4" }}>@{u.username}</div>
              </div>
              <span style={{
                marginLeft: "auto", fontSize: ".6rem", fontWeight: 800, padding: "2px 8px", borderRadius: 50,
                background: `${getRoleColor(u.role) || "#60a5fa"}20`,
                color: getRoleColor(u.role) || "#60a5fa",
              }}>
                {(() => { const label = getRoleLabel(u.role); return label.charAt(0).toLowerCase() + label.slice(1); })()}
              </span>
            </div>
          ))}
          {users.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#8899b4", fontSize: ".85rem" }}>
              <div>Brak {targetRole === "teacher" ? "nauczycieli" : "uczniów"}</div>
              {!guestMode && fallbackUsers && fallbackUsers.length > 0 && (
                <div style={{ marginTop: 12, textAlign: 'left', fontSize: '.88rem', color: '#c8d8f0' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Inne konta, do których możesz napisać:</div>
                  {fallbackUsers.map(u => (
                    <div key={u.id} onClick={() => setSelectedUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 900, overflow: 'hidden' }} onClick={(e) => { e.stopPropagation(); setViewingUserId(u.id); }} title="Zobacz profil">
                        {u.avatar_url ? <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avInitials(u.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '.88rem', fontWeight: 700 }}>{u.name}</div>
                        <div style={{ fontSize: '.72rem', color: '#8899b4' }}>@{u.username}</div>
                      </div>
                      <span style={{ marginLeft: 'auto', fontSize: '.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 50, background: `${getRoleColor(u.role) || '#60a5fa'}20`, color: getRoleColor(u.role) || '#60a5fa' }}>
                        {(() => { const label = getRoleLabel(u.role); return label.charAt(0).toLowerCase() + label.slice(1); })()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`ts-chat-area ${!selectedUser ? "ts-hidden-mobile" : ""}`}>
        {selectedUser ? (
          <>
            <div className="ts-back-btn" onClick={() => setSelectedUser(null)}>
              <ArrowLeft size={18} /> Wróć do listy
            </div>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", fontWeight: 900, overflow: "hidden" }}>
                {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} alt={selectedUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avInitials(selectedUser.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".92rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedUser.name}
                  {selectedUser.role === "admin" && (
                    <span style={{
                      fontSize: ".6rem", fontWeight: 800, padding: "2px 8px", borderRadius: 50,
                      background: "#f87171" + "20", color: "#f87171",
                    }}>
                      admin
                    </span>
                  )}
                </div>
                <div style={{ fontSize: ".72rem", color: "#8899b4" }}>@{selectedUser.username}</div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && <div style={{ textAlign: "center", color: "#8899b4", fontSize: ".85rem", margin: "auto" }}>Rozpocznij rozmowę z {selectedUser.name}</div>}
              {messages.map(m => {
                const isMine = m.sender_id === userId;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: 12, background: isMine ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(255,255,255,0.06)", color: isMine ? "#fff" : "#c8d8f0", fontSize: ".88rem", lineHeight: 1.5 }}>
                      {m.content}
                      <div style={{ fontSize: ".65rem", color: isMine ? "rgba(255,255,255,0.6)" : "#8899b4", marginTop: 4 }}>
                        {new Date(m.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10 }}>
              <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Napisz wiadomość..."
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: ".9rem", fontFamily: "inherit", outline: "none" }} />
              <button onClick={sendMessage} disabled={!msgText.trim()}
                style={{ background: msgText.trim() ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(59,130,246,0.3)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: ".88rem", cursor: msgText.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                Wyślij
              </button>
            </div>
          </>
        ) : (
          <div className="ts-empty-state">
            Wybierz {targetRole === "teacher" ? "nauczyciela" : "ucznia"} z listy, aby rozpocząć rozmowę
          </div>
        )}
      </div>

      {viewingUserId && (
        <UserProfileModal userId={viewingUserId} onClose={() => setViewingUserId(null)} />
      )}
    </div>
  );
};

export default TeacherStudentsTab;
