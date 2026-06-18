import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Props = { open: boolean; onClose: () => void };

type Links = { android?: string; ios?: string };

const DownloadAppDialog = ({ open, onClose }: Props) => {
  const [links, setLinks] = useState<Links>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", ["app_download_android_url", "app_download_ios_url"]);
        const map: Links = {};
        (data || []).forEach((r: { key: string; value: unknown }) => {
          if (r.key === "app_download_android_url" && typeof r.value === "string") map.android = r.value;
          if (r.key === "app_download_ios_url" && typeof r.value === "string") map.ios = r.value;
        });
        setLinks(map);
      } catch {
        // ignore — links pozostają puste
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  };

  const btn = (enabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 12,
    border: "none",
    background: enabled
      ? "linear-gradient(135deg,#3b82f6,#6366f1)"
      : "rgba(255,255,255,0.06)",
    color: enabled ? "#fff" : "#94a3b8",
    fontWeight: 800,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: ".88rem",
    textDecoration: "none",
    width: "100%",
  });

  const open_ = (url?: string) => {
    if (!url) {
      toast.info("Wersja jest jeszcze przygotowywana — zajrzyj wkrótce.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

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
          background: "#0f172a", borderRadius: 20, padding: 22,
          maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: 6 }}>
          📱 Pobierz aplikację Moc Nauki
        </h3>
        <p style={{ fontSize: ".82rem", color: "#94a3b8", marginBottom: 16 }}>
          Aplikacja natywna daje pełny dostęp do mikrofonu w tle, powiadomień
          i działa nawet przy zablokowanym ekranie.
        </p>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "1.4rem" }}>🤖</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: ".95rem" }}>Android</div>
              <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>
                Plik instalacyjny APK
              </div>
            </div>
          </div>
          <button
            onClick={() => open_(links.android)}
            disabled={loading}
            style={btn(!!links.android && !loading)}
          >
            {loading ? "Ładowanie…" : links.android ? "⬇️ Pobierz na Android" : "Wkrótce dostępne"}
          </button>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "1.4rem" }}>🍎</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: ".95rem" }}>iPhone / iPad</div>
              <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>
                Przez TestFlight lub App Store
              </div>
            </div>
          </div>
          <button
            onClick={() => open_(links.ios)}
            disabled={loading}
            style={btn(!!links.ios && !loading)}
          >
            {loading ? "Ładowanie…" : links.ios ? "⬇️ Otwórz w TestFlight" : "Wkrótce dostępne"}
          </button>
        </div>

        <div
          style={{
            ...card,
            background: "rgba(99,102,241,0.08)",
            borderColor: "rgba(99,102,241,0.25)",
          }}
        >
          <div style={{ fontSize: ".78rem", color: "#cbd5e1", lineHeight: 1.55 }}>
            💡 Jeśli linki są nieaktywne, finalizujemy jeszcze wersję na Twój
            system. Tymczasem możesz „Dodać do ekranu głównego" z menu
            przeglądarki — działa jak aplikacja.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
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

export default DownloadAppDialog;
