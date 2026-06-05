import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getUserIdSafe } from "@/lib/authSession";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import AvatarCropModal from "./AvatarCropModal";
import { setAvatarCache } from "@/lib/avatarCache";
import { LoadingInline } from "@/components/ui/loading-state";

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
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.substring(0, 2).toUpperCase();
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

interface ProfileTabProps {
  onNavigateToFriends?: () => void;
}

type ProfileData = {
  bio: string;
  location: string;
  interests: string[];
  avatar_color: string;
  banner_color: string;
  avatar_url: string | null;
};

const ProfileTab = ({ onNavigateToFriends }: ProfileTabProps) => {
  const [editing, setEditing] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    bio: "", location: "", interests: [],
    avatar_color: "av-c1", banner_color: "banner-c1", avatar_url: null,
  });
  const [activityDays, setActivityDays] = useState<string[]>([]);
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editInterests, setEditInterests] = useState("");
  const [editAvColor, setEditAvColor] = useState("av-c1");
  const [editBannerColor, setEditBannerColor] = useState("banner-c1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = localStorage.getItem("userId") || "";
  const userName = localStorage.getItem("userName") || "Uczeń";
  const userRole = localStorage.getItem("userRole") || "uczeń";
  const initials = avInitials(userName);
  const { roles: availableRoles, getRoleLabel, getRoleColor } = useRoles();
  const roleInfo = availableRoles.find(r => r.name === userRole);
  const roleBadge = {
    label: roleInfo?.label || userRole.charAt(0).toUpperCase() + userRole.slice(1),
    bg: roleInfo?.color || (userRole === "teacher" ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#3b82f6,#6366f1)"),
    color: roleInfo?.color?.startsWith("linear-gradient") ? "#fff" : "#fff"
  };

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    loadActivity();
    recordTodayActivity();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      const avatarUrl = (data as any).avatar_url || null;
      setProfile({
        bio: data.bio || "",
        location: data.location || "",
        interests: data.interests || [],
        avatar_color: data.avatar_color || "av-c1",
        banner_color: data.banner_color || "banner-c1",
        avatar_url: avatarUrl,
      });
      setAvatarCache(userId, avatarUrl);
    }
    setLoading(false);
  };

  const loadActivity = async () => {
    const { data } = await supabase
      .from("activity_days")
      .select("date")
      .eq("user_id", userId);
    if (data) setActivityDays(data.map(d => d.date));
  };

  const recordTodayActivity = async () => {
    const today = todayISO();
    await supabase.from("activity_days").upsert(
      { user_id: userId, date: today },
      { onConflict: "user_id,date" }
    );
  };

  const openEdit = () => {
    setEditBio(profile.bio);
    setEditLocation(profile.location);
    setEditInterests(profile.interests.join(", "));
    setEditAvColor(profile.avatar_color);
    setEditBannerColor(profile.banner_color);
    setEditing(true);
  };

  const openAvatarEdit = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Proszę wybrać plik graficzny");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar pliku to 10MB");
      return;
    }
    handleCroppedUpload(file);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    setCropFile(null);
    setUploading(true);
    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: (blob as File).type || "image/jpeg" });

    if (uploadError) {
      toast.error("Błąd przesyłania zdjęcia");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    await supabase.from("user_profiles").upsert(
      { user_id: userId, avatar_url: avatarUrl },
      { onConflict: "user_id" }
    );

    setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
    // Notify sidebar
    setAvatarCache(userId, avatarUrl);
    setUploading(false);
    toast.success("Zdjęcie profilowe zaktualizowane!");
  };




  const removeAvatar = async () => {
    await supabase.from("user_profiles").upsert(
      { user_id: userId, avatar_url: null },
      { onConflict: "user_id" }
    );
    setProfile(prev => ({ ...prev, avatar_url: null }));
    setAvatarCache(userId, null);
    toast.success("Zdjęcie profilowe usunięte");
  };

  const saveEdit = async () => {
    const newProfile = {
      user_id: userId,
      bio: editBio,
      location: editLocation,
      interests: editInterests.split(",").map(s => s.trim()).filter(Boolean),
      avatar_color: editAvColor,
      banner_color: editBannerColor,
    };
    const { error } = await supabase.from("user_profiles").upsert(newProfile, { onConflict: "user_id" });
    if (error) {
      toast.error("Błąd zapisu profilu");
      return;
    }
    setProfile(prev => ({
      ...prev,
      bio: newProfile.bio,
      location: newProfile.location,
      interests: newProfile.interests,
      avatar_color: newProfile.avatar_color,
      banner_color: newProfile.banner_color,
    }));
    setEditing(false);
    toast.success("Profil zapisany!");
  };

  const streak = calcStreak(activityDays);
  const heatmapCells = buildHeatmapCells(activityDays);

  if (loading) return <div className="md-content"><LoadingInline label="Ładowanie profilu…" minHeight={240} /></div>;

  return (
    <div className="md-content">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* Profile card */}
      <div style={{ background: "rgba(14,24,48,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
        <div style={{
          height: 160, borderRadius: "16px 16px 0 0", position: "relative", overflow: "hidden",
          background: bannerColors[profile.banner_color] || bannerColors["banner-c1"]
        }}>
          <button onClick={openEdit} style={{
            position: "absolute", bottom: 10, right: 12, background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "5px 12px",
            borderRadius: 8, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", zIndex: 2
          }}>
            ✏️ Edytuj profil
          </button>
        </div>

        <div style={{ padding: "0 24px 20px", display: "flex", alignItems: "flex-end", gap: 16, position: "relative", marginTop: -40 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div onClick={openAvatarEdit} title={uploading ? "Przesyłanie..." : "Kliknij, aby zmienić zdjęcie"} style={{
              width: 80, height: 80, borderRadius: "50%",
              background: avColorStyles[profile.avatar_color] || avColorStyles["av-c1"],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.6rem", fontWeight: 900, border: "3px solid #0a1428",
              cursor: uploading ? "wait" : "pointer",
              overflow: "hidden", position: "relative",
            }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : initials}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 24,
                background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".6rem", color: "#fff", fontWeight: 700,
              }}>
                {uploading ? "…" : "📷"}
              </div>
            </div>
            {profile.avatar_url && !uploading && (
              <button
                onClick={removeAvatar}
                style={{
                  display: "block", margin: "6px auto 0", background: "transparent",
                  border: "none", color: "#f87171", fontSize: ".7rem", cursor: "pointer",
                  fontFamily: "inherit", padding: 0, textDecoration: "underline",
                }}
              >
                Usuń zdjęcie
              </button>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 900 }}>{userName}</span>
              <span style={{
                fontSize: ".68rem", fontWeight: 800, padding: "2px 10px", borderRadius: 50,
                background: roleBadge.bg, color: roleBadge.color,
              }}>
                {roleBadge.label}
              </span>
            </div>
            <div style={{ fontSize: ".83rem", color: "#8899b4" }}>
              @{localStorage.getItem("userUsername") || userName.toLowerCase()}{profile.location ? ` · 📍${profile.location}` : ""}
            </div>
          </div>
        </div>

        <div style={{ padding: "0 24px 20px" }}>
          {profile.bio ? (
            <div style={{ fontSize: ".88rem", color: "#c8d8f0", lineHeight: 1.7, marginBottom: 10 }}>{profile.bio}</div>
          ) : (
            <div style={{ fontSize: ".88rem", color: "#8899b4", fontStyle: "italic", marginBottom: 10 }}>
              Brak opisu – <span style={{ color: "#60a5fa", cursor: "pointer" }} onClick={openEdit}>dodaj bio</span>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {profile.interests.map((t) => (
              <span key={t} style={{
                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
                color: "#93c5fd", fontSize: ".72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 50
              }}>
                {t}
              </span>
            ))}
            <span onClick={openEdit} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#8899b4", fontSize: ".72rem", fontWeight: 700, padding: "3px 10px",
              borderRadius: 50, cursor: "pointer"
            }}>
              ＋ Dodaj zainteresowanie
            </span>
          </div>
        </div>
      </div>

      <SubscriptionCard />

      <div style={{
        background: "rgba(14,24,48,0.85)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "18px 22px", marginBottom: 20
      }}>
        <div style={{ fontSize: ".72rem", fontWeight: 800, color: "#8899b4", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 14 }}>
          📅 Systematyczność nauki
        </div>
        <div style={{
          display: "flex", gap: 0, marginBottom: 16, background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, overflow: "hidden"
        }}>
          <StreakStat icon="🔥" num={streak.current} label="Obecna passa" gradient="linear-gradient(135deg,#f59e0b,#f87171)" />
          <StreakStat icon="🏆" num={streak.best} label="Rekord z rzędu" gradient="linear-gradient(135deg,#a78bfa,#6366f1)" />
          <StreakStat icon="📆" num={streak.total} label="Łącznie dni" gradient="linear-gradient(135deg,#34d399,#3b82f6)" />
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateRows: "repeat(7, 11px)", gridAutoFlow: "column", gap: 3, width: "max-content" }}>
            {heatmapCells.map((c, i) => (
              <div
                key={i}
                title={`${c.iso}${c.active ? " ✓" : ""}`}
                style={{
                  width: 11, height: 11, borderRadius: 2, transition: ".15s",
                  background: c.future ? "transparent" : c.active ? (c.isToday ? "rgba(59,130,246,0.9)" : "rgba(59,130,246,0.55)") : "rgba(255,255,255,0.05)",
                  outline: c.isToday && !c.future ? "1.5px solid rgba(99,102,241,0.7)" : "none",
                  outlineOffset: c.isToday ? 1 : 0,
                  opacity: c.future ? 0 : 1,
                  pointerEvents: c.future ? "none" : "auto"
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: ".68rem", color: "#8899b4" }}>
          <span>Mniej</span>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.05)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(59,130,246,0.3)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(59,130,246,0.6)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(59,130,246,0.9)" }} />
          <span>Więcej</span>
        </div>
        {streak.current >= 3 ? (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(248,113,113,0.1))",
            border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24",
            fontSize: ".75rem", fontWeight: 800, padding: "4px 10px", borderRadius: 50, marginTop: 8
          }}>
            🔥 Passa {streak.current} dni z rzędu!
          </div>
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#8899b4", fontSize: ".75rem", fontWeight: 800, padding: "4px 10px",
            borderRadius: 50, marginTop: 8
          }}>
            {streak.current === 0 ? "Zaloguj się jutro, żeby zacząć passę!" : `⚡ ${streak.current} ${streak.current === 1 ? "dzień" : "dni"} z rzędu – kontynuuj!`}
          </div>
        )}
      </div>




      {/* Edit profile modal */}
      {editing && (
        <div className="md-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditing(false); }}>
          <div className="md-modal" style={{ maxWidth: 520 }}>
            <button className="md-modal-close" onClick={() => setEditing(false)}>✕</button>
            <div className="md-modal-title">✏️ Edytuj profil</div>
            <div className="md-form-group">
              <label>Bio</label>
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={200} rows={3} />
            </div>
            <div className="md-form-group">
              <label>Lokalizacja</label>
              <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="np. Warszawa, Polska" maxLength={50} />
            </div>
            <div className="md-form-group">
              <label>Zainteresowania (oddziel przecinkami)</label>
              <input value={editInterests} onChange={(e) => setEditInterests(e.target.value)} placeholder="np. muzyka, sport" maxLength={100} />
            </div>
            <div className="md-modal-footer">
              <button className="md-btn" onClick={() => setEditing(false)}>Anuluj</button>
              <button className="md-btn md-btn-prim" onClick={saveEdit}>Zapisz zmiany</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StreakStat = ({ icon, num, label, gradient }: { icon: string; num: number; label: string; gradient: string }) => (
  <div style={{ flex: 1, padding: "13px 0", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
    <div style={{ fontSize: ".9rem", marginBottom: 2 }}>{icon}</div>
    <div style={{ fontSize: "1.5rem", fontWeight: 900, lineHeight: 1, background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{num}</div>
    <div style={{ fontSize: ".68rem", color: "#8899b4", marginTop: 4, fontWeight: 600 }}>{label}</div>
  </div>
);

const SubscriptionCard = () => {
  const [info, setInfo] = useState<{
    role: string | null;
    fee_exempt: boolean;
    subscription_status: string | null;
    subscription_expires_at: string | null;
    subscription_plan: string | null;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    (async () => {
      const uid = await getUserIdSafe();
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("user_accounts")
        .select("role, fee_exempt, subscription_status, subscription_expires_at, subscription_plan, cancel_at_period_end, stripe_customer_id")
        .eq("id", uid)
        .maybeSingle();
      setInfo(data as any);
      setLoading(false);
    })();
  }, []);

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-link", {});
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("Brak adresu portalu");
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się otworzyć portalu Stripe");
    } finally {
      setOpening(false);
    }
  };

  if (loading || !info) return null;

  const role = (info.role || "").toLowerCase();
  const isStaff = role === "admin" || role === "nauczyciel" || role === "teacher";
  const expires = info.subscription_expires_at ? new Date(info.subscription_expires_at) : null;
  const expiresStr = expires ? expires.toLocaleDateString("pl-PL") : null;

  let title = "Status subskrypcji";
  let body: string;
  let badge: { text: string; color: string };
  if (isStaff) {
    body = "Masz pełny dostęp jako " + (role === "admin" ? "administrator" : "nauczyciel") + ".";
    badge = { text: "Pełny dostęp", color: "#34d399" };
  } else if (info.fee_exempt) {
    body = "Twoje konto jest zwolnione z opłat.";
    badge = { text: "Zwolnienie", color: "#34d399" };
  } else if (info.subscription_plan === "90d" && expires && expires.getTime() > Date.now()) {
    body = `Plan 90-dniowy aktywny do ${expiresStr}.`;
    badge = { text: "Aktywny", color: "#34d399" };
  } else if (info.subscription_status === "active" && info.subscription_plan === "30d") {
    body = info.cancel_at_period_end
      ? `Subskrypcja anulowana — dostęp do ${expiresStr}.`
      : `Subskrypcja miesięczna · odnowi się ${expiresStr ?? "wkrótce"}.`;
    badge = info.cancel_at_period_end
      ? { text: "Anulowana", color: "#fbbf24" }
      : { text: "Aktywna", color: "#34d399" };
  } else if (info.subscription_status === "canceled" && expires && expires.getTime() > Date.now()) {
    body = `Subskrypcja anulowana — dostęp do ${expiresStr}.`;
    badge = { text: "Anulowana", color: "#fbbf24" };
  } else {
    body = "Brak aktywnego planu.";
    badge = { text: "Nieaktywna", color: "#f87171" };
  }

  return (
    <div style={{
      background: "rgba(14,24,48,0.85)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "18px 22px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: ".72rem", fontWeight: 800, color: "#8899b4", textTransform: "uppercase", letterSpacing: "1.2px" }}>
          💳 {title}
        </div>
        <span style={{
          fontSize: ".68rem", fontWeight: 800, padding: "3px 10px", borderRadius: 50,
          background: `${badge.color}22`, color: badge.color,
        }}>{badge.text}</span>
      </div>
      <div style={{ fontSize: ".88rem", color: "#c8d8f0", marginBottom: 12 }}>{body}</div>

      {!isStaff && info.stripe_customer_id && (
        <button onClick={openPortal} disabled={opening} style={{
          background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", border: "none",
          padding: "9px 16px", borderRadius: 10, fontSize: ".82rem", fontWeight: 700,
          cursor: opening ? "wait" : "pointer", fontFamily: "inherit", opacity: opening ? 0.7 : 1,
        }}>
          {opening ? "Otwieram…" : "Zarządzaj subskrypcją"}
        </button>
      )}
      {!isStaff && !info.stripe_customer_id && !info.fee_exempt && (
        <button onClick={() => { window.location.href = "/pricing"; }} style={{
          background: "linear-gradient(135deg,#f59e0b,#f97316)", color: "#fff", border: "none",
          padding: "9px 16px", borderRadius: 10, fontSize: ".82rem", fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          Wybierz plan
        </button>
      )}
    </div>
  );
};

export default ProfileTab;

