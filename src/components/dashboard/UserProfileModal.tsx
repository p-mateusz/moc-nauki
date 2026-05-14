import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";

const bannerColors: Record<string, string> = {
  "banner-c1": "linear-gradient(135deg,#1e3a8a,#312e81,#4c1d95)",
  "banner-c2": "linear-gradient(135deg,#064e3b,#065f46,#1e3a8a)",
  "banner-c3": "linear-gradient(135deg,#7f1d1d,#831843,#4c1d95)",
  "banner-c4": "linear-gradient(135deg,#0c4a6e,#164e63,#065f46)",
  "banner-c5": "linear-gradient(135deg,#1e1b4b,#312e81,#1e3a8a)",
  "banner-c6": "linear-gradient(135deg,#4a1942,#2d1b69,#1e3a8a)",
  "banner-c7": "linear-gradient(135deg,#1a2f1a,#2d4a2d,#1e3a5a)",
  "banner-c8": "linear-gradient(135deg,#3d1f00,#5c3d1a,#2d1b69)",
};

const avColorStyles: Record<string, string> = {
  "av-c1": "linear-gradient(135deg,#3b82f6,#6366f1)",
  "av-c2": "linear-gradient(135deg,#a78bfa,#ec4899)",
  "av-c3": "linear-gradient(135deg,#34d399,#059669)",
  "av-c4": "linear-gradient(135deg,#f59e0b,#ef4444)",
  "av-c5": "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "av-c6": "linear-gradient(135deg,#f87171,#a78bfa)",
};

function avInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function isoAddDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function calcStreak(days: string[]) {
  if (!days?.length) return { current: 0, best: 0, total: 0 };
  const sorted = [...new Set(days)].sort();
  let current = 0, best = 0, streak = 1;
  const today = todayISO();
  const yesterday = isoAddDays(today, -1);
  const lastDay = sorted[sorted.length - 1];
  if (lastDay === today || lastDay === yesterday) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (isoAddDays(sorted[i + 1], -1) === sorted[i]) current++;
      else break;
    }
  }
  streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (isoAddDays(sorted[i], -1) === sorted[i - 1]) streak++;
    else streak = 1;
    if (streak > best) best = streak;
  }
  if (current > best) best = current;
  if (best === 0 && sorted.length) best = 1;
  return { current, best, total: sorted.length };
}

function buildHeatmapCells(days: string[]) {
  const set = new Set(days || []);
  const today = new Date();
  const cells: { iso: string; active: boolean; isToday: boolean; future: boolean }[] = [];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 104);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - ((dow + 6) % 7));
  for (let i = 0; i < 105; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    cells.push({ iso, active: set.has(iso), isToday: iso === todayISO(), future: d > today });
  }
  return cells;
}

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
}

