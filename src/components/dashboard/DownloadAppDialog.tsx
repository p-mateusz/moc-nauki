import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Props = { open: boolean; onClose: () => void };

const DownloadAppDialog = ({ open, onClose }: Props) => {
  const [androidUrl, setAndroidUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowIosHelp(false);
    (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value")
          .eq("key", "app_download_android_url")
          .maybeSingle();
        if (data && typeof data.value === "string") setAndroidUrl(data.value);
        else setAndroidUrl(undefined);
      } catch {
        setAndroidUrl(undefined);
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
    width: "100%",
  });

  const downloadApk = () => {
    if (!androidUrl) {
      toast.info("APK jeszcze nie zostało wgrane.");
      return;
    }
    window.location.href = androidUrl;
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
          maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: 6 }}>
          📱 Pobierz aplikację Moc Nauki
        </h3>
        <p style={{ fontSize: ".82rem", color: "#94a3b8", marginBottom: 16 }}>
          Aplikacja natywna na Androida daje pełny dostęp do mikrofonu w tle —
          możesz nagrywać lekcję nawet przy zablokowanym ekranie. Pobierasz
          bezpośrednio od nas, bez Google Play.
        </p>

        {/* Android */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "1.4rem" }}>🤖</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: ".95rem" }}>Android</div>
              <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>
                Plik APK — bez Google Play
              </div>
            </div>
          </div>
          <button
            onClick={downloadApk}
            disabled={loading || !androidUrl}
            style={btn(!!androidUrl && !loading)}
          >
            {loading ? "Ładowanie…" : androidUrl ? "⬇️ Pobierz APK" : "Wkrótce dostępne"}
          </button>
          {androidUrl && (
            <div style={{ fontSize: ".7rem", color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
              Po pobraniu otwórz plik. Android może raz zapytać o zgodę na
              instalację „z nieznanego źródła" — to normalne przy pobieraniu
              spoza sklepu.
            </div>
          )}
        </div>

        {/* iOS — PWA only */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "1.4rem" }}>🍎</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: ".95rem" }}>iPhone / iPad</div>
              <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>
                Apple blokuje instalację spoza App Store — używamy PWA
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowIosHelp((v) => !v)}
            style={{
              ...btn(true),
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
            }}
          >
            {showIosHelp ? "Ukryj instrukcję" : "Jak dodać do ekranu głównego"}
          </button>
          {showIosHelp && (
            <ol
              style={{
                marginTop: 12,
                paddingLeft: 18,
                fontSize: ".82rem",
                color: "#cbd5e1",
                lineHeight: 1.65,
              }}
            >
              <li>Otwórz <strong>www.moc-nauki.pl</strong> w przeglądarce <strong>Safari</strong>.</li>
              <li>Dotknij ikony udostępniania <strong>⬆️</strong> na dolnym pasku.</li>
              <li>Wybierz „<strong>Do ekranu początkowego</strong>".</li>
              <li>Potwierdź „Dodaj". Ikona pojawi się jak normalna aplikacja.</li>
            </ol>
          )}
        </div>

        {/* Desktop note */}
        <div
          style={{
            ...card,
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ fontSize: ".78rem", color: "#94a3b8", lineHeight: 1.55 }}>
            🖥️ <strong>Komputer (Windows / Mac):</strong> używaj po prostu
            przeglądarki — na desktopie nagrywanie w tle działa bez aplikacji
            natywnej.
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
