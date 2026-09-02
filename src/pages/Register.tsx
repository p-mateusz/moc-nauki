import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import TermsModal, { DocumentType } from "@/components/TermsModal";
import { Seo } from "@/components/Seo";
import { normalizeAllFeeExemptSetting } from "@/lib/feeExempt";

const Register = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsDocument, setTermsDocument] = useState<DocumentType | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingPlan = searchParams.get("plan") || (typeof localStorage !== "undefined" ? localStorage.getItem("pendingPlan") : null);

  const openTermsDocument = (docType: DocumentType) => setTermsDocument(docType);

  const validateEmail = (email: string): boolean => {
    const trimmedEmail = email.trim();
    const atCount = (trimmedEmail.match(/@/g) || []).length;
    return atCount === 1 && trimmedEmail.length > 0;
  };

  const handleRegister = async () => {
    if (!email.trim() || !name.trim() || !username.trim() || !password.trim()) {
      toast.error("Wypełnij wszystkie pola");
      return;
    }
    if (!validateEmail(email)) {
      toast.error("Podaj prawidłowy adres email");
      return;
    }
    if (password.length < 6) {
      toast.error("Hasło musi mieć minimum 6 znaków");
      return;
    }
    if (!accepted) {
      toast.error("Musisz zaakceptować Regulamin oraz Politykę Prywatności");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-register", {
        body: { email: email.trim(), name: name.trim(), username: username.trim(), password },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("userName", data.account.name);
      localStorage.setItem("userUsername", data.account.username);
      localStorage.setItem("userRole", "uczeń");
      toast.success("Konto utworzone! Witaj w Moc Nauki 🎉");
      let allFeeExempt = false;
      try {
        const { data: setting } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "all_fee_exempt")
          .maybeSingle();
        allFeeExempt = normalizeAllFeeExemptSetting((setting as any)?.value);
      } catch {}
      if (allFeeExempt) {
        try { localStorage.removeItem("pendingPlan"); } catch {}
        navigate("/dashboard", { replace: true });
      } else if (pendingPlan === "30" || pendingPlan === "90") {
        navigate(`/pricing?plan=${pendingPlan}&autostart=1`);
      } else {
        navigate("/pricing");
      }

    } catch (e: any) {
      toast.error(e.message || "Błąd rejestracji");
    } finally {
      setLoading(false);
    }
  };

  const ready = email.trim() && name.trim() && username.trim() && password.trim() && accepted && !loading;

  const inputStyle = (filled: boolean, color = "59,130,246"): React.CSSProperties => ({
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: filled ? `1px solid rgba(${color},0.4)` : "1px solid rgba(255,255,255,0.08)",
    color: "#f1f5f9",
    borderRadius: 12,
    padding: "13px 16px",
    fontSize: ".92rem",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color .2s",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    fontSize: ".65rem",
    fontWeight: 700,
    color: "#475569",
    letterSpacing: ".08em",
    marginBottom: 6,
  };

  return (
    <>
    <Seo title="Załóż konto w Moc Nauki" description="Utwórz konto w Moc Nauki i odblokuj notatki AI, fiszki, quizy oraz inteligentny kalendarz nauki." path="/register/account" />
    <div style={{
      minHeight: "100vh",
      background: "#060d1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Blobs */}
      <div style={{
        position: "fixed", top: "-20%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", right: "-10%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: ".72rem", fontWeight: 700, color: "#3b82f6",
            letterSpacing: ".12em", marginBottom: 10,
          }}>
            MOC NAUKI
          </div>
          <h1 style={{
            fontSize: "clamp(1.6rem, 4vw, 2rem)", fontWeight: 900,
            color: "#fff", margin: 0, lineHeight: 1.2,
          }}>
            Załóż konto w Moc Nauki
          </h1>
          <p style={{ color: "#8899b4", fontSize: ".87rem", marginTop: 8 }}>
            Dołącz i zacznij naukę już dziś
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#0f1117",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(59,130,246,0.08), 0 24px 48px rgba(0,0,0,0.5)",
        }}>
          {/* Top accent */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)",
          }} />

          <div style={{ padding: "32px 28px" }}>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>EMAIL</div>
              <input
                type="email"
                aria-label="Email"
                placeholder="np. jan@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle(!!email)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>IMIĘ</div>
              <input
                type="text"
                aria-label="Imię"
                placeholder="np. Jan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle(!!name)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>NAZWA UŻYTKOWNIKA</div>
              <input
                type="text"
                aria-label="Nazwa użytkownika"
                placeholder="np. jan_kowalski"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle(!!username, "99,102,241")}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>HASŁO</div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  aria-label="Hasło"
                  placeholder="min. 6 znaków"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && accepted && handleRegister()}
                  style={{ ...inputStyle(!!password, "99,102,241"), paddingRight: 46 }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                  aria-pressed={showPassword}
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={() => setShowPassword(true)}
                  onTouchEnd={() => setShowPassword(false)}
                  style={{
                    position: "absolute", right: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    color: "#475569", cursor: "pointer",
                    padding: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 24,
              cursor: "pointer",
              textAlign: "left",
            }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 3, accentColor: "#3b82f6", width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ color: "#8899b4", fontSize: ".82rem", lineHeight: 1.6 }}>
                Oświadczam, że zapoznałem się z niniejszym{" "}
                <button
                  type="button"
                  onClick={() => openTermsDocument("terms")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#60a5fa",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Regulaminem
                </button>{" "}
                i{" "}
                <button
                  type="button"
                  onClick={() => openTermsDocument("privacy")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#60a5fa",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Polityką Prywatności
                </button>{" "}
                oraz zgadzam się z ich postanowieniami.
              </span>
            </label>

            <motion.button
              onClick={handleRegister}
              disabled={!ready}
              whileHover={ready ? { scale: 1.02, boxShadow: "0 8px 30px rgba(59,130,246,0.45)" } : {}}
              whileTap={ready ? { scale: 0.98 } : {}}
              style={{
                width: "100%",
                background: ready
                  ? "linear-gradient(135deg, #3b82f6, #6366f1)"
                  : "rgba(59,130,246,0.2)",
                color: ready ? "#fff" : "#475569",
                border: "none",
                padding: "14px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: ".95rem",
                cursor: ready ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                boxShadow: ready ? "0 4px 20px rgba(59,130,246,0.3)" : "none",
                transition: "all .25s",
              }}
            >
              {loading ? "Tworzenie konta..." : "Załóż konto →"}
            </motion.button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <p style={{ color: "#8899b4", fontSize: ".84rem", marginBottom: 10 }}>
            Masz już konto?{" "}
            <span
              onClick={() => navigate("/login")}
              style={{ color: "#60a5fa", cursor: "pointer", fontWeight: 600 }}
            >
              Zaloguj się
            </span>
          </p>
          <button
            onClick={() => navigate("/")}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              color: "#60a5fa",
              fontSize: ".86rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Wróć na stronę główną
          </button>
        </div>
      </motion.div>

      {termsDocument && (
        <TermsModal onClose={() => setTermsDocument(null)} initialDoc={termsDocument} />
      )}
    </div>
    </>
  );
};

export default Register;
