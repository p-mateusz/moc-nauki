import { useEffect, useState } from "react";
import { toast } from "sonner";
import { invokeCloudFunction } from "@/lib/supabase";

type Props = { open: boolean; onClose: () => void };

type SettingRow = { key: string; value: unknown };

const AdminAppLinksDialog = ({ open, onClose }: Props) => {
  const [androidUrl, setAndroidUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const res = await invokeCloudFunction<SettingRow[]>("manage-app-settings", {
          body: { action: "get", keys: ["app_download_android_url"] },
        });
        const row = (res || []).find((r) => r.key === "app_download_android_url");
        setAndroidUrl(typeof row?.value === "string" ? (row.value as string) : "");
      } catch {
        toast.error("Nie udało się pobrać aktualnego linku");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const save = async () => {
    const url = androidUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Link musi zaczynać się od http:// lub https://");
      return;
    }
    setSaving(true);
    try {
      await invokeCloudFunction("manage-app-settings", {
        body: {
          action: "set",
          key: "app_download_android_url",
          value: url,
        },
      });
      toast.success(url ? "Link zapisany — użytkownicy mogą już pobrać APK" : "Link wyczyszczony");
      onClose();
    } catch {
      toast.error("Zapis nie powiódł się");
    } finally {
      setSaving(false);
    }
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
          maxWidth: 520, width: "100%", maxHeight: "85vh", overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: 6 }}>
          🛠️ Link do pobrania aplikacji (Android)
        </h3>
        <p style={{ fontSize: ".8rem", color: "#94a3b8", marginBottom: 16, lineHeight: 1.55 }}>
          Wklej publiczny link do pliku <strong>.apk</strong>. Najprostsze
          darmowe opcje hostowania:
        </p>

        <ul style={{ fontSize: ".78rem", color: "#cbd5e1", paddingLeft: 18, marginBottom: 16, lineHeight: 1.7 }}>
          <li><strong>GitHub Releases</strong> — załaduj APK jako asset, użyj „Direct download URL"</li>
          <li><strong>Dropbox / Google Drive</strong> — udostępnij publicznie, link z <code>?dl=1</code></li>
          <li><strong>Własny serwer / S3</strong> — dowolny publiczny URL kończący się na <code>.apk</code></li>
        </ul>

        <div
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
            fontSize: ".75rem",
            color: "#fde68a",
            lineHeight: 1.55,
          }}
        >
          ℹ️ Lovable Cloud Storage ma zablokowane publiczne buckety w tym
          workspace, dlatego trzeba hostować APK gdzie indziej. (Możesz to
          odblokować w Settings → Privacy & Security jako owner workspace.)
        </div>

        <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
          Publiczny URL do APK
        </label>
        <input
          type="url"
          value={androidUrl}
          onChange={(e) => setAndroidUrl(e.target.value)}
          placeholder="https://github.com/.../MocNauki.apk"
          disabled={loading || saving}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "#fff",
            fontSize: ".88rem",
            marginBottom: 16,
          }}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 700,
            }}
          >Anuluj</button>
          <button
            onClick={save}
            disabled={loading || saving}
            style={{
              padding: "10px 18px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: "#fff", cursor: "pointer", fontWeight: 800,
              opacity: loading || saving ? 0.6 : 1,
            }}
          >{saving ? "Zapisywanie…" : "Zapisz link"}</button>
        </div>

        <div style={{ marginTop: 18, fontSize: ".72rem", color: "#64748b", lineHeight: 1.5 }}>
          💡 Jak zbudować APK lokalnie:<br />
          <code style={{ color: "#94a3b8" }}>git pull && npm install && npm run build && npx cap add android && npx cap sync && cd android && ./gradlew assembleRelease</code><br />
          Wynik: <code>android/app/build/outputs/apk/release/app-release.apk</code>
        </div>
      </div>
    </div>
  );
};

export default AdminAppLinksDialog;
