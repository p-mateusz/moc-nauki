import { useEffect, useState } from "react";
import { toast } from "sonner";
import { invokeCloudFunction } from "@/lib/supabase";
import { resolveFreeAccountsEnabled, resolveFreeAccountDays } from "@/lib/feeExempt";

type Props = { open: boolean; onClose: () => void };

type SettingRow = { key: string; value: unknown };

const AdminAppLinksDialog = ({ open, onClose }: Props) => {
  const [androidUrl, setAndroidUrl] = useState("");
  const [pay30, setPay30] = useState("");
  const [pay90, setPay90] = useState("");
  const [lockTabs, setLockTabs] = useState(false);
  const [allFeeExempt, setAllFeeExempt] = useState(true);
  const [freeDays, setFreeDays] = useState("365");
  const [togglingExempt, setTogglingExempt] = useState(false);
  const [togglingTabs, setTogglingTabs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const res = await invokeCloudFunction<SettingRow[]>("manage-app-settings", {
          body: {
            action: "get",
            keys: ["app_download_android_url", "payment_link_30", "payment_link_90", "lock_community_tabs", "all_fee_exempt", "free_account_days"],
          },
        });
        const pick = (key: string) => {
          const row = (res || []).find((r) => r.key === key);
          return typeof row?.value === "string" ? (row.value as string) : "";
        };
        setAndroidUrl(pick("app_download_android_url"));
        setPay30(pick("payment_link_30"));
        setPay90(pick("payment_link_90"));
        setLockTabs(pick("lock_community_tabs") === "true");
        setAllFeeExempt(resolveFreeAccountsEnabled(pick("all_fee_exempt") || undefined));
        setFreeDays(String(resolveFreeAccountDays(pick("free_account_days") || undefined)));
      } catch {
        toast.error("Nie udało się pobrać aktualnego linku");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const toggleLockTabs = async () => {
    const next = !lockTabs;
    setTogglingTabs(true);
    try {
      await invokeCloudFunction("manage-app-settings", {
        body: { action: "set", key: "lock_community_tabs", value: next ? "true" : "false" },
      });
      setLockTabs(next);
      window.dispatchEvent(new CustomEvent("communityTabsLockChanged", { detail: next }));
      toast.success(next ? "Zakładki zablokowane („Dostępne wkrótce”)" : "Zakładki odblokowane");
    } catch {
      toast.error("Nie udało się zmienić ustawienia");
    } finally {
      setTogglingTabs(false);
    }
  };

  const toggleAllFeeExempt = async () => {
    const next = !allFeeExempt;
    if (!next && !window.confirm("Wyłączyć zwolnienie z opłat? Wszyscy uczniowie ze statusem zwolnienia stracą go.")) return;
    setTogglingExempt(true);
    try {
      await invokeCloudFunction("manage-app-settings", {
        body: { action: "set_all_fee_exempt", value: next },
      });
      setAllFeeExempt(next);
      toast.success(next ? "Wszyscy zwolnieni z opłat — rejestracja bez wyboru planu" : "Przywrócono opłaty i cofnięto zwolnienia");
    } catch {
      toast.error("Nie udało się zmienić ustawienia");
    } finally {
      setTogglingExempt(false);
    }
  };

  const save = async () => {
    const url = androidUrl.trim();
    const link30 = pay30.trim();
    const link90 = pay90.trim();
    const entries: Array<[string, string]> = [
      ["app_download_android_url", url],
      ["payment_link_30", link30],
      ["payment_link_90", link90],
      ["free_account_days", String(resolveFreeAccountDays(freeDays))],
    ];
    for (const [k, v] of entries) {
      if (k === "free_account_days") continue;
      if (v && !/^https:\/\//i.test(v) && !/^http:\/\//i.test(v)) {
        toast.error("Każdy link musi zaczynać się od http:// lub https://");
        return;
      }
    }
    setSaving(true);
    try {
      for (const [key, value] of entries) {
        await invokeCloudFunction("manage-app-settings", {
          body: { action: "set", key, value },
        });
      }
      toast.success("Ustawienia zapisane");
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

        <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: "8px 0 6px" }}>
          🚧 Tymczasowe przełączniki
        </h3>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 12, marginBottom: 10,
        }}>
          <div style={{ fontSize: ".8rem", lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800 }}>Zablokuj „Uczniowie” i „Nauczyciele”</div>
            <div style={{ color: "#94a3b8", fontSize: ".72rem" }}>
              Zakładki zostają widoczne, ale przekreślone i oznaczone „Dostępne wkrótce”.
            </div>
          </div>
          <button
            onClick={toggleLockTabs}
            disabled={loading || togglingTabs}
            style={{
              padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 800, fontSize: ".78rem", whiteSpace: "nowrap", color: "#fff",
              background: lockTabs ? "linear-gradient(135deg,#f87171,#ef4444)" : "rgba(255,255,255,0.1)",
              opacity: loading || togglingTabs ? 0.6 : 1,
            }}
          >{lockTabs ? "Odblokuj" : "Zablokuj"}</button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 12, marginBottom: 16,
        }}>
          <div style={{ fontSize: ".8rem", lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800 }}>Zwolnij wszystkich z opłat</div>
            <div style={{ color: "#94a3b8", fontSize: ".72rem" }}>
              Rejestracja bez wyboru planu, nowe konta od razu zwolnione. Wyłączenie cofa
              zwolnienie wszystkim uczniom.
            </div>
          </div>
          <button
            onClick={toggleAllFeeExempt}
            disabled={loading || togglingExempt}
            style={{
              padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 800, fontSize: ".78rem", whiteSpace: "nowrap", color: "#fff",
              background: allFeeExempt ? "linear-gradient(135deg,#f87171,#ef4444)" : "linear-gradient(135deg,#34d399,#10b981)",
              opacity: loading || togglingExempt ? 0.6 : 1,
            }}
          >{allFeeExempt ? "Wyłącz" : "Włącz"}</button>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 12, marginBottom: 16,
        }}>
          <div style={{ fontWeight: 800, fontSize: ".8rem", marginBottom: 4 }}>
            Długość darmowego dostępu (dni)
          </div>
          <div style={{ color: "#94a3b8", fontSize: ".72rem", marginBottom: 8, lineHeight: 1.5 }}>
            Nowe konta dostają zwolnienie z opłat na tyle dni. Zapisz przyciskiem „Zapisz ustawienia”.
          </div>
          <input
            type="number"
            min={1}
            max={3650}
            value={freeDays}
            onChange={(e) => setFreeDays(e.target.value)}
            disabled={loading || saving}
            style={{
              width: 120, padding: "9px 12px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: "#fff", fontSize: ".85rem",
            }}
          />
        </div>


        <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: "8px 0 6px" }}>
          💳 Linki do płatności
        </h3>
        <p style={{ fontSize: ".78rem", color: "#94a3b8", marginBottom: 12, lineHeight: 1.55 }}>
          Jeśli wpiszesz link (np. Stripe Payment Link), użytkownik po kliknięciu
          „Wykup dostęp" trafi prosto pod ten adres. Puste pole = standardowy
          checkout tworzony przez system.
        </p>

        <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
          Plan 30-dniowy (29 zł)
        </label>
        <input
          type="url"
          value={pay30}
          onChange={(e) => setPay30(e.target.value)}
          placeholder="https://buy.stripe.com/..."
          disabled={loading || saving}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
            color: "#fff", fontSize: ".88rem", marginBottom: 12,
          }}
        />

        <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
          Plan 90-dniowy (89 zł)
        </label>
        <input
          type="url"
          value={pay90}
          onChange={(e) => setPay90(e.target.value)}
          placeholder="https://buy.stripe.com/..."
          disabled={loading || saving}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
            color: "#fff", fontSize: ".88rem", marginBottom: 16,
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
          >{saving ? "Zapisywanie…" : "Zapisz ustawienia"}</button>
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
