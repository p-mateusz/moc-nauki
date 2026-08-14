import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { logoutUser } from "@/lib/authCleanup";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { getSessionSafe } from "@/lib/authSession";
import { Seo } from "@/components/Seo";

const features = [
  "Zautomatyzowane notatki AI z lekcji",
  "Nieograniczone fiszki i zadania z lukami",
  "Czat z nauczycielem 24/7",
  "Inteligentny kalendarz i przypomnienia",
  "Baza poprzednich testów twoich nauczycieli",
  "Ranking i tryb rywalizacji ze znajomymi",
];

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get("plan");
  const checkoutStatus = searchParams.get("checkout");
  const autostart = searchParams.get("autostart") === "1";
  const [isYearly, setIsYearly] = useState(initialPlan === "90");
  const [loading, setLoading] = useState(false);
  const access = useAccessGuard();
  const autoStartedRef = useRef(false);
  const successHandledRef = useRef(false);

  useEffect(() => {
    if (checkoutStatus === "success") {
      if (!successHandledRef.current) {
        successHandledRef.current = true;
        toast.success("Płatność zarejestrowana! Aktywujemy Twój dostęp…");
      }
      // Webhook Stripe może mieć kilka sekund opóźnienia — odświeżamy sesję,
      // co wywołuje onAuthStateChange i ponowny load w useAccessGuard.
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts += 1;
        supabase.auth.refreshSession().catch(() => {});
        if (attempts >= 12) window.clearInterval(id); // ~36s
      }, 3000);
      return () => window.clearInterval(id);
    }
    if (checkoutStatus === "cancelled" && !successHandledRef.current) {
      successHandledRef.current = true;
      toast.warning("Płatność anulowana — możesz spróbować ponownie.");
    }
  }, [checkoutStatus]);

  useEffect(() => {
    if (!access.loading && access.hasAccess) {
      navigate("/dashboard", { replace: true });
    }
  }, [access.loading, access.hasAccess, navigate]);

  const plan = isYearly
    ? { price: "89", period: "90 dni", saving: "Bez podpinania karty", key: "90" as const }
    : { price: "29", period: "30 dni", saving: null, key: "30" as const };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const session = await getSessionSafe(2500);
      if (!session) {
        navigate("/login");
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: plan.key },
      });
      if (error) throw error;
      if (data?.url) {
        try { localStorage.removeItem("pendingPlan"); } catch {}
        window.location.href = data.url;
      } else {
        throw new Error("Brak adresu sesji Stripe");
      }
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się utworzyć sesji płatności");
    } finally {
      setLoading(false);
    }
  };

  // Po świeżej rejestracji z preselekcją planu — automatycznie startujemy checkout.
  useEffect(() => {
    if (!autostart || autoStartedRef.current) return;
    if (access.loading || access.hasAccess) return;
    autoStartedRef.current = true;
    handleCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, access.loading, access.hasAccess]);

  return (
    <>
    <Seo title="Dostęp do Moc Nauki — zapisy na testy przedpremierowe" description="Moc Nauki to platforma edukacyjna AI — automatyczne notatki, kalendarz, nauczyciel 24/7, fiszki i quizy. Trwają zamknięte zapisy na testy przedpremierowe." path="/pricing" />
    <div style={{
      position: "fixed", inset: 0, zIndex: 1, background: "#060d1a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", overflowY: "auto", fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1, paddingBottom: 40 }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff", margin: 0 }}>
            Wybierz plan
          </h1>
          <p style={{ fontSize: ".88rem", color: "#94a3b8", marginTop: 8 }}>
            Twój dostęp do Mocy Nauki nie jest aktywny. Wybierz plan, żeby kontynuować.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
          <span style={{ fontWeight: 700, color: !isYearly ? "#f1f5f9" : "#475569" }}>30 dni</span>
          <div onClick={() => setIsYearly(!isYearly)} style={{
            width: 56, height: 30, borderRadius: 999,
            background: isYearly ? "linear-gradient(135deg, #f59e0b, #f97316)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
            position: "relative", cursor: "pointer",
          }}>
            <motion.div animate={{ x: isYearly ? 28 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{ position: "absolute", top: 3, width: 24, height: 24, borderRadius: "50%", background: "#111827" }} />
          </div>
          <span style={{ fontWeight: 700, color: isYearly ? "#f1f5f9" : "#475569" }}>
            90 dni
          </span>
        </div>

        <div style={{
          background: "#0f1117",
          border: isYearly ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(59,130,246,0.25)",
          borderRadius: 20, overflow: "hidden",
        }}>
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: "3rem", fontWeight: 900, color: "#f1f5f9" }}>{plan.price}</span>
              <span style={{ fontSize: "1.1rem", color: "#94a3b8" }}>zł</span>
              <span style={{ fontSize: ".85rem", color: "#64748b", marginLeft: 4 }}>/ {plan.period}</span>
            </div>
            {plan.saving && <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#4ade80", marginTop: 4 }}>✓ {plan.saving}</div>}
          </div>
          <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {features.map(f => (
              <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: ".82rem", color: "#cbd5e1" }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "0 24px 24px" }}>
            <button onClick={handleCheckout} disabled={loading} style={{
              width: "100%", padding: "14px",
              background: isYearly ? "linear-gradient(135deg, #f59e0b, #f97316)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: ".95rem",
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Przekierowywanie…" : `Zapłać ${plan.price} zł →`}
            </button>
            <div style={{ textAlign: "center", fontSize: ".7rem", color: "#475569", marginTop: 10 }}>
              🔒 Płatność obsługiwana przez Stripe
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 18 }}>
          <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: ".85rem" }}>
            ← Dashboard
          </button>
          <button onClick={async () => { 
            try {
              const { timedOut, error } = await logoutUser();
              if (timedOut || error) {
                toast.warning("Błąd podczas wylogowywania — zakończono lokalnie");
              } else {
                toast.success("Wylogowano pomyślnie");
              }
            } catch (err) {
              console.error("logout error:", err);
              toast.warning("Błąd podczas wylogowywania — zakończono lokalnie");
            } finally {
              navigate("/login", { replace: true });
            }
          }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: ".85rem" }}>
            Wyloguj
          </button>
        </div>
      </motion.div>
    </div>
    </>
  );
}
