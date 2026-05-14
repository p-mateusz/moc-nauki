import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
}

const avColorStyles: Record<string, string> = {
  "av-c1": "linear-gradient(135deg,#3b82f6,#6366f1)",
  "av-c2": "linear-gradient(135deg,#a78bfa,#ec4899)",
  "av-c3": "linear-gradient(135deg,#34d399,#059669)",
  "av-c4": "linear-gradient(135deg,#f59e0b,#ef4444)",
  "av-c5": "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "av-c6": "linear-gradient(135deg,#f87171,#a78bfa)",
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
      // Demo friends
      const demoUsers: DBUser[] = [
        { id: "demo1", name: "Anna Kowalska", avatar_color: "av-c1", avatar_url: null },
        { id: "demo2", name: "Michał Wiśniewski", avatar_color: "av-c2", avatar_url: null },
        { id: "demo3", name: "Katarzyna Nowak", avatar_color: "av-c3", avatar_url: null },
        { id: "demo4", name: "Piotr Lewandowski", avatar_color: "av-c4", avatar_url: null },
        { id: "demo5", name: "Maria Szymankowska", avatar_color: "av-c5", avatar_url: null },
        { id: "demo6", name: "Tomasz Jankowski", avatar_color: "av-c6", avatar_url: null },
        { id: "demo7", name: "Ewa Malinowska", avatar_color: "av-c7", avatar_url: null },
        { id: "demo8", name: "Robert Kamiński", avatar_color: "av-c8", avatar_url: null },
        { id: "demo9", name: "Agnieszka Wojciechowska", avatar_color: "av-c9", avatar_url: null },
        { id: "demo10", name: "Andrzej Dombrowski", avatar_color: "av-c10", avatar_url: null },
      ];
      const demoFriendships: Friendship[] = demoUsers.slice(0, 5).map((u, i) => ({
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
      supabase.from("friendships").select("*").or(`requester_id.eq.${myId},addressee_id.eq.${myId}`),
      supabase.from("user_profiles").select("user_id, avatar_color, avatar_url"),
    ]);

    const users = (usersRes.data || []).map((u: any) => {
      const profile = (profilesRes.data || []).find((p: any) => p.user_id === u.id);
      return { ...u, avatar_color: profile?.avatar_color || "av-c1", avatar_url: profile?.avatar_url || null };
    });
    setAllUsers(users);
    setFriendships(friendsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [myId]);

  const otherUsers = allUsers.filter(u => u.id !== myId);

  const acceptedFriends = friendships
    .filter(f => f.status === "accepted")
    .map(f => f.requester_id === myId ? f.addressee_id : f.requester_id);

  const incomingRequests = friendships
    .filter(f => f.status === "pending" && f.addressee_id === myId)
    .map(f => f.requester_id);

  const sentRequests = friendships
    .filter(f => f.status === "pending" && f.requester_id === myId)
    .map(f => f.addressee_id);

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  const sendRequest = async (targetId: string) => {
    await supabase.from("friendships").insert({
      requester_id: myId, addressee_id: targetId, status: "pending",
    });
    fetchData();
  };

  const acceptReq = async (fromId: string) => {
    const f = friendships.find(fr => fr.requester_id === fromId && fr.addressee_id === myId && fr.status === "pending");
    if (f) { await supabase.from("friendships").update({ status: "accepted" }).eq("id", f.id); fetchData(); }
  };

  const declineReq = async (fromId: string) => {
    const f = friendships.find(fr => fr.requester_id === fromId && fr.addressee_id === myId && fr.status === "pending");
    if (f) { await supabase.from("friendships").delete().eq("id", f.id); fetchData(); }
  };

  const cancelReq = async (targetId: string) => {
    const f = friendships.find(fr => fr.requester_id === myId && fr.addressee_id === targetId && fr.status === "pending");
    if (f) { await supabase.from("friendships").delete().eq("id", f.id); fetchData(); }
  };

  const removeFriend = async (targetId: string) => {
    const f = friendships.find(fr =>
      fr.status === "accepted" &&
      ((fr.requester_id === myId && fr.addressee_id === targetId) ||
       (fr.addressee_id === myId && fr.requester_id === targetId))
    );
    if (f) { await supabase.from("friendships").delete().eq("id", f.id); fetchData(); }
  };

  let discoverList = otherUsers;
  if (searchQ) {
    const q = searchQ.toLowerCase();
    discoverList = discoverList.filter(u => u.name.toLowerCase().includes(q));
  }

  const getRelation = (uid: string) => {
    if (acceptedFriends.includes(uid)) return "friend";
    if (sentRequests.includes(uid)) return "sent";
    if (incomingRequests.includes(uid)) return "incoming";
    return "none";
  };

  const tabs: { key: FriendSubTab; label: string; badge?: number }[] = [
    { key: "friends", label: "Znajomi" },
    { key: "requests", label: "Zaproszenia", badge: incomingRequests.length },
    { key: "sent", label: "Wysłane" },
  ];

  const renderAvatar = (u: DBUser) => (
    <div
      className={`fr-av ${u.avatar_color || "av-c1"}`}
      style={{
        cursor: "pointer", overflow: "hidden",
        background: avColorStyles[u.avatar_color || "av-c1"],
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { e.stopPropagation(); setViewingUserId(u.id); }}
      title="Zobacz profil"
    >
      {u.avatar_url ? (
        <img src={u.avatar_url} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
      ) : avInitials(u.name)}
    </div>
  );

  const renderUserRow = (userId: string, type: "friend" | "incoming" | "sent") => {
    const u = getUserById(userId);
    if (!u) return null;
    return (
      <div className="friend-row" key={u.id}>
        {renderAvatar(u)}
        <div className="fr-info" style={{ cursor: "pointer" }} onClick={() => setViewingUserId(u.id)}>
          <div className="fr-name">{u.name}</div>
        </div>
        <div className="fr-actions">
          {type === "friend" && (
            <button className="btn btn-danger btn-sm" onClick={() => removeFriend(u.id)}>Usuń</button>
          )}
          {type === "incoming" && (
            <>
              <button className="btn btn-grad btn-sm" onClick={() => acceptReq(u.id)}
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                ✓ Akceptuj
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => declineReq(u.id)}>Odrzuć</button>
            </>
          )}
          {type === "sent" && (
            <>
              <button className="btn btn-pending btn-sm" style={{ cursor: "default" }}>⏳ Oczekuje</button>
              <button className="btn btn-ghost btn-sm" onClick={() => cancelReq(u.id)}>Wycofaj</button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (subTab === "friends") {
      if (!acceptedFriends.length) return <EmptyState icon="👥" title="Brak znajomych" sub="Wyszukaj użytkowników powyżej i wyślij zaproszenia." />;
      return acceptedFriends.map(id => renderUserRow(id, "friend"));
    }
    if (subTab === "requests") {
      if (!incomingRequests.length) return <EmptyState icon="📬" title="Brak zaproszeń" sub="Nowe zaproszenia pojawią się tutaj." />;
      return incomingRequests.map(id => renderUserRow(id, "incoming"));
    }
    if (subTab === "sent") {
      if (!sentRequests.length) return <EmptyState icon="📤" title="Brak wysłanych zaproszeń" sub="Zaproszenia wysłane przez Ciebie pojawią się tutaj." />;
      return sentRequests.map(id => renderUserRow(id, "sent"));
    }
    return null;
  };

  return (
    <div className="md-content">
      <div className="md-page-title">👥 Znajomi</div>
      <div className="md-page-sub">{acceptedFriends.length} znajomych</div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(14,24,48,0.9)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "10px 16px",
        }}>
          <span style={{ color: "#8899b4" }}>🔍</span>
          <input
            placeholder="Szukaj użytkowników po nazwie..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{
              flex: 1, background: "none", border: "none", color: "#fff",
              fontSize: ".95rem", outline: "none", fontFamily: "inherit"
            }}
          />
        </div>
      </div>

      {/* Discover grid */}
      {searchQ && (
        <div style={{ marginBottom: 24 }}>
          {discoverList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "#8899b4", fontSize: ".9rem" }}>
              Nie znaleziono użytkowników pasujących do „{searchQ}"
            </div>
          ) : (
            <div className="fr-discover-grid">
              {discoverList.map((u2) => {
                const rel = getRelation(u2.id);
                return (
                  <div key={u2.id} className="fr-discover-card">
                    <div
                      className={`pc-av ${u2.avatar_color || "av-c1"}`}
                      style={{
                        width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", fontWeight: 900, cursor: "pointer", overflow: "hidden",
                        background: avColorStyles[u2.avatar_color || "av-c1"],
                      }}
                      onClick={() => setViewingUserId(u2.id)}
                      title="Zobacz profil"
                    >
                      {u2.avatar_url ? (
                        <img src={u2.avatar_url} alt={u2.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : avInitials(u2.name)}
                    </div>
                    <div
                      style={{ fontSize: ".92rem", fontWeight: 800, marginBottom: 8, cursor: "pointer" }}
                      onClick={() => setViewingUserId(u2.id)}
                    >
                      {u2.name}
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {rel === "friend" ? (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 6 }}>✓ Znajomy</button>
                      ) : rel === "sent" ? (
                        <button className="btn btn-pending btn-sm" style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 6, cursor: "default" }}>⏳ Wysłano</button>
                      ) : rel === "incoming" ? (
                        <button
                          className="btn btn-grad btn-sm"
                          style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 6, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}
                          onClick={() => acceptReq(u2.id)}
                        >
                          ✓ Akceptuj
                        </button>
                      ) : (
                        <button
                          className="btn btn-grad btn-sm"
                          style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 6, background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}
                          onClick={() => sendRequest(u2.id)}
                        >
                          ＋ Dodaj
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 11, padding: 4, width: "fit-content"
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: "7px 18px", borderRadius: 8, cursor: "pointer", fontSize: ".84rem",
              color: subTab === t.key ? "#60a5fa" : "#8899b4",
              background: subTab === t.key ? "rgba(59,130,246,0.18)" : "none",
              border: "none", fontFamily: "inherit", transition: ".2s", fontWeight: 600
            }}
          >
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <span style={{
                background: "rgba(248,113,113,0.2)", color: "#f87171",
                fontSize: ".65rem", fontWeight: 800, padding: "1px 6px",
                borderRadius: 50, marginLeft: 4
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#8899b4" }}>Ładowanie...</div>
      ) : (
        renderContent()
      )}

      {viewingUserId && (
        <UserProfileModal userId={viewingUserId} onClose={() => setViewingUserId(null)} />
      )}
    </div>
  );
};

const EmptyState = ({ icon, title, sub }: { icon: string; title: string; sub: string }) => (
  <div className="md-empty-state">
    <div className="md-es-icon">{icon}</div>
    <p><b>{title}</b><br />{sub}</p>
  </div>
);

export default FriendsTab;
