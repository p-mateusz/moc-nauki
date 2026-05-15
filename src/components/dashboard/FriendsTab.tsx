import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import UserProfileModal from "./UserProfileModal";

type FriendSubTab = "friends" | "requests" | "sent";

interface DBUser {
  id: string;
  name: string;
  avatar_color?: string;
  avatar_url?: string | null;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

function avInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

const avColorStyles: Record<string, string> = {
  "av-c1": "linear-gradient(135deg,#3b82f6,#6366f1)",
  "av-c2": "linear-gradient(135deg,#a78bfa,#ec4899)",
  "av-c3": "linear-gradient(135deg,#34d399,#059669)",
  "av-c4": "linear-gradient(135deg,#f59e0b,#ef4444)",
  "av-c5": "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "av-c6": "linear-gradient(135deg,#f87171,#a78bfa)",
  "av-c7": "linear-gradient(135deg,#14b8a6,#06b6d4)",
  "av-c8": "linear-gradient(135deg,#8b5cf6,#6366f1)",
  "av-c9": "linear-gradient(135deg,#ec4899,#f43f5e)",
  "av-c10": "linear-gradient(135deg,#22c55e,#16a34a)",
};

const FriendsTab = ({ guestMode }: { guestMode?: boolean }) => {
  const [subTab, setSubTab] = useState<FriendSubTab>("friends");
  const [searchQ, setSearchQ] = useState("");
  const [allUsers, setAllUsers] = useState<DBUser[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const myId = localStorage.getItem("userId") || "";

  const fetchData = async () => {
    if (guestMode) {
      const demoUsers: DBUser[] = [
        { id: "demo1", name: "Anna Kowalska", avatar_color: "av-c1" },
        { id: "demo2", name: "Michał Wiśniewski", avatar_color: "av-c2" },
        { id: "demo3", name: "Katarzyna Nowak", avatar_color: "av-c3" },
        { id: "demo4", name: "Piotr Lewandowski", avatar_color: "av-c4" },
        { id: "demo5", name: "Maria Szymankowska", avatar_color: "av-c5" },
      ];

      const demoFriendships: Friendship[] = demoUsers.map((u, i) => ({
        id: `friend${i}`,
        requester_id: "guest",
        addressee_id: u.id,
        status: "accepted",
      }));

      setAllUsers(demoUsers);
      setFriendships(demoFriendships);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [usersRes, friendsRes, profilesRes] = await Promise.all([
      supabase.from("users").select("id, name"),
      supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`),
      supabase
        .from("user_profiles")
        .select("user_id, avatar_color, avatar_url"),
    ]);

    const users = (usersRes.data || []).map((u: any) => {
      const profile = (profilesRes.data || []).find(
        (p: any) => p.user_id === u.id
      );

      return {
        ...u,
        avatar_color: profile?.avatar_color || "av-c1",
        avatar_url: profile?.avatar_url || null,
      };
    });

    setAllUsers(users);
    setFriendships(friendsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [myId]);

  const otherUsers = allUsers.filter((u) => u.id !== myId);

  const acceptedFriends = friendships
    .filter((f) => f.status === "accepted")
    .map((f) =>
      f.requester_id === myId ? f.addressee_id : f.requester_id
    );

  const incomingRequests = friendships
    .filter(
      (f) => f.status === "pending" && f.addressee_id === myId
    )
    .map((f) => f.requester_id);

  const sentRequests = friendships
    .filter(
      (f) => f.status === "pending" && f.requester_id === myId
    )
    .map((f) => f.addressee_id);

  const getUserById = (id: string) =>
    allUsers.find((u) => u.id === id);

  const sendRequest = async (targetId: string) => {
    await supabase.from("friendships").insert({
      requester_id: myId,
      addressee_id: targetId,
      status: "pending",
    });

    fetchData();
  };

  const acceptReq = async (fromId: string) => {
    const f = friendships.find(
      (fr) =>
        fr.requester_id === fromId &&
        fr.addressee_id === myId &&
        fr.status === "pending"
    );

    if (f) {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", f.id);

      fetchData();
    }
  };

  const declineReq = async (fromId: string) => {
    const f = friendships.find(
      (fr) =>
        fr.requester_id === fromId &&
        fr.addressee_id === myId &&
        fr.status === "pending"
    );

    if (f) {
      await supabase.from("friendships").delete().eq("id", f.id);
      fetchData();
    }
  };

  const cancelReq = async (targetId: string) => {
    const f = friendships.find(
      (fr) =>
        fr.requester_id === myId &&
        fr.addressee_id === targetId &&
        fr.status === "pending"
    );

    if (f) {
      await supabase.from("friendships").delete().eq("id", f.id);
      fetchData();
    }
  };

  const removeFriend = async (targetId: string) => {
    const f = friendships.find(
      (fr) =>
        fr.status === "accepted" &&
        ((fr.requester_id === myId &&
          fr.addressee_id === targetId) ||
          (fr.addressee_id === myId &&
            fr.requester_id === targetId))
    );

    if (f) {
      await supabase.from("friendships").delete().eq("id", f.id);
      fetchData();
    }
  };

  let discoverList = otherUsers;

  if (searchQ) {
    const q = searchQ.toLowerCase();

    discoverList = discoverList.filter((u) =>
      u.name.toLowerCase().includes(q)
    );
  }

  const getRelation = (uid: string) => {
    if (acceptedFriends.includes(uid)) return "friend";
    if (sentRequests.includes(uid)) return "sent";
    if (incomingRequests.includes(uid)) return "incoming";
    return "none";
  };

  const tabs: {
    key: FriendSubTab;
    label: string;
    badge?: number;
  }[] = [
    { key: "friends", label: "Znajomi" },
    {
      key: "requests",
      label: "Zaproszenia",
      badge: incomingRequests.length,
    },
    { key: "sent", label: "Wysłane" },
  ];

  const renderAvatar = (u: DBUser) => (
    <div
      className={`fr-av ${u.avatar_color || "av-c1"}`}
      style={{
        width: 58,
        height: 58,
        borderRadius: "50%",
        overflow: "hidden",
        background: avColorStyles[u.avatar_color || "av-c1"],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: "1rem",
        color: "#fff",
        flexShrink: 0,
        boxShadow: "0 8px 20px rgba(0,0,0,.35)",
        border: "2px solid rgba(255,255,255,.08)",
        cursor: "pointer",
        transition: ".22s",
      }}
      onClick={(e) => {
        e.stopPropagation();
        setViewingUserId(u.id);
      }}
      title="Zobacz profil"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
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
  );

  const renderUserRow = (
    userId: string,
    type: "friend" | "incoming" | "sent"
  ) => {
    const u = getUserById(userId);

    if (!u) return null;

    return (
      <div
        className="friend-row"
        key={u.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
          marginBottom: 12,
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(17,24,39,.95), rgba(15,23,42,.92))",
          border: "1px solid rgba(255,255,255,.06)",
          boxShadow: "0 10px 30px rgba(0,0,0,.28)",
          backdropFilter: "blur(12px)",
          transition: ".22s",
        }}
      >
        {renderAvatar(u)}

        <div
          className="fr-info"
          style={{
            flex: 1,
            minWidth: 0,
            cursor: "pointer",
          }}
          onClick={() => setViewingUserId(u.id)}
        >
          <div
            className="fr-name"
            style={{
              fontWeight: 800,
              fontSize: ".98rem",
              color: "#fff",
              marginBottom: 4,
            }}
          >
            {u.name}
          </div>

          <div
            style={{
              color: "#8899b4",
              fontSize: ".78rem",
            }}
          >
            {type === "friend" && "Znajomy"}
            {type === "incoming" && "Wysłał Ci zaproszenie"}
            {type === "sent" && "Oczekuje na akceptację"}
          </div>
        </div>

        <div
          className="fr-actions"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {type === "friend" && (
            <button
              onClick={() => removeFriend(u.id)}
              style={dangerBtn}
            >
              Usuń
            </button>
          )}

          {type === "incoming" && (
            <>
              <button
                onClick={() => acceptReq(u.id)}
                style={primaryBtn}
              >
                ✓ Akceptuj
              </button>

              <button
                onClick={() => declineReq(u.id)}
                style={ghostBtn}
              >
                Odrzuć
              </button>
            </>
          )}

          {type === "sent" && (
            <>
              <button style={pendingBtn}>
                ⏳ Oczekuje
              </button>

              <button
                onClick={() => cancelReq(u.id)}
                style={ghostBtn}
              >
                Wycofaj
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (subTab === "friends") {
      if (!acceptedFriends.length) {
        return (
          <EmptyState
            icon="👥"
            title="Brak znajomych"
            sub="Wyszukaj użytkowników powyżej i wyślij zaproszenia."
          />
        );
      }

      return acceptedFriends.map((id) =>
        renderUserRow(id, "friend")
      );
    }

    if (subTab === "requests") {
      if (!incomingRequests.length) {
        return (
          <EmptyState
            icon="📬"
            title="Brak zaproszeń"
            sub="Nowe zaproszenia pojawią się tutaj."
          />
        );
      }

      return incomingRequests.map((id) =>
        renderUserRow(id, "incoming")
      );
    }

    if (subTab === "sent") {
      if (!sentRequests.length) {
        return (
          <EmptyState
            icon="📤"
            title="Brak wysłanych"
            sub="Zaproszenia wysłane przez Ciebie pojawią się tutaj."
          />
        );
      }

      return sentRequests.map((id) =>
        renderUserRow(id, "sent")
      );
    }

    return null;
  };

  return (
    <div className="md-content">
      <div
        style={{
          marginBottom: 24,
        }}
      >
        <div
          className="md-page-title"
          style={{
            fontSize: "2rem",
            fontWeight: 900,
            marginBottom: 6,
            background:
              "linear-gradient(135deg,#fff,#93c5fd)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          👥 Znajomi
        </div>

        <div
          className="md-page-sub"
          style={{
            color: "#94a3b8",
            fontSize: ".95rem",
          }}
        >
          {acceptedFriends.length} znajomych
        </div>
      </div>

      {/* SEARCH */}

      <div
        style={{
          position: "relative",
          marginBottom: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background:
              "linear-gradient(135deg, rgba(15,23,42,.96), rgba(17,24,39,.92))",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 18,
            padding: "14px 18px",
            boxShadow: "0 10px 30px rgba(0,0,0,.22)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span
            style={{
              color: "#60a5fa",
              fontSize: "1rem",
            }}
          >
            🔍
          </span>

          <input
            placeholder="Szukaj użytkowników..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: ".96rem",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* SEARCH RESULTS */}

      {searchQ && (
        <div
          className="fr-discover-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(180px,1fr))",
            gap: 16,
            marginBottom: 30,
          }}
        >
          {discoverList.map((u2) => {
            const rel = getRelation(u2.id);

            return (
              <div
                key={u2.id}
                style={{
                  padding: 18,
                  borderRadius: 22,
                  background:
                    "linear-gradient(135deg, rgba(17,24,39,.98), rgba(15,23,42,.94))",
                  border: "1px solid rgba(255,255,255,.06)",
                  textAlign: "center",
                  boxShadow: "0 14px 30px rgba(0,0,0,.25)",
                  transition: ".22s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {renderAvatar(u2)}
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    fontSize: ".92rem",
                    color: "#fff",
                    marginBottom: 14,
                    cursor: "pointer",
                  }}
                  onClick={() => setViewingUserId(u2.id)}
                >
                  {u2.name}
                </div>

                {rel === "friend" ? (
                  <button style={ghostBtn}>
                    ✓ Znajomy
                  </button>
                ) : rel === "sent" ? (
                  <button style={pendingBtn}>
                    ⏳ Wysłano
                  </button>
                ) : rel === "incoming" ? (
                  <button
                    style={greenBtn}
                    onClick={() => acceptReq(u2.id)}
                  >
                    ✓ Akceptuj
                  </button>
                ) : (
                  <button
                    style={primaryBtn}
                    onClick={() => sendRequest(u2.id)}
                  >
                    ＋ Dodaj
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TABS */}

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 22,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: "10px 18px",
              borderRadius: 14,
              border:
                subTab === t.key
                  ? "1px solid rgba(96,165,250,.35)"
                  : "1px solid rgba(255,255,255,.05)",
              background:
                subTab === t.key
                  ? "linear-gradient(135deg, rgba(59,130,246,.22), rgba(99,102,241,.14))"
                  : "rgba(255,255,255,.03)",
              color:
                subTab === t.key ? "#dbeafe" : "#94a3b8",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: ".82rem",
              transition: ".2s",
              backdropFilter: "blur(10px)",
            }}
          >
            {t.label}

            {(t.badge ?? 0) > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: "rgba(248,113,113,.18)",
                  color: "#f87171",
                  borderRadius: 999,
                  padding: "2px 7px",
                  fontSize: ".68rem",
                  fontWeight: 900,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#94a3b8",
          }}
        >
          Ładowanie...
        </div>
      ) : (
        renderContent()
      )}

      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </div>
  );
};

const primaryBtn: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#3b82f6,#6366f1)",
  border: "none",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: ".76rem",
  boxShadow: "0 8px 18px rgba(59,130,246,.28)",
};

const greenBtn: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#22c55e,#16a34a)",
  border: "none",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: ".76rem",
};

const ghostBtn: React.CSSProperties = {
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.08)",
  color: "#cbd5e1",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: ".76rem",
};

const pendingBtn: React.CSSProperties = {
  background: "rgba(251,191,36,.12)",
  border: "1px solid rgba(251,191,36,.18)",
  color: "#fbbf24",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "default",
  fontWeight: 800,
  fontSize: ".76rem",
};

const dangerBtn: React.CSSProperties = {
  background: "rgba(239,68,68,.12)",
  border: "1px solid rgba(239,68,68,.18)",
  color: "#f87171",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: ".76rem",
};

const EmptyState = ({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) => (
  <div
    className="md-empty-state"
    style={{
      textAlign: "center",
      padding: "60px 20px",
      background:
        "linear-gradient(135deg, rgba(15,23,42,.85), rgba(17,24,39,.82))",
      border: "1px solid rgba(255,255,255,.05)",
      borderRadius: 24,
      color: "#94a3b8",
      boxShadow: "0 14px 30px rgba(0,0,0,.22)",
    }}
  >
    <div
      style={{
        fontSize: "2.8rem",
        marginBottom: 14,
      }}
    >
      {icon}
    </div>

    <p
      style={{
        margin: 0,
        lineHeight: 1.7,
      }}
    >
      <b
        style={{
          color: "#fff",
          fontSize: "1rem",
        }}
      >
        {title}
      </b>

      <br />

      <span
        style={{
          color: "#8899b4",
          fontSize: ".9rem",
        }}
      >
        {sub}
      </span>
    </p>
  </div>
);

export default FriendsTab;