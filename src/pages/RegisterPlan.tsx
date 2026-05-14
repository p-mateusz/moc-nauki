import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const STRIPE_LINK_30_DNI = "https://buy.stripe.com/5kQ4gy4Qy3321DB24Bco000";
const STRIPE_LINK_90_DNI = "https://buy.stripe.com/bJe8wO3MufPOeqncJfco001";

const features = [
  "Zautomatyzowane notatki AI z lekcji",
  "Nieograniczone fiszki i zadania z lukami",
  "Czat z nauczycielem 24/7",
  "Inteligentny kalendarz i przypomnienia",
  "Baza poprzednich testów twoich nauczycieli",
  "Ranking i tryb rywalizacji ze znajomymi",
];

export default function RegisterPlan() {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "registration_enabled")
          .single();
        setRegistrationEnabled((data as any)?.value !== "false");
      } catch {
        setRegistrationEnabled(true);
      }
    };
    check();
  }, []);

  const plan = isYearly
    ? { price: "89", period: "90 dni", saving: "Bez podpinania karty", link: STRIPE_LINK_90_DNI, key: "90" }
    : { price: "29", period: "30 dni", saving: "Anuluj kiedy chcesz", link: STRIPE_LINK_30_DNI, key: "30" };

  const handleCheckout = () => {
    try { localStorage.setItem("pendingPlan", plan.key); } catch {}
    window.location.href = plan.link;
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060d1a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px 60px",
      overflowX: "hidden",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative",
    }}>
      {/* Blobs */}
      <div style={{
        position: "fixed", top: "-20%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", right: "-10%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%",
          maxWidth: 460,
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#3b82f6", letterSpacing: ".12em", marginBottom: 8 }}>
            MOC NAUKI
          </div>
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.2 }}>
            Pełny dostęp.<br />
            <span style={{ background: "linear-gradient(90deg, #3b82f6, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Jeden plan.
            </span>
          </h1>
          <p style={{ fontSize: ".85rem", color: "#8899b4", marginTop: 8 }}>
            Wszystkie funkcje bez względu na wybrany okres.
          </p>
        </div>

        {registrationEnabled === false ? (
          <div style={{
            background: "#0f1117",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "36px 28px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>🚫</div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>
              Rejestracja tymczasowo wyłączona
            </h2>
            <p style={{ color: "#8899b4", fontSize: ".88rem", lineHeight: 1.6, marginBottom: 20 }}>
              Obecnie nie przyjmujemy nowych rejestracji. Śledź nasze aktualności i bądź na bieżąco z nowościami!
            </p>
            <button
              onClick={() => window.open("https://www.instagram.com/mocnauki_official?igsh=cTBrMW50am5wdXR6&utm_source=qr", "_blank")}
              style={{
                background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8,
                fontSize: ".88rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
              }}
            >📷 Instagram</button>
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 16, marginBottom: 24,
            }}>
              <span style={{
                fontSize: ".95rem", fontWeight: 700,
                color: !isYearly ? "#f1f5f9" : "#475569",
                transition: "color .2s",
              }}>30 dni</span>

              <div
                onClick={() => setIsYearly(!isYearly)}
                style={{
                  width: 56, height: 30, borderRadius: 999,
                  background: isYearly
                    ? "linear-gradient(135deg, #d4af37, #aa8c2c)"
                    : "linear-gradient(135deg, #3b82f6, #2563eb)",
                  position: "relative", cursor: "pointer",
                  boxShadow: isYearly
                    ? "0 0 16px rgba(212,175,55,0.4)"
                    : "0 0 16px rgba(59,130,246,0.4)",
                  flexShrink: 0,
                  transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <motion.div
                  animate={{ x: isYearly ? 28 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{
                    position: "absolute", top: 3,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "#111827",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                  }}
                />
              </div>

              <span style={{
                fontSize: ".95rem", fontWeight: 700,
                color: isYearly ? "#f1f5f9" : "#475569",
                transition: "color .2s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                90 dni
              </span>
            </div>

            {/* Card */}
            <div style={{
              background: isYearly
                ? "linear-gradient(135deg, rgba(212,175,55,0.1), rgba(170,140,44,0.08))"
                : "#0f1117",
              border: isYearly
                ? "1px solid rgba(212,175,55,0.4)"
                : "1px solid rgba(59,130,246,0.25)",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: isYearly
                ? "0 0 60px rgba(212,175,55,0.15), 0 24px 48px rgba(0,0,0,0.5)"
                : "0 0 60px rgba(59,130,246,0.1), 0 24px 48px rgba(0,0,0,0.5)",
              transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
            }}>

              {/* Price */}
              <div style={{
                padding: "24px 24px 20px",
                borderBottom: isYearly
                  ? "1px solid rgba(212,175,55,0.2)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: isYearly
                  ? "rgba(212,175,55,0.08)"
                  : "rgba(59,130,246,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <motion.span
                        key={plan.price}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ fontSize: "3rem", fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}
                      >
                        {plan.price}
                      </motion.span>
                      <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#94a3b8" }}>zł</span>
                      <span style={{ fontSize: ".85rem", color: "#64748b", marginLeft: 4 }}>/ {plan.period}</span>
                    </div>
                    {plan.saving ? (
                      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#4ade80", marginTop: 4 }}>
                        ✓ {plan.saving}
                      </div>
                    ) : (
                      <div style={{ fontSize: ".72rem", color: "#8899b4", marginTop: 4 }}>
                        Odnawia się automatycznie, anuluj kiedy chcesz
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "2.4rem" }}>🎓</div>
                </div>
              </div>

              {/* Features */}
              <div style={{ padding: "16px 24px" }}>
                <div style={{ fontSize: ".62rem", fontWeight: 700, color: "#697d99", letterSpacing: ".1em", marginBottom: 10 }}>
                  CO OTRZYMUJESZ
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{
                        color: "#4ade80", fontSize: ".65rem", flexShrink: 0,
                        width: 16, height: 16, background: "rgba(74,222,128,0.12)",
                        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px",
                      }}>✓</span>
                      <span style={{ fontSize: ".75rem", color: "#cbd5e1", lineHeight: 1.3 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div style={{ padding: "4px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.button
                  onClick={handleCheckout}
                  whileHover={{ scale: 1.02, boxShadow: isYearly
                    ? "0 8px 30px rgba(212,175,55,0.5)"
                    : "0 8px 30px rgba(59,130,246,0.5)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "15px",
                    background: isYearly
                      ? "linear-gradient(135deg, #ffd900da, #e6c719da)"
                      : "linear-gradient(135deg, #3b82f6, #2563eb)",
                    borderRadius: 14, color: "#fff",
                    fontWeight: 700, fontSize: ".95rem",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    boxShadow: isYearly
                      ? "0 4px 20px rgba(212,175,55,0.35)"
                      : "0 4px 20px rgba(59,130,246,0.35)",
                    transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  Zacznij za {plan.price} zł →
                </motion.button>

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 12, padding: "6px 0", flexWrap: "wrap",
                }}>
                  {(isYearly
                    ? ["💳 Karta", "📱 BLIK", "🍎 Apple Pay"]
                    : ["💳 Karta", "🍎 Apple Pay"]
                  ).map((m) => (
                    <span key={m} style={{
                      fontSize: ".7rem", color: "#bec7d6",
                      background: "rgba(136, 153, 180, 0.11)",
                      border: "1px solid rgba(136, 153, 180, 0.25)",
                      borderRadius: 8, padding: "4px 10px",
                    }}>{m}</span>
                  ))}
                </div>

                <div style={{ textAlign: "center", fontSize: ".65rem", color: "#8899b4" }}>
                  🔒 Płatność obsługiwana przez Stripe
                </div>
              </div>
            </div>

            <p style={{ textAlign: "center", fontSize: ".72rem", color: "#8899b4", marginTop: 16 }}>
              Bez ukrytych opłat · Możliwość rezygnacji w każdej chwili
            </p>

            <p style={{ color: "#8899b4", fontSize: ".84rem", marginTop: 22, textAlign: "center" }}>
              Masz już konto?{" "}
              <span onClick={() => navigate("/login")} style={{ color: "#60a5fa", cursor: "pointer" }}>
                Zaloguj się
              </span>
            </p>
            <button
              onClick={() => navigate("/")}
              style={{ marginTop: 16, background: "none", border: "none", color: "#60a5fa", fontSize: ".86rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              ← Wróć na stronę główną
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
