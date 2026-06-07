import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { logoutUser } from "@/lib/authCleanup";

import { setAvatarCache } from "@/lib/avatarCache";
import { LoadingInline } from "@/components/ui/loading-state";
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
  return parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : name.substring(0, 2).toUpperCase();
}

type ProfileData = {
  bio: string;
  location: string;
  interests: string[];
  avatar_color: string;
  banner_color: string;
  avatar_url: string | null;
};

const SettingsTab = ({
  onNavigateToFriends,
}: {
  onNavigateToFriends?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    bio: "",
    location: "",
    interests: [],
    avatar_color: "av-c1",
    banner_color: "banner-c1",
    avatar_url: null,
  });

  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editInterests, setEditInterests] = useState("");
  const [editAvColor, setEditAvColor] = useState("av-c1");
  const [editBannerColor, setEditBannerColor] = useState("banner-c1");

  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] =
    useState(false);

  const [changePasswordDialogOpen, setChangePasswordDialogOpen] =
    useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  const userId = localStorage.getItem("userId") || "";
  const userName = localStorage.getItem("userName") || "Uczeń";
  const userRole = localStorage.getItem("userRole") || "uczeń";

  const initials = avInitials(userName);

  const { roles: availableRoles } = useRoles();

  const roleInfo = availableRoles.find((r) => r.name === userRole);

  const roleBadge = {
    label:
      roleInfo?.label ||
      userRole.charAt(0).toUpperCase() + userRole.slice(1),

    bg:
      roleInfo?.color ||
      (userRole === "teacher"
        ? "linear-gradient(135deg,#f59e0b,#ef4444)"
        : "linear-gradient(135deg,#3b82f6,#6366f1)"),

    color: "#fff",
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
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
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
    setUploading(true);

    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        upsert: true,
        contentType: (blob as File).type || "image/jpeg",
      });

    if (uploadError) {
      toast.error("Błąd przesyłania zdjęcia");
      setUploading(false);
      return;
    }

    const { data: urlData } =
      supabase.storage.from("avatars").getPublicUrl(path);

    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          avatar_url: avatarUrl,
        },
        { onConflict: "user_id" }
      );

    setProfile((prev) => ({
      ...prev,
      avatar_url: avatarUrl,
    }));

    setAvatarCache(userId, avatarUrl);

    setUploading(false);

    toast.success("Zdjęcie profilowe zaktualizowane!");
  };

  const removeAvatar = async () => {
    await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          avatar_url: null,
        },
        { onConflict: "user_id" }
      );

    setProfile((prev) => ({
      ...prev,
      avatar_url: null,
    }));

    setAvatarCache(userId, null);

    toast.success("Zdjęcie profilowe usunięte");
  };

  const saveEdit = async () => {
    const newProfile = {
      user_id: userId,
      bio: editBio,
      location: editLocation,
      interests: editInterests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),

      avatar_color: editAvColor,
      banner_color: editBannerColor,
    };

    const { error } = await supabase
      .from("user_profiles")
      .upsert(newProfile, {
        onConflict: "user_id",
      });

    if (error) {
      toast.error("Błąd zapisu profilu");
      return;
    }

    setProfile((prev) => ({
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

  const handleDeleteAccount = async () => {
    if (!userId) return;

    try {
      await supabase
        .from("user_profiles")
        .delete()
        .eq("user_id", userId);

      const { timedOut, error } = await logoutUser();

      if (timedOut || error) {
        toast.warning(
          "Błąd wylogowywania po usunięciu konta — zakończono lokalnie"
        );
      }

      toast.success("Konto zostało trwale usunięte");

      navigate("/", { replace: true });
    } catch (error) {
      toast.error("Błąd usuwania konta");
    }
  };

  if (loading) {
    return <div className="md-content"><LoadingInline label="Ładowanie profilu…" minHeight={240} /></div>;
  }

  return (
    <div className="md-content">

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* PROFILE CARD */}

      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(10,18,34,0.92))",

          border: "1px solid rgba(255,255,255,0.07)",

          borderRadius: 24,

          overflow: "hidden",

          marginBottom: 24,

          boxShadow:
            "0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",

          backdropFilter: "blur(18px)",

          position: "relative",
        }}
      >

        {/* BANNER */}

        <div
          style={{
            height: 210,

            borderRadius: "24px 24px 0 0",

            position: "relative",

            overflow: "hidden",

            background:
              bannerColors[profile.banner_color] ||
              bannerColors["banner-c1"],

            boxShadow:
              "inset 0 -80px 120px rgba(0,0,0,0.45)",
          }}
        >

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 40%)",
            }}
          />

          <button
            onClick={openEdit}
            style={{
              position: "absolute",

              bottom: 16,

              right: 16,

              background: "rgba(0,0,0,0.35)",

              border: "1px solid rgba(255,255,255,0.14)",

              color: "#fff",

              padding: "8px 14px",

              borderRadius: 12,

              fontSize: ".78rem",

              cursor: "pointer",

              fontWeight: 700,

              backdropFilter: "blur(10px)",

              transition: ".2s",
            }}
          >
            ✏️ Edytuj profil
          </button>
        </div>

        {/* USER */}

        <div
          style={{
            padding: "0 28px 28px",

            display: "flex",

            alignItems: "flex-end",

            gap: 20,

            position: "relative",

            marginTop: -52,
          }}
        >

          {/* AVATAR */}

          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              onClick={openAvatarEdit}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              style={{
                width: 104,
                height: 104,

                borderRadius: "50%",

                background:
                  avColorStyles[profile.avatar_color] ||
                  avColorStyles["av-c1"],

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                fontSize: "2rem",

                fontWeight: 900,

                border: "4px solid #0a1428",

                cursor: "pointer",

                overflow: "hidden",

                position: "relative",

                transition: ".22s ease",

                boxShadow:
                  "0 10px 30px rgba(0,0,0,0.45), 0 0 0 4px rgba(15,23,42,0.9)",
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={userName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                initials
              )}

              <div
                style={{
                  position: "absolute",

                  bottom: 0,

                  left: 0,

                  right: 0,

                  height: 28,

                  background: "rgba(0,0,0,0.55)",

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",

                  fontSize: ".68rem",

                  color: "#fff",

                  fontWeight: 800,

                  backdropFilter: "blur(8px)",
                }}
              >
                📷 Zmień
              </div>
            </div>
          </div>

          {/* USER INFO */}

          <div style={{ flex: 1, minWidth: 0 }}>

            <div
              style={{
                display: "flex",

                alignItems: "center",

                gap: 12,

                marginBottom: 6,

                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "1.55rem",

                  fontWeight: 900,

                  letterSpacing: "-0.03em",
                }}
              >
                {userName}
              </span>

              <span
                style={{
                  fontSize: ".68rem",

                  fontWeight: 800,

                  padding: "4px 12px",

                  borderRadius: 999,

                  background: roleBadge.bg,

                  color: roleBadge.color,

                  boxShadow:
                    "0 4px 14px rgba(0,0,0,0.25)",

                  border:
                    "1px solid rgba(255,255,255,0.12)",

                  backdropFilter: "blur(8px)",
                }}
              >
                {roleBadge.label}
              </span>
            </div>

            <div
              style={{
                fontSize: ".88rem",

                color: "#94a3b8",

                marginBottom: 14,
              }}
            >
              @
              {localStorage.getItem("userUsername") ||
                userName.toLowerCase()}

              {profile.location &&
                ` · 📍 ${profile.location}`}
            </div>

            {profile.bio ? (
              <div
                style={{
                  fontSize: ".92rem",

                  color: "#d7e3f4",

                  lineHeight: 1.75,

                  maxWidth: 680,

                  marginBottom: 16,
                }}
              >
                {profile.bio}
              </div>
            ) : (
              <div
                style={{
                  color: "#7c8aa5",

                  fontStyle: "italic",

                  marginBottom: 16,
                }}
              >
                Brak opisu —{" "}
                <span
                  style={{
                    color: "#60a5fa",
                    cursor: "pointer",
                  }}
                  onClick={openEdit}
                >
                  dodaj bio
                </span>
              </div>
            )}

            {/* INTERESTS */}

            <div
              style={{
                display: "flex",

                flexWrap: "wrap",

                gap: 8,
              }}
            >
              {profile.interests.map((t) => (
                <span
                  key={t}
                  style={{
                    background:
                      "rgba(59,130,246,0.12)",

                    border:
                      "1px solid rgba(59,130,246,0.2)",

                    color: "#bfdbfe",

                    fontSize: ".74rem",

                    fontWeight: 700,

                    padding: "6px 12px",

                    borderRadius: 999,

                    backdropFilter: "blur(8px)",
                  }}
                >
                  {t}
                </span>
              ))}

              <span
                onClick={openEdit}
                style={{
                  background:
                    "rgba(255,255,255,0.04)",

                  border:
                    "1px solid rgba(255,255,255,0.08)",

                  color: "#94a3b8",

                  fontSize: ".74rem",

                  fontWeight: 700,

                  padding: "6px 12px",

                  borderRadius: 999,

                  cursor: "pointer",

                  transition: ".2s",
                }}
              >
                ＋ Dodaj zainteresowanie
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS */}

      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(14,24,48,0.88), rgba(10,18,34,0.84))",

          border: "1px solid rgba(255,255,255,0.06)",

          borderRadius: 22,

          padding: 22,

          boxShadow:
            "0 10px 40px rgba(0,0,0,0.3)",

          backdropFilter: "blur(18px)",
        }}
      >

        <div
          style={{
            fontSize: ".72rem",

            fontWeight: 900,

            color: "#94a3b8",

            textTransform: "uppercase",

            letterSpacing: "1.5px",

            marginBottom: 16,
          }}
        >
          ⚙️ Ustawienia konta
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >

          {[
            {
              icon: "🔐",
              title: "Zmień hasło",
              sub: "Zaktualizuj dane logowania",
              action: () =>
                setChangePasswordDialogOpen(true),
            },

            {
              icon: "🔔",
              title: "Powiadomienia",
              sub: "Zarządzaj alertami i przypomnieniami",
              action: () =>
                toast.info(
                  "Powiadomienia będą dostępne wkrótce"
                ),
            },

          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              style={{
                width: "100%",

                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                padding: "16px 18px",

                borderRadius: 18,

                border:
                  "1px solid rgba(255,255,255,0.06)",

                background:
                  "rgba(255,255,255,0.03)",

                cursor: "pointer",

                transition: ".22s ease",

                color: "#fff",

                backdropFilter: "blur(10px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  "translateY(-2px)";

                e.currentTarget.style.background =
                  "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform =
                  "translateY(0px)";

                e.currentTarget.style.background =
                  "rgba(255,255,255,0.03)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,

                    background:
                      "rgba(59,130,246,0.12)",

                    display: "flex",

                    alignItems: "center",

                    justifyContent: "center",

                    fontSize: "1.05rem",
                  }}
                >
                  {item.icon}
                </div>

                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: ".92rem",
                      fontWeight: 800,
                    }}
                  >
                    {item.title}
                  </div>

                  <div
                    style={{
                      fontSize: ".75rem",
                      color: "#94a3b8",
                      marginTop: 2,
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: "1rem",
                }}
              >
                →
              </div>
            </button>
          ))}

          {/* DELETE */}

          <button
            onClick={() =>
              setDeleteAccountDialogOpen(true)
            }
            style={{
              marginTop: 8,

              width: "100%",

              padding: "16px 18px",

              borderRadius: 18,

              border:
                "1px solid rgba(239,68,68,0.22)",

              background:
                "rgba(239,68,68,0.08)",

              color: "#fca5a5",

              fontWeight: 800,

              cursor: "pointer",

              transition: ".22s",
            }}
          >
            ❌ Usuń konto
          </button>
        </div>
      </div>


      {/* EDIT PROFILE MODAL */}
      {editing && (
        <div
          onClick={() => setEditing(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16, backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a", borderRadius: 20, padding: 24,
              maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3 style={{ fontSize: "1.2rem", fontWeight: 900, marginBottom: 18 }}>
              ✏️ Edytuj profil
            </h3>

            <label style={{ fontSize: ".78rem", color: "#94a3b8", fontWeight: 700 }}>Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={3}
              style={{
                width: "100%", marginTop: 6, marginBottom: 14, padding: 12,
                borderRadius: 12, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                fontSize: ".9rem", resize: "vertical",
              }}
            />

            <label style={{ fontSize: ".78rem", color: "#94a3b8", fontWeight: 700 }}>Lokalizacja</label>
            <input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              style={{
                width: "100%", marginTop: 6, marginBottom: 14, padding: 12,
                borderRadius: 12, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                fontSize: ".9rem",
              }}
            />

            <label style={{ fontSize: ".78rem", color: "#94a3b8", fontWeight: 700 }}>
              Zainteresowania (oddziel przecinkami)
            </label>
            <input
              value={editInterests}
              onChange={(e) => setEditInterests(e.target.value)}
              style={{
                width: "100%", marginTop: 6, marginBottom: 14, padding: 12,
                borderRadius: 12, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                fontSize: ".9rem",
              }}
            />


            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 700,
                }}
              >Anuluj</button>
              <button
                onClick={saveEdit}
                style={{
                  padding: "10px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
                  cursor: "pointer", fontWeight: 800,
                }}
              >Zapisz</button>
            </div>
          </div>
        </div>
      )}


      {/* CHANGE PASSWORD MODAL */}
      {changePasswordDialogOpen && (
        <div
          onClick={() => setChangePasswordDialogOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16, backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a", borderRadius: 20, padding: 24,
              maxWidth: 420, width: "100%",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: 16 }}>
              🔐 Zmień hasło
            </h3>

            <label style={{ fontSize: ".78rem", color: "#94a3b8", fontWeight: 700 }}>
              Nowe hasło (min. 6 znaków)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
              style={{
                width: "100%", marginTop: 6, marginBottom: 18, padding: 12,
                borderRadius: 12, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                fontSize: ".9rem",
              }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setChangePasswordDialogOpen(false); setNewPassword(""); }}
                style={{
                  padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 700,
                }}
              >Anuluj</button>
              <button
                onClick={async () => {
                  if (newPassword.length < 6) {
                    toast.error("Hasło musi mieć co najmniej 6 znaków");
                    return;
                  }
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) {
                    toast.error("Błąd zmiany hasła: " + error.message);
                  } else {
                    toast.success("Hasło zostało zmienione");
                    setChangePasswordDialogOpen(false);
                    setNewPassword("");
                  }
                }}
                style={{
                  padding: "10px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
                  cursor: "pointer", fontWeight: 800,
                }}
              >Zmień hasło</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION */}
      <AlertDialog
        open={deleteAccountDialogOpen}
        onOpenChange={setDeleteAccountDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć konto na zawsze?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja jest nieodwracalna. Twój profil i powiązane dane zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              style={{ background: "#ef4444", color: "#fff" }}
            >
              Tak, usuń konto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default SettingsTab;