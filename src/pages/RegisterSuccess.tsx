import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function RegisterSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate("/register/account"), 2500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh", background: "#060d1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%", maxWidth: 460, textAlign: "center",
          background: "#0f1117",
          border: "1px solid rgba(74,222,128,0.3)",
          borderRadius: 20, padding: "44px 28px",
          boxShadow: "0 0 60px rgba(74,222,128,0.15), 0 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
          style={{
            width: 84, height: 84, borderRadius: "50%",
            background: "rgba(74,222,128,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 22px",
          }}
        >
          <CheckCircle2 size={56} color="#4ade80" strokeWidth={2.2} />
        </motion.div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f1f5f9", margin: 0, marginBottom: 10 }}>
          Płatność powiodła się!
        </h1>
        <p style={{ fontSize: ".92rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: 26 }}>
          Dziękujemy za zaufanie 🎉 Za chwilę przejdziesz do założenia konta i będziesz mógł korzystać z pełnego dostępu.
        </p>

        <button
          onClick={() => navigate("/register/account")}
          style={{
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#fff", border: "none",
            padding: "13px 28px", borderRadius: 12,
            fontWeight: 700, fontSize: ".95rem",
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
          }}
        >
          Załóż konto →
        </button>

        <p style={{ fontSize: ".7rem", color: "#475569", marginTop: 18 }}>
          Automatyczne przekierowanie za chwilę...
        </p>
      </motion.div>
    </div>
  );
}
