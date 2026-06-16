import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Send, Search, MoreVertical, Reply, Copy, Trash2, SmilePlus, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { useRoles } from "@/hooks/use-roles";
import UserProfileModal from "./UserProfileModal";
import { LoadingInline } from "@/components/ui/loading-state";

const REACTION_EMOJIS = ["❤️", "😄", "😮", "😢", "😠", "👍"] as const;


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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestMode, userId, selectedUser, onMessagesRead]);

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

  const sendMessage = async () => {
    if (!msgText.trim() || !selectedUser) return;

    if (guestMode) {
      const newMsg: Message = {
        id: `local-${Date.now()}`,
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: msgText.trim(),
        read: true,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMsg]);
      setMsgText("");
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: msgText.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Błąd wysyłania");
      return;
    }

    if (data) {
      setMessages((prev) => [...prev, data as Message]);
    }

    setMsgText("");
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
              {messages.map((m) => {
                const isMine = m.sender_id === userId;

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: isMine
                        ? "flex-end"
                        : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "72%",
                        padding: "12px 16px",
                        borderRadius: 20,
                        background: isMine
                          ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                          : "rgba(255,255,255,0.06)",
                        color: "#fff",
                        fontSize: ".88rem",
                        lineHeight: 1.5,
                        boxShadow:
                          "0 8px 24px rgba(0,0,0,0.2)",
                      }}
                    >
                      {m.content}

                      <div
                        style={{
                          fontSize: ".65rem",
                          opacity: 0.65,
                          marginTop: 6,
                        }}
                      >
                        {new Date(
                          m.created_at
                        ).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div
              style={{
                padding: 18,
                borderTop:
                  "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                gap: 12,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <input
                value={msgText}
                onChange={(e) =>
                  setMsgText(e.target.value)
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && sendMessage()
                }
                placeholder="Napisz wiadomość..."
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "14px 16px",
                  color: "#fff",
                  fontSize: ".92rem",
                  outline: "none",
                }}
              />

              <button
                onClick={sendMessage}
                disabled={!msgText.trim()}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  border: "none",
                  background: msgText.trim()
                    ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                    : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  cursor: msgText.trim()
                    ? "pointer"
                    : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: ".2s",
                }}
              >
                <Send size={18} />
              </button>
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