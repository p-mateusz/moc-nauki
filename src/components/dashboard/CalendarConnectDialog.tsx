import { useState, useEffect } from "react";
import { toast } from "sonner";
import { invokeCloudFunction } from "@/lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

const buildWebcalUrl = (token: string) =>
  `webcal://${PROJECT_ID}.supabase.co/functions/v1/calendar-ics?token=${encodeURIComponent(token)}`;

const buildHttpsUrl = (token: string) =>
  `https://${PROJECT_ID}.supabase.co/functions/v1/calendar-ics?token=${encodeURIComponent(token)}`;

const CalendarConnectDialog = ({ open, onClose }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await invokeCloudFunction<{ token: string | null }>("manage-calendar-feed", {
          body: { action: "get" },
        });
        if (cancelled) return;
        setToken(data?.token || null);
      } catch (e: any) {
        toast.error("Nie udało się pobrać linku do kalendarza");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const handleRegenerate = async () => {
    if (!confirm("Wygenerować nowy link? Stary link przestanie działać.")) return;
    setRegenerating(true);
    try {
      const data = await invokeCloudFunction<{ token: string | null }>("manage-calendar-feed", {
        body: { action: "regenerate" },
      });
      setToken(data?.token || null);
      toast.success("Wygenerowano nowy link");
    } catch (e) {
      toast.error("Nie udało się wygenerować linku");
    } finally {
      setRegenerating(false);
    }
  };

  const copyLink = async () => {
    if (!token) return;
    const url = buildHttpsUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link skopiowany");
    } catch {
      toast.error("Nie udało się skopiować");
    }
  };

  const openInApple = () => {
    if (!token) return;
    window.location.href = buildWebcalUrl(token);
  };

  const httpsUrl = token ? buildHttpsUrl(token) : "";

  return (
    <div
      onClick={onClose}
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
          maxWidth: 520, width: "100%", maxHeight: "85vh", overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: 6, color: "#fff" }}>
          📅 Połącz kalendarz Apple / iCloud
        </h3>
        <p style={{ fontSize: ".82rem", color: "#94a3b8", marginBottom: 18, lineHeight: 1.5 }}>
          Subskrybuj swoje wydarzenia w aplikacji Kalendarz na iPhonie/Macu. Każde nowe wydarzenie
          (również dodane automatycznie z notatki) pojawi się tam w ciągu kilku godzin.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: 30 }}>Ładowanie…</div>
        ) : !token ? (
          <div style={{ color: "#fca5a5", marginBottom: 16 }}>Nie udało się załadować linku.</div>
        ) : (
          <>
            <label style={{ fontSize: ".72rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              Twój prywatny link
            </label>
            <input
              readOnly
              value={httpsUrl}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: "100%", marginTop: 6, marginBottom: 12, padding: 10,
                borderRadius: 10, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                fontSize: ".78rem", fontFamily: "monospace",
              }}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <button
                onClick={openInApple}
                style={{
                  flex: "1 1 200px", padding: "11px 16px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
                  cursor: "pointer", fontWeight: 800, fontSize: ".85rem",
                }}
              >📲 Dodaj do Apple Calendar</button>
              <button
                onClick={copyLink}
                style={{
                  flex: "1 1 140px", padding: "11px 16px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "#fff",
                  cursor: "pointer", fontWeight: 700, fontSize: ".85rem",
                }}
              >📋 Kopiuj link</button>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: 14, marginBottom: 14,
            }}>
              <div style={{ fontSize: ".78rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                📱 Jak dodać na iPhonie
              </div>
              <ol style={{ fontSize: ".76rem", color: "#cbd5e1", paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>
                <li>Ustawienia → Kalendarz → Konta → Dodaj konto</li>
                <li>Inne → Dodaj subskrybowany kalendarz</li>
                <li>Wklej link powyżej i potwierdź</li>
              </ol>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: 14, marginBottom: 14,
            }}>
              <div style={{ fontSize: ".78rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                💻 Jak dodać na Macu
              </div>
              <ol style={{ fontSize: ".76rem", color: "#cbd5e1", paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>
                <li>Otwórz aplikację Kalendarz</li>
                <li>Menu Plik → Nowa subskrypcja kalendarza…</li>
                <li>Wklej link i kliknij Subskrybuj</li>
              </ol>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                width: "100%", padding: "10px", borderRadius: 12,
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.08)", color: "#fca5a5",
                cursor: "pointer", fontWeight: 700, fontSize: ".8rem",
                marginBottom: 4, opacity: regenerating ? 0.5 : 1,
              }}
            >🔄 Wygeneruj nowy link (unieważnia stary)</button>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 700,
            }}
          >Zamknij</button>
        </div>
      </div>
    </div>
  );
};

export default CalendarConnectDialog;