const UserProfileModal = ({ userId, onClose }: UserProfileModalProps) => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [profile, setProfile] = useState<{
    bio: string; location: string; interests: string[];
    avatar_color: string; banner_color: string; avatar_url: string | null;
  }>({ bio: "", location: "", interests: [], avatar_color: "av-c1", banner_color: "banner-c1", avatar_url: null });
  const [friendCount, setFriendCount] = useState(0);
  const [userRole, setUserRole] = useState("uczeń");
  const [activityDays, setActivityDays] = useState<string[]>([]);
  const [userJoinDate, setUserJoinDate] = useState<string | null>(null);
  const { roles: availableRoles, getRoleLabel, getRoleColor } = useRoles();
  const roleInfo = availableRoles.find(r => r.name === userRole);
  const labelText = roleInfo?.label || userRole;
  const roleBadge = {
    label: labelText.charAt(0).toLowerCase() + labelText.slice(1),
    bg: roleInfo?.color || (userRole === "teacher" ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#3b82f6,#6366f1)"),
    color: roleInfo?.color?.startsWith("linear-gradient") ? "#fff" : "#fff"
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    setLoading(true);
    const [userRes, profileRes, friendsRes, accountRes, activityRes] = await Promise.all([
      supabase.from("users").select("name").eq("id", userId).maybeSingle(),
      supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("friendships").select("id").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq("status", "accepted"),
      supabase.from("user_accounts_public").select("role").eq("id", userId).maybeSingle(),
      supabase.from("activity_days").select("date").eq("user_id", userId),
    ]);
    
    setUserName(userRes.data?.name || "Użytkownik");
    if (profileRes.data) {
      setProfile({
        bio: profileRes.data.bio || "",
        location: profileRes.data.location || "",
        interests: profileRes.data.interests || [],
        avatar_color: profileRes.data.avatar_color || "av-c1",
        banner_color: profileRes.data.banner_color || "banner-c1",
        avatar_url: (profileRes.data as any).avatar_url || null,
      });
    }
    setFriendCount(friendsRes.data?.length || 0);
    setUserRole((accountRes.data as any)?.role || "uczeń");
    
    if (activityRes.data) {
      setActivityDays(activityRes.data.map(d => d.date));
    }

    // Load join date
    const { data: userAccounts } = await supabase
      .from("user_accounts")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();
    if (userAccounts?.created_at) {
      setUserJoinDate(userAccounts.created_at);
    }

    setLoading(false);
  };

  const initials = avInitials(userName);
  const streak = calcStreak(activityDays);
  const heatmapCells = buildHeatmapCells(activityDays);

  const getDaysAgo = (joinDate: string): string => {
    const join = new Date(joinDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return "dzisiaj";
    if (diff === 1) return "1 dzień temu";
    if (diff < 7) return `${diff} dni temu`;
    if (diff < 30) {
      const weeks = Math.floor(diff / 7);
      return weeks === 1 ? "1 tydzień temu" : `${weeks} tygodni temu`;
    }
    const months = Math.floor(diff / 30);
    return months === 1 ? "1 miesiąc temu" : `${months} miesięcy temu`;
  };

  return (
    <div className="md-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md-modal" style={{ maxWidth: 520, padding: 0, overflow: "hidden" }}>
        <button className="md-modal-close" onClick={onClose} style={{ zIndex: 5 }}>✕</button>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#8899b4" }}>Ładowanie...</div>
        ) : (
          <>
            {/* Banner */}
            <div style={{
              height: 120,
              background: bannerColors[profile.banner_color] || bannerColors["banner-c1"],
            }} />

            {/* Avatar + info */}
            <div style={{ padding: "0 24px 24px", marginTop: -36 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                  border: "3px solid #0e1830", overflow: "hidden",
                  background: avColorStyles[profile.avatar_color] || avColorStyles["av-c1"],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem", fontWeight: 900,
                }}>
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 900 }}>{userName}</span>
                    <span style={{
                      fontSize: ".62rem", fontWeight: 800, padding: "2px 8px", borderRadius: 50,
                      background: roleBadge.bg, color: "#fff",
                    }}>{roleBadge.label}</span>
                  </div>
                  <div style={{ fontSize: ".8rem", color: "#8899b4" }}>
                    {profile.location && `📍 ${profile.location} · `}{friendCount} znajomych
                  </div>
                </div>
              </div>

              {userJoinDate && (
                <div style={{
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 14,
                  fontSize: ".8rem",
                  color: "#93c5fd"
                }}>
                  📅 Korzysta od <strong>{getDaysAgo(userJoinDate)}</strong>
                </div>
              )}

              {profile.bio && (
                <div style={{ fontSize: ".86rem", color: "#c8d8f0", lineHeight: 1.7, marginBottom: 14 }}>
                  {profile.bio}
                </div>
              )}

              {profile.interests.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {profile.interests.map((t) => (
                    <span key={t} style={{
                      background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
                      color: "#93c5fd", fontSize: ".72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 50,
                    }}>{t}</span>
                  ))}
                </div>
              )}

              {!profile.bio && profile.interests.length === 0 && (
                <div style={{ fontSize: ".85rem", color: "#8899b4", fontStyle: "italic", marginBottom: 14 }}>
                  Ten użytkownik nie dodał jeszcze informacji o sobie.
                </div>
              )}

              {/* Streak section */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "12px 14px"
              }}>
                <div style={{ fontSize: ".7rem", fontWeight: 800, color: "#8899b4", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  📅 Passar nauki
                </div>
                <div style={{
                  display: "flex", gap: 0, marginBottom: 10, background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden"
                }}>
                  <StreakStat icon="🔥" num={streak.current} label="Obecna" gradient="linear-gradient(135deg,#f59e0b,#f87171)" />
                  <StreakStat icon="🏆" num={streak.best} label="Rekord" gradient="linear-gradient(135deg,#a78bfa,#6366f1)" />
                  <StreakStat icon="📆" num={streak.total} label="Łącznie" gradient="linear-gradient(135deg,#34d399,#3b82f6)" />
                </div>
                <div style={{ overflowX: "auto", paddingBottom: 2 }}>
                  <div style={{ display: "grid", gridTemplateRows: "repeat(7, 8px)", gridAutoFlow: "column", gap: 2, width: "max-content" }}>
                    {heatmapCells.map((c, i) => (
                      <div
                        key={i}
                        title={`${c.iso}${c.active ? " ✓" : ""}`}
                        style={{
                          width: 8, height: 8, borderRadius: 1, transition: ".15s",
                          background: c.future ? "transparent" : c.active ? (c.isToday ? "rgba(59,130,246,0.9)" : "rgba(59,130,246,0.55)") : "rgba(255,255,255,0.05)",
                          outline: c.isToday && !c.future ? "1px solid rgba(99,102,241,0.7)" : "none",
                          opacity: c.future ? 0 : 1,
                          pointerEvents: c.future ? "none" : "auto"
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StreakStat = ({ icon, num, label, gradient }: { icon: string; num: number; label: string; gradient: string }) => (
  <div style={{ flex: 1, padding: "10px 0", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
    <div style={{ fontSize: ".8rem", marginBottom: 1 }}>{icon}</div>
    <div style={{ fontSize: "1.2rem", fontWeight: 900, lineHeight: 1, background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{num}</div>
    <div style={{ fontSize: ".6rem", color: "#8899b4", marginTop: 2, fontWeight: 600 }}>{label}</div>
  </div>
);

export default UserProfileModal;
