import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Send, Search, MoreVertical, Reply, Copy, Trash2, SmilePlus, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { useRoles } from "@/hooks/use-roles";
import UserProfileModal from "./UserProfileModal";
import { LoadingInline } from "@/components/ui/loading-state";

const REACTION_EMOJIS = ["❤️", "😄", "😮", "😢", "😠", "👍"] as const;

const menuBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 12px", background: "transparent", border: "none",
  color: "#e2e8f0", cursor: "pointer", fontSize: ".8rem",
  borderRadius: 8, textAlign: "left",
};



function avInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

type UserInfo = {
  id: string;
  name: string;
  username: string;
  role: string;
  avatar_url?: string | null;
  avatar_color?: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  read: boolean;
  created_at: string;
  reply_to_id?: string | null;
  image_url?: string | null;
  deleted_for?: string[] | null;
  reactions?: Record<string, string[]> | null;
};


interface Props {
  mode: "teacher" | "student";
  onMessagesRead?: () => void;
  guestMode?: boolean;
}

const TeacherStudentsTab = ({
  mode,
  onMessagesRead,
  guestMode,
}: Props) => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);


  const userId = localStorage.getItem("userId") || "";
  const targetRole = mode;

  const title =
    mode === "teacher"
      ? "👨‍🏫 Nauczyciele"
      : "👨‍🎓 Uczniowie";

  const subtitle =
    mode === "teacher"
      ? "Lista wszystkich nauczycieli"
      : "Lista wszystkich uczniów";

  const { getRoleLabel, getRoleColor } = useRoles();

  useEffect(() => {
    loadUsers();
    loadUnreadCounts();
    setSelectedUser(null);
    setMessages([]);
  }, [mode]);

  useEffect(() => {
    if (guestMode || !userId) return;

    const refreshUnread = () => loadUnreadCounts();
    const channel = supabase
      .channel(`chat_user_unread_${mode}_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        refreshUnread
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        refreshUnread
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestMode, mode, userId]);

  useEffect(() => {
    if (selectedUser) loadMessages(selectedUser.id);
  }, [selectedUser]);

  // Realtime: append new messages from the currently open conversation
  useEffect(() => {
    if (guestMode || !userId || !selectedUser) return;
    const otherId = selectedUser.id;

    const channel = supabase
      .channel(`chat_thread_${userId}_${otherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id !== otherId) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          // mark as read immediately since the thread is open
          supabase.functions
            .invoke("mark-messages-read", { body: { sender_id: otherId } })
            .then(({ error }) => {
              if (!error) {
                setUnreadByUser((prev) => {
                  if (!prev[otherId]) return prev;
                  const next = { ...prev };
                  delete next[otherId];
                  return next;
                });
                onMessagesRead?.();
              }
            });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.receiver_id !== otherId) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const m = payload.new as Message;
          const involvesThread =
            (m.sender_id === userId && m.receiver_id === otherId) ||
            (m.sender_id === otherId && m.receiver_id === userId);
          if (!involvesThread) return;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        }
      )
      .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestMode, userId, selectedUser, onMessagesRead]);

  useEffect(() => {
    const close = () => { setOpenMenuId(null); setReactionPickerId(null); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);


  useEffect(() => {
    // Scroll only inside the messages container, not the whole document — otherwise
    // on mobile the chat header gets pushed above the viewport.
    const end = messagesEndRef.current;
    if (!end) return;
    const scroller = end.closest(".ts-messages-scroll") as HTMLElement | null;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    } else {
      end.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages]);

  const loadUsers = async () => {
    if (guestMode) {
      const demoUsers: UserInfo[] =
        mode === "teacher"
          ? [
              {
                id: "demo-t1",
                name: "Anna Kowalska",
                username: "a.kowalska",
                role: "nauczyciel",
              },
              {
                id: "demo-t2",
                name: "Piotr Nowak",
                username: "p.nowak",
                role: "nauczyciel",
              },
              {
                id: "demo-t3",
                name: "Magdalena Wiśniewska",
                username: "m.wisniewska",
                role: "nauczyciel",
              },
            ]
          : [
              {
                id: "demo-s1",
                name: "Jan Kowalski",
                username: "j.kowalski",
                role: "uczeń",
              },
              {
                id: "demo-s2",
                name: "Aleksandra Nowak",
                username: "a.nowak",
                role: "uczeń",
              },
              {
                id: "demo-s3",
                name: "Michał Wiśniewski",
                username: "m.wisniewski",
                role: "uczeń",
              },
            ];

      setUsers(demoUsers);
      setSelectedUser(demoUsers[0]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke(
      "list-chat-users",
      {
        body: { mode },
      }
    );

    if (error || data?.error) {
      console.error(error || data?.error);
      setUsers([]);
      setLoading(false);
      return;
    }

    const mapped: UserInfo[] = ((data?.users || []) as UserInfo[]).filter(
      (u) => u.id !== userId
    );

    setUsers(mapped);
    setLoading(false);
  };

  const loadUnreadCounts = async () => {
    if (guestMode || !userId) {
      setUnreadByUser({});
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("receiver_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Unable to load per-user unread message counts:", error);
      return;
    }

    const nextCounts = ((data || []) as Pick<Message, "sender_id">[]).reduce<Record<string, number>>(
      (acc, message) => {
        if (message.sender_id) acc[message.sender_id] = (acc[message.sender_id] || 0) + 1;
        return acc;
      },
      {}
    );

    setUnreadByUser(nextCounts);
  };

  const loadMessages = async (otherUserId: string) => {
    if (guestMode) {
      const demoMsgs: Message[] = [
        {
          id: "1",
          sender_id: otherUserId,
          receiver_id: userId,
          content: "Cześć 👋",
          read: true,
          created_at: new Date().toISOString(),
        },
      ];

      setMessages(demoMsgs);
      return;
    }

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true });

    if (data) setMessages(data as Message[]);

    const { error } = await supabase.functions.invoke(
      "mark-messages-read",
      {
        body: { sender_id: otherUserId },
      }
    );

    if (!error) {
      setUnreadByUser((prev) => {
        if (!prev[otherUserId]) return prev;
        const next = { ...prev };
        delete next[otherUserId];
        return next;
      });
      onMessagesRead?.();
    }
  };

  const sendMessage = async (overrides?: { content?: string; imageUrl?: string | null }) => {
    if (!selectedUser) return;
    const content = (overrides?.content ?? msgText).trim();
    const imageUrl = overrides?.imageUrl ?? null;
    if (!content && !imageUrl) return;

    if (guestMode) {
      const newMsg: Message = {
        id: `local-${Date.now()}`,
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: content || null,
        read: true,
        created_at: new Date().toISOString(),
        reply_to_id: replyTo?.id ?? null,
        image_url: imageUrl,
        reactions: {},
        deleted_for: [],
      };
      setMessages((prev) => [...prev, newMsg]);
      if (!overrides) setMsgText("");
      setReplyTo(null);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: content || null,
        reply_to_id: replyTo?.id ?? null,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (error) {
      toast.error("Błąd wysyłania");
      return;
    }

    if (data) {
      setMessages((prev) => (prev.some((x) => x.id === (data as Message).id) ? prev : [...prev, data as Message]));
    }

    if (!overrides) setMsgText("");
    setReplyTo(null);
  };

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedUser) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Maks. 8 MB");
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
      await sendMessage({ content: msgText, imageUrl: pub.publicUrl });
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się wysłać zdjęcia");
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleReaction = async (m: Message, emoji: string) => {
    setReactionPickerId(null);
    setOpenMenuId(null);
    const current = { ...(m.reactions || {}) } as Record<string, string[]>;
    const list = current[emoji] ? [...current[emoji]] : [];
    const idx = list.indexOf(userId);
    if (idx >= 0) list.splice(idx, 1); else list.push(userId);
    if (list.length === 0) delete current[emoji]; else current[emoji] = list;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: current } : x)));
    if (guestMode) return;
    const { error } = await (supabase.from("messages") as any).update({ reactions: current }).eq("id", m.id);
    if (error) toast.error("Nie udało się dodać reakcji");
  };

  const deleteForMe = async (m: Message) => {
    setOpenMenuId(null);
    const current = Array.from(new Set([...(m.deleted_for || []), userId]));
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_for: current } : x)));
    if (guestMode) return;
    const { error } = await (supabase.from("messages") as any).update({ deleted_for: current }).eq("id", m.id);
    if (error) toast.error("Nie udało się usunąć");
  };

  const copyMessage = async (m: Message) => {
    setOpenMenuId(null);
    try {
      await navigator.clipboard.writeText(m.content || m.image_url || "");
      toast.success("Skopiowano");
    } catch {
      toast.error("Nie udało się skopiować");
    }
  };

  const startReply = (m: Message) => {
    setOpenMenuId(null);
    setReplyTo(m);
  };



  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="md-content"><LoadingInline minHeight={240} /></div>;
  }

  return (
    <div
      className="md-content ts-layout"
      style={{
        display: "flex",
        gap: 18,
        height: "calc(100vh - 120px)",
      }}
    >
      {/* LISTA */}
      <div
        className={`ts-user-list ${
          selectedUser ? "ts-hidden-mobile" : ""
        }`}
        style={{
          width: 340,
          borderRadius: 28,
          overflow: "hidden",
          background: "rgba(15,23,42,0.72)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "22px 22px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 900,
              marginBottom: 4,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: ".78rem",
              color: "#94a3b8",
              marginBottom: 18,
            }}
          >
            {subtitle} · {users.length}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: "10px 14px",
            }}
          >
            <Search size={16} color="#94a3b8" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                width: "100%",
                fontSize: ".88rem",
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
          }}
        >
          {filteredUsers.map((u) => {
            const unreadCount = unreadByUser[u.id] || 0;
            return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px",
                borderRadius: 18,
                marginBottom: 10,
                cursor: "pointer",
                transition: ".2s",
                background:
                  selectedUser?.id === u.id
                    ? "rgba(59,130,246,0.16)"
                    : "rgba(255,255,255,0.03)",
                border:
                  selectedUser?.id === u.id
                    ? "1px solid rgba(59,130,246,0.35)"
                    : "1px solid rgba(255,255,255,0.04)",
                }}
              >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingUserId(u.id);
                }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg,#3b82f6,#6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  color: "#fff",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  avInitials(u.name)
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: ".9rem",
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {u.name}
                </div>

                <div
                  style={{
                    fontSize: ".72rem",
                    color: "#94a3b8",
                  }}
                >
                  @{u.username}
                </div>
              </div>

                <div className="ts-user-meta-actions">
                  {unreadCount > 0 && (
                    <span className="ts-user-unread-badge" aria-label={`${unreadCount} nieprzeczytanych wiadomości`}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: ".62rem",
                      fontWeight: 800,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: `${
                        getRoleColor(u.role) || "#60a5fa"
                      }20`,
                      color:
                        getRoleColor(u.role) || "#60a5fa",
                    }}
                  >
                    {getRoleLabel(u.role)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT */}
      <div
        className={`ts-chat-area ${
          !selectedUser ? "ts-hidden-mobile" : ""
        }`}
        style={{
          flex: 1,
          borderRadius: 30,
          overflow: "hidden",
          background: "rgba(15,23,42,0.72)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {selectedUser ? (
          <>
            <div
              className="ts-back-btn"
              onClick={() => setSelectedUser(null)}
              style={{
                display: "none",
              }}
            >
              <ArrowLeft size={18} />
            </div>

            {/* HEADER */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom:
                  "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg,#3b82f6,#6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  fontWeight: 900,
                }}
              >
                {selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  avInitials(selectedUser.name)
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: ".95rem",
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {selectedUser.name}
                </div>

                <div
                  style={{
                    fontSize: ".72rem",
                    color: "#94a3b8",
                  }}
                >
                  @{selectedUser.username}
                </div>
              </div>
            </div>

            {/* WIADOMOŚCI */}
            <div
              className="ts-messages-scroll"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background:
                  "radial-gradient(circle at top, rgba(59,130,246,0.06), transparent 30%)",
              }}
            >
              {messages.filter((m) => !(m.deleted_for || []).includes(userId)).map((m) => {
                const isMine = m.sender_id === userId;
                const replied = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                const reactions = m.reactions || {};
                const reactionEntries = Object.entries(reactions).filter(([, arr]) => (arr as string[]).length > 0);
                const menuOpen = openMenuId === m.id;
                const pickerOpen = reactionPickerId === m.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: isMine ? "flex-end" : "flex-start",
                      position: "relative",
                    }}
                  >
                    <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexDirection: isMine ? "row-reverse" : "row" }}>
                        <div
                          style={{
                            padding: m.image_url && !m.content ? 6 : "10px 14px",
                            borderRadius: 20,
                            background: isMine
                              ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                              : "rgba(255,255,255,0.06)",
                            color: "#fff",
                            fontSize: ".88rem",
                            lineHeight: 1.5,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                            position: "relative",
                          }}
                        >
                          {replied && (
                            <div style={{
                              borderLeft: "3px solid rgba(255,255,255,0.5)",
                              padding: "4px 8px",
                              marginBottom: 6,
                              background: "rgba(0,0,0,0.18)",
                              borderRadius: 8,
                              fontSize: ".72rem",
                              opacity: 0.85,
                              maxWidth: 260,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              ↩ {replied.image_url && !replied.content ? "📷 Zdjęcie" : replied.content}
                            </div>
                          )}
                          {m.image_url && (
                            <img
                              src={m.image_url}
                              alt="załącznik"
                              onClick={() => window.open(m.image_url!, "_blank")}
                              style={{
                                maxWidth: 280, maxHeight: 280, borderRadius: 14,
                                display: "block", cursor: "zoom-in",
                                marginBottom: m.content ? 8 : 0,
                              }}
                            />
                          )}
                          {m.content && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>}
                          <div style={{ fontSize: ".62rem", opacity: 0.65, marginTop: 6, textAlign: isMine ? "right" : "left" }}>
                            {new Date(m.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>

                        {/* 3-dots menu trigger */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : m.id); setReactionPickerId(null); }}
                          aria-label="Akcje wiadomości"
                          style={{
                            background: "rgba(255,255,255,0.05)", border: "none",
                            width: 28, height: 28, borderRadius: "50%",
                            color: "#cbd5e1", cursor: "pointer", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            alignSelf: "center", opacity: menuOpen || pickerOpen ? 1 : 0.55,
                          }}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>

                      {/* Reaction chips */}
                      {reactionEntries.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {reactionEntries.map(([emoji, users]) => {
                            const mine = (users as string[]).includes(userId);
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m, emoji)}
                                style={{
                                  background: mine ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)",
                                  border: mine ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 999, padding: "2px 8px",
                                  fontSize: ".75rem", color: "#fff", cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 4,
                                }}
                              >
                                <span>{emoji}</span>
                                <span style={{ fontSize: ".7rem", opacity: 0.8 }}>{(users as string[]).length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Action menu */}
                      {menuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 14, padding: 6, display: "flex", flexDirection: "column",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.4)", minWidth: 180, zIndex: 50,
                          }}
                        >
                          <button onClick={() => { setReactionPickerId(m.id); setOpenMenuId(null); }} style={menuBtn}>
                            <SmilePlus size={14} /> Zareaguj
                          </button>
                          <button onClick={() => startReply(m)} style={menuBtn}>
                            <Reply size={14} /> Odpowiedz
                          </button>
                          <button onClick={() => copyMessage(m)} style={menuBtn}>
                            <Copy size={14} /> Kopiuj
                          </button>
                          <button onClick={() => deleteForMe(m)} style={{ ...menuBtn, color: "#f87171" }}>
                            <Trash2 size={14} /> Usuń u mnie
                          </button>
                        </div>
                      )}

                      {/* Reaction picker */}
                      {pickerOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 999, padding: "6px 10px", display: "flex", gap: 6,
                            boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 50,
                          }}
                        >
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(m, emoji)}
                              style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                fontSize: "1.3rem", padding: 2, lineHeight: 1,
                              }}
                            >{emoji}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}


              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              {replyTo && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: "rgba(99,102,241,0.08)",
                }}>
                  <div style={{ width: 3, alignSelf: "stretch", background: "#6366f1", borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: ".68rem", color: "#a5b4fc", fontWeight: 700 }}>
                      Odpowiadasz {replyTo.sender_id === userId ? "sobie" : selectedUser.name}
                    </div>
                    <div style={{
                      fontSize: ".78rem", color: "#cbd5e1",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {replyTo.image_url && !replyTo.content ? "📷 Zdjęcie" : replyTo.content}
                    </div>
                  </div>
                  <button onClick={() => setReplyTo(null)} style={{
                    background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4,
                  }}><X size={16} /></button>
                </div>
              )}
              <div style={{ padding: 18, display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onImageSelected}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage || guestMode}
                  title="Załącz zdjęcie"
                  style={{
                    width: 44, height: 44, borderRadius: 14, border: "none",
                    background: "rgba(255,255,255,0.06)", color: "#fff",
                    cursor: uploadingImage ? "wait" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  {uploadingImage ? <ImageIcon size={18} /> : <Paperclip size={18} />}
                </button>
                <input
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendMessage(); } }}
                  placeholder="Napisz wiadomość..."
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
                    padding: "14px 16px", color: "#fff", fontSize: ".92rem", outline: "none",
                  }}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!msgText.trim()}
                  style={{
                    width: 54, height: 54, borderRadius: 18, border: "none",
                    background: msgText.trim() ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(255,255,255,0.08)",
                    color: "#fff", cursor: msgText.trim() ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: ".2s", flexShrink: 0,
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>

        ) : (
          <div
            className="ts-empty-state"
            style={{
              margin: "auto",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: ".95rem",
              padding: 30,
            }}
          >
            Wybierz{" "}
            {targetRole === "teacher"
              ? "nauczyciela"
              : "ucznia"}{" "}
            z listy
          </div>
        )}
      </div>

      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </div>
  );
};

export default TeacherStudentsTab;