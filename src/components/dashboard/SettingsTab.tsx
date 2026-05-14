import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { clearAuthStorage } from "@/lib/authCleanup";
import AvatarCropModal from "./AvatarCropModal";
import { setAvatarCache } from "@/lib/avatarCache";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type ProfileData = {
  bio: string;
  location: string;
  interests: string[];
  avatar_color: string;
  banner_color: string;
  avatar_url: string | null;
};

const SettingsTab = ({ onNavigateToFriends }: { onNavigateToFriends?: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    bio: "", location: "", interests: [],
    avatar_color: "av-c1", banner_color: "banner-c1", avatar_url: null,
  });
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editInterests, setEditInterests] = useState("");
  const [editAvColor, setEditAvColor] = useState("av-c1");
  const [editBannerColor, setEditBannerColor] = useState("banner-c1");
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId") || "";
  const userName = localStorage.getItem("userName") || "Uczeń";
  const userRole = localStorage.getItem("userRole") || "uczeń";
  const userEmail = localStorage.getItem("userEmail") || "";
  const initials = avInitials(userName);
  const { roles: availableRoles } = useRoles();
  const roleInfo = availableRoles.find(r => r.name === userRole);
  const roleBadge = {
    label: roleInfo?.label || userRole.charAt(0).toUpperCase() + userRole.slice(1),
    bg: roleInfo?.color || (userRole === "teacher" ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#3b82f6,#6366f1)"),
    color: roleInfo?.color?.startsWith("linear-gradient") ? "#fff" : "#fff"
  };

  useEffect(() => {
    if (!userId) return;
    loadProfile();
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

  const openEdit = () => {
    setEditBio(profile.bio);
    setEditLocation(profile.location);
    setEditInterests(profile.interests.join(", "));
    setEditAvColor(profile.avatar_color);
    setEditBannerColor(profile.banner_color);
    setEditing(true);
  };

  const openAvatarEdit = () => {
    setEditAvColor(profile.avatar_color);
    setEditingAvatar(true);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Proszę wybrać plik graficzny");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar pliku to 10MB");
      return;
    }
    setCropFile(file);
    e.target.value = "";
  };

  const handleCroppedUpload = async (blob: Blob) => {
    setCropFile(null);
    setUploading(true);
    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

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
    setAvatarCache(userId, avatarUrl);
    setUploading(false);
    toast.success("Zdjęcie profilowe zaktualizowane!");
  };

  const saveAvatarColor = async () => {
    await supabase.from("user_profiles").upsert(
      { user_id: userId, avatar_color: editAvColor },
      { onConflict: "user_id" }
    );
    setProfile(prev => ({ ...prev, avatar_color: editAvColor }));
    setEditingAvatar(false);
    toast.success("Kolor avatara zapisany!");
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

  const handleChangePassword = async () => {
    if (!newPassword || !currentPassword) {
      toast.error("Proszę podać aktualne i nowe hasło");
      return;
    }
    // This would require proper password change logic
    toast.error("Ta funkcja będzie dostępna wkrótce");
    setChangePasswordDialogOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    try {
      // Delete user data from database
      await supabase.from("user_profiles").delete().eq("user_id", userId);
      await supabase.from("activity_days").delete().eq("user_id", userId);
      
      // Sign out from auth (best-effort). If it fails, continue with local cleanup.
      const signOutPromise = supabase.auth.signOut();
      const signOutRes = await signOutPromise;
      if (signOutRes?.error) {
        console.error("signOut error:", signOutRes.error);
        toast.warning("Błąd wylogowywania po usunięciu konta — zakończono lokalnie");
        clearAuthStorage();
        try { await supabase.auth.setSession({ access_token: "", refresh_token: "" }); } catch (e) { /* ignore */ }
        navigate("/", { replace: true });
        // background retry
        signOutPromise.then(r => { if (r?.error) console.warn("background signOut error:", r.error); else console.log("background signOut succeeded"); }).catch(e => console.warn(e));
        return;
      }

      // Clear all localStorage and force client session clear
      clearAuthStorage();
      try { await supabase.auth.setSession({ access_token: "", refresh_token: "" }); } catch (e) { /* ignore */ }

      toast.success("Konto zostało trwale usunięte");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("account deletion error:", error);
      toast.error("Błąd usuwania konta");
    }
  };

  if (loading) return <div className="md-content" style={{ color: "#8899b4", textAlign: "center", padding: 40 }}>Ładowanie profilu…</div>;

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
            <div onClick={openAvatarEdit} style={{
              width: 80, height: 80, borderRadius: "50%",
              background: avColorStyles[profile.avatar_color] || avColorStyles["av-c1"],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.6rem", fontWeight: 900, border: "3px solid #0a1428", cursor: "pointer",
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
                📷
              </div>
            </div>
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

      {/* Settings section */}
      <div style={{
        background: "rgba(14,24,48,0.85)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "18px 22px", marginBottom: 20
      }}>
        <div style={{ fontSize: ".72rem", fontWeight: 800, color: "#8899b4", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 14 }}>
          ⚙️ Ustawienia konta
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="md-btn"
            style={{ width: "100%", justifyContent: "flex-start", backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            onClick={() => setChangePasswordDialogOpen(true)}
          >
            🔐 Zmień hasło
          </button>
          
          <button
            className="md-btn"
            style={{ width: "100%", justifyContent: "flex-start", backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            onClick={() => toast.info("Powiadomienia będą dostępne wkrótce")}
          >
            🔔 Zarządzaj powiadomieniami
          </button>
          
          <button
            className="md-btn"
            style={{ width: "100%", justifyContent: "flex-start", backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            onClick={() => toast.info("Eksport danych będzie dostępny wkrótce")}
          >
            💾 Eksportuj dane
          </button>

          <button
            className="md-btn md-btn-danger"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => setDeleteAccountDialogOpen(true)}
          >
            ❌ Usuń konto
          </button>
        </div>
      </div>

      {/* Avatar edit modal */}
      {editingAvatar && (
        <div className="md-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingAvatar(false); }}>
          <div className="md-modal" style={{ maxWidth: 400 }}>
            <button className="md-modal-close" onClick={() => setEditingAvatar(false)}>✕</button>
            <div className="md-modal-title">📷 Zdjęcie profilowe</div>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 96, height: 96, borderRadius: "50%", margin: "0 auto 12px",
                background: avColorStyles[editAvColor] || avColorStyles["av-c1"],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem", fontWeight: 900, overflow: "hidden",
              }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : initials}
              </div>
              <button
                className="md-btn md-btn-prim"
                style={{ marginRight: 8 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Przesyłanie..." : "📷 Prześlij zdjęcie"}
              </button>
              {profile.avatar_url && (
                <button className="md-btn md-btn-danger" onClick={removeAvatar}>Usuń zdjęcie</button>
              )}
            </div>

            <div className="md-form-group">
              <label>Kolor avatara (widoczny gdy brak zdjęcia)</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(avColorStyles).map(([cls, bg]) => (
                  <div
                    key={cls}
                    onClick={() => setEditAvColor(cls)}
                    style={{
                      width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                      background: bg,
                      border: editAvColor === cls ? "2px solid rgba(255,255,255,0.7)" : "2px solid transparent"
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="md-modal-footer">
              <button className="md-btn" onClick={() => setEditingAvatar(false)}>Anuluj</button>
              <button className="md-btn md-btn-prim" onClick={saveAvatarColor}>Zapisz</button>
            </div>
          </div>
        </div>
      )}

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
            <div className="md-form-group">
              <label>Kolor banera</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(bannerColors).map(([cls, bg]) => (
                  <div
                    key={cls}
                    onClick={() => setEditBannerColor(cls)}
                    style={{
                      width: 44, height: 22, borderRadius: 5, cursor: "pointer",
                      background: bg,
                      border: editBannerColor === cls ? "2px solid rgba(255,255,255,0.7)" : "2px solid transparent"
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="md-modal-footer">
              <button className="md-btn" onClick={() => setEditing(false)}>Anuluj</button>
              <button className="md-btn md-btn-prim" onClick={saveEdit}>Zapisz zmiany</button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          onCropped={handleCroppedUpload}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* Change password dialog */}
      <AlertDialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🔐 Zmień hasło</AlertDialogTitle>
            <AlertDialogDescription>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: ".85rem" }}>Aktualne hasło</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 12px", marginTop: 6,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6, color: "#fff",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: ".85rem" }}>Nowe hasło</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 12px", marginTop: 6,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6, color: "#fff",
                    }}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangePassword}>Zmień hasło</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete account dialog */}
      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>❌ Usuń konto?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Wszystkie Twoje dane zostaną permanentnie usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} style={{ backgroundColor: "#ef4444" }}>
              Usuń konto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsTab;
