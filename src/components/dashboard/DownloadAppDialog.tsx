import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Props = { open: boolean; onClose: () => void };

type Links = {
  android?: string;
  windows?: string;
  macos?: string;
};

const DownloadAppDialog = ({ open, onClose }: Props) => {
  const [links, setLinks] = useState<Links>({});
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
          .in("key", [
            "app_download_android_url",
            "app_download_windows_url",
            "app_download_macos_url",
          ]);
        const map: Links = {};
        (data || []).forEach((r: { key: string; value: unknown }) => {
          if (typeof r.value !== "string") return;
          if (r.key === "app_download_android_url") map.android = r.value;
          if (r.key === "app_download_windows_url") map.windows = r.value;
          if (r.key === "app_download_macos_url") map.macos = r.value;
        });
        setLinks(map);
      } catch {
        // brak linków = przyciski "wkrótce"
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

  const open_ = (url?: string) => {
    if (!url) {
      toast.info("Wersja jest jeszcze przygotowywana — zajrzyj wkrótce.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  type Platform = {
    icon: string;
    title: string;
    sub: string;
    url?: string;
    label: string;
  };

  const platforms: Platform[] = [
    {
      icon: "🤖",
      title: "Android",
      sub: "Plik APK — instalacja jednym kliknięciem",
      url: links.android,
      label: "⬇️ Pobierz APK",
    },
    {
      icon: "🪟",
      title: "Windows",
      sub: "Instalator .exe — bez Microsoft Store",
      url: links.windows,
      label: "⬇️ Pobierz dla Windows",
    },
    {
      icon: "🖥️",
      title: "macOS",
      sub: "Plik .dmg — bez Mac App Store",
      url: links.macos,
      label: "⬇️ Pobierz dla Mac",
    },
  ];

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
          Aplikacja natywna daje pełny dostęp do mikrofonu w tle i działa nawet
          przy zablokowanym ekranie. Pobierasz bezpośrednio od nas — żadnego
          sklepu, żadnego konta.
        </p>

        {platforms.map((p) => (
          <div key={p.title} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: "1.4rem" }}>{p.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: ".95rem" }}>{p.title}</div>
                <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>{p.sub}</div>
              </div>
            </div>
            <button
              onClick={() => open_(p.url)}
              disabled={loading}
              style={btn(!!p.url && !loading)}
            >
              {loading ? "Ładowanie…" : p.url ? p.label : "Wkrótce dostępne"}
            </button>
          </div>
        ))}

        {/* iOS — PWA only */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "1.4rem" }}>🍎</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: ".95rem" }}>iPhone / iPad</div>
              <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>
                Dodaj do ekranu głównego z Safari (Apple nie pozwala na instalację spoza App Store)
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
            {showIosHelp ? "Ukryj instrukcję" : "Pokaż instrukcję krok po kroku"}
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
              <li>Otwórz <strong>nauki.lovable.app</strong> w przeglądarce <strong>Safari</strong> (nie Chrome).</li>
              <li>Dotknij ikony udostępniania <strong>⬆️</strong> na dolnym pasku.</li>
              <li>Wybierz „<strong>Do ekranu początkowego</strong>" / „<strong>Add to Home Screen</strong>".</li>
              <li>Potwierdź „Dodaj". Ikona Moc Nauki pojawi się jak normalna aplikacja.</li>
            </ol>
          )}
        </div>

        <div
          style={{
            ...card,
            background: "rgba(99,102,241,0.08)",
            borderColor: "rgba(99,102,241,0.25)",
          }}
        >
          <div style={{ fontSize: ".78rem", color: "#cbd5e1", lineHeight: 1.55 }}>
            💡 Pliki Android / Windows / Mac są podpisane i pobierasz je
            bezpośrednio od nas. System może raz zapytać o zgodę na instalację
            aplikacji „spoza sklepu" — to normalne.
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
